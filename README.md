# Monitoramento de transporte público em SP

APS do 7º/8º semestre de Ciência da Computação (CC) na Universidade Paulista (UNIP).

Disciplina: Desenvolvimento de Sistemas Distribuídos (DSD). Tema da APS:
"Desenvolvimento de uma aplicação de sistema distribuído para dispositivo móvel".

## Descrição do projeto e tema

Este repositório implementa uma aplicação de sistema distribuído para dispositivo
móvel voltada ao monitoramento do **transporte público** da cidade de **São Paulo
(SP)**, usando a frota de ônibus da capital como informação urbana principal. O
sistema se apoia em duas fontes OFICIAIS:

- **Transporte público** (frota de ônibus da capital), via **SPTrans Olho Vivo**,
  a API oficial da Prefeitura de São Paulo.
- **Base geográfica** (município/UF), via **API de Localidades do IBGE** (código
  da UF 35 = São Paulo).

A consulta é feita por região da capital (distritos reais de São Paulo),
apresentada em uma lista de regiões, e o sistema oferece relatórios agregados,
alertas por limiar e tratamento de erros padronizado em Português-BR.

O trabalho é composto por dois programas que se comunicam pela rede, mais um banco
de dados, caracterizando o sistema distribuído:

- Cliente móvel (React Native / Expo) que exibe a lista de regiões de SP e as
  medições e inclui uma tela de **Linhas de ônibus** (busca de linhas/paradas,
  posição dos veículos e previsão de chegada), acessível pelo botão "Linhas de
  onibus" na tela inicial. A busca é **aproximada (fuzzy)**: ignora acentos e
  pontuação e ordena os resultados por similaridade com o termo digitado, então
  não é preciso digitar exatamente como no Olho Vivo. A tela de Linhas traz ainda
  uma **navegação assistida (catálogo)** quando o campo de busca está vazio — para
  linhas, apenas os favoritos; para paradas, pontos de referência conhecidos —
  (**sem remover a busca livre**, que continua permitindo pesquisar qualquer
  linha) e **favoritos salvos localmente no aparelho** (estrela em cada linha)
  para voltar rápido às linhas acompanhadas. A mesma busca, catálogo e favoritos
  estão também **integrados ao mapa** (tela "Ver no mapa"), numa camada flutuante
  sobre o mapa com um **painel expansível por toque** que respeita a **área
  segura** do aparelho, permitindo buscar/selecionar uma linha e vê-la plotada; o
  mapa usa um **único tile cartográfico fixo** (OpenStreetMap padrão, sem
  satélite e sem chave de API).
- Servidor de API REST (Python / FastAPI) que expõe os dados e a lógica e consome
  as fontes externas de SP.
- Banco de dados (SQLite) que persiste regiões, medições e alertas.

## Arquitetura do sistema distribuído

```
+---------------------------+        HTTP / REST (JSON)        +---------------------------+
|  Cliente movel            |  <=============================> |  Servidor de API REST     |
|  React Native / Expo      |     GET/POST /api/v1/...          |  FastAPI (Python)         |
|  (lista de regioes de SP, |                                  |  routers + servicos       |
|   detalhe, relatorios,    |                                  |                           |
|   alertas)                |                                  |                           |
+---------------------------+                                  +------------+--------------+
                                                                            |
                                                          SQLAlchemy (ORM)  |
                                                                            v
                                                               +---------------------------+
                                                               |  Banco de dados SQLite    |
                                                               |  server/data/app.db       |
                                                               +---------------------------+
```

O servidor consome fontes externas reais, com recorte em São Paulo. Para
transporte público usa a fonte OFICIAL da Prefeitura (SPTrans Olho Vivo, que exige
token gratuito, com fallback funcional sem token). A base geográfica vem da API
oficial do IBGE.

- Base da API: `http://HOST:8000`, prefixo `/api/v1`, corpo em JSON.
- Documentação interativa (Swagger) em `http://HOST:8000/docs`.
- Verificação de saúde em `http://HOST:8000/health`.

## Fontes de dados (recorte São Paulo)

| Área | Fonte usada no código | Token | Onde foi aplicada |
| --- | --- | --- | --- |
| Transporte público | SPTrans Olho Vivo (OFICIAL, tempo real) + exemplo/GTFS (fallback) | Sim (gratuito) | `server/app/services/sptrans.py` |
| Base geográfica | API de Localidades do IBGE (código UF 35 = SP) | Não | `server/app/services/ibge.py` |

Links reais:

- **SPTrans Olho Vivo** (fonte OFICIAL da Prefeitura de São Paulo, tempo real da
  frota de ônibus; a mesma seção disponibiliza o GTFS estático usado como base do
  fallback): [https://www.sptrans.com.br/desenvolvedores/](https://www.sptrans.com.br/desenvolvedores/).
  Aplicada em `server/app/services/sptrans.py`, consumida por
  `POST /api/v1/regioes/{id}/atualizar-transporte` (métricas da frota) e pelos
  endpoints de acompanhamento de ônibus e busca em `server/app/routers/linhas.py`
  (`/api/v1/linhas/buscar`, `/linhas/{codigo_linha}/posicoes`,
  `/linhas/{codigo_linha}/previsao` e `/paradas/buscar`).
- **IBGE - API de Localidades** (oficial, nacional, sem chave; código da UF 35 =
  São Paulo): [https://servicodados.ibge.gov.br/api/v1/localidades](https://servicodados.ibge.gov.br/api/v1/localidades).
  Aplicada em `server/app/services/ibge.py`, consumida por
  `GET /api/v1/localidades/sp`.

## Endpoints da API

Todos sob o prefixo `/api/v1`, corpo em JSON. Em caso de falha da fonte externa, o
servidor retorna **HTTP 502** padronizado em Português-BR (schema `ErroResposta`
com `codigo`, `mensagem` e `detalhe`, nunca um erro 500 cru).

- `GET /health` - verificação de saúde (`{"status":"ok"}`).
- `GET /api/v1/regioes` - lista de regiões de SP (com lat/lon).
- `GET /api/v1/regioes/{id}` - detalhe de uma região.
- `GET /api/v1/medicoes` - lista de medições (filtros por região/tipo).
- `GET /api/v1/regioes/{id}/medicoes` - medições de uma região.
- `POST /api/v1/regioes/{id}/atualizar-transporte` - busca a frota de ônibus na
  **SPTrans Olho Vivo** e persiste métricas de `transporte_publico`. Com o token
  `SPTRANS_TOKEN` definido, deriva métricas REAIS em tempo real (linhas
  monitoradas e veículos em operação). SEM o token, usa um fallback de exemplo
  claramente rotulado (não é tempo real), para o app funcionar de ponta a ponta.
  Veja a seção "Configuração do token da SPTrans" abaixo.
  **Semântica (métrica por cidade, não por região):** o endpoint recebe
  `regiao_id` por uniformidade, mas o `/Posicao` da SPTrans devolve a frota de
  São Paulo inteira e ignora o lat/lon da região. Portanto `linhas_monitoradas` e
  `veiculos_em_operacao` são métricas da cidade de São Paulo como um todo (frota
  do Olho Vivo), não geofiltradas por região: atualizar regiões diferentes no
  mesmo instante grava os mesmos valores.
- `GET /api/v1/linhas/buscar?termo=` - busca linhas de ônibus de SP por texto na
  **SPTrans Olho Vivo** (`/Linha/Buscar`). Com `SPTRANS_TOKEN` definido, retorna
  dados em tempo real; sem o token, devolve linhas de exemplo rotuladas como NÃO
  tempo real (`tempo_real=false`). O `termo` é obrigatório.
- `GET /api/v1/linhas/{codigo_linha}/posicoes` - posição dos veículos de uma linha
  (`/Posicao/Linha`). Tempo real com token; fallback de exemplo sem token.
- `GET /api/v1/linhas/{codigo_linha}/previsao` - previsão de chegada por parada de
  uma linha (`/Previsao/Linha`). Tempo real com token; fallback de exemplo sem
  token.
- `GET /api/v1/paradas/buscar?termo=` - busca paradas de ônibus de SP por texto
  (`/Parada/Buscar`). Tempo real com token; fallback de exemplo sem token. O
  `termo` é obrigatório.
- `GET /api/v1/localidades/sp` - municípios de SP validados na API oficial do
  IBGE (código da UF 35).
- `GET /api/v1/relatorios/regiao/{id}` - agregações (média, mínimo, máximo,
  contagem e última leitura) por parâmetro.
- `GET /api/v1/alertas`, `POST /api/v1/alertas`,
  `GET /api/v1/alertas/avaliar/{regiao_id}` - regras de alerta por limiar e
  avaliação.

Exemplo de chamada:

```bash
curl -X POST http://localhost:8000/api/v1/regioes/1/atualizar-transporte
```

## Pré-requisitos

- Python 3.11 (back-end). O repositório foi validado com Python 3.11.
- Node.js 18 ou superior e npm (cliente móvel).
- Expo (usado via `npx`, não precisa instalar global). O projeto usa Expo SDK 58.
- Opcional: Android Studio com emulador Android, ou o app Expo Go em um
  dispositivo físico, para executar o cliente móvel.
- Opcional: token gratuito da SPTrans para o transporte público em tempo real
  (sem ele, o app funciona via fallback). Veja a seção do token mais abaixo.

## Como rodar o SERVIDOR (back-end FastAPI)

No diretório raiz do repositório:

```bash
cd server
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Notas:

- No startup o servidor cria as tabelas e roda o seed idempotente com 12 regiões
  reais de São Paulo (Sé, Pinheiros, Mooca, Santana, Itaquera, Santo Amaro,
  Butantã, Lapa, Vila Mariana, Ipiranga, Penha e Tatuapé), todas com
  `uf = "SP"` e coordenadas reais da capital.
- Após subir, acesse:
  - `http://localhost:8000/docs` (Swagger, documentação interativa da API).
  - `http://localhost:8000/health` (deve responder `{"status":"ok"}`).
  - `http://localhost:8000/api/v1/regioes` (lista de regiões de SP).
  - `http://localhost:8000/api/v1/localidades/sp` (municípios de SP validados na
    API oficial do IBGE, código da UF 35).
- O banco fica em `server/data/app.db` e é gerado em tempo de execução (não é
  versionado no Git).

Para rodar os testes automatizados do back-end:

```bash
cd server
.venv/bin/python -m pytest -q
```

Os testes não dependem de rede nem de token real: as chamadas externas e a
autenticação da SPTrans são mockadas (monkeypatch e `httpx.MockTransport`).

## Como hospedar o back-end

Para que o APK instalado em um celular funcione **fora da rede local** (inclusive
com dados móveis), o servidor FastAPI precisa estar publicado na internet, com um
endereço público HTTPS. O repositório já traz o necessário em `server/`
(`Dockerfile`, `.dockerignore` e `render.yaml`), com porta dinâmica via variável
de ambiente `PORT` e health check em `/health`.

O passo a passo completo para publicar o servidor em um serviço gratuito (ex.:
Render, via Docker ou nativo Python) e, em seguida, gerar o APK apontando para a
URL pública está em [server/DEPLOY.md](server/DEPLOY.md).

## Como rodar o APP (cliente móvel Expo / React Native)

Em outro terminal, a partir do diretório raiz do repositório:

```bash
cd mobile
npm install
npx expo start
```

Depois de iniciar, abra o app em uma das opções:

- Emulador Android (Android Studio) ou simulador iOS (macOS).
- Dispositivo físico com o aplicativo Expo Go, lendo o QR Code exibido no
  terminal.

### Configuração da base da API (EXPO_PUBLIC_API_BASE_URL)

O cliente lê a base da API pela variável de ambiente
`EXPO_PUBLIC_API_BASE_URL`. Se não for definida, o valor padrão é
`http://10.0.2.2:8000`, apropriado para o emulador Android.

- Emulador Android: `10.0.2.2` é o apelido que o emulador usa para alcançar o
  `localhost` da máquina host, por isso o padrão já funciona com o servidor local.
- Simulador iOS ou web: use `http://localhost:8000`.
- Dispositivo físico (Expo Go): use o IP da máquina na rede local, por
  exemplo `http://192.168.0.10:8000`.

Exemplos para definir a variável antes de iniciar o Expo:

```bash
# Simulador iOS ou navegador
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000 npx expo start

# Dispositivo fisico via Expo Go (troque pelo IP da maquina na LAN)
EXPO_PUBLIC_API_BASE_URL=http://192.168.0.10:8000 npx expo start
```

Nota sobre o mapa no Android: o mapa visual (tela opcional "Ver no mapa") é
desenhado com **tiles cartográficos via WebView** (`react-native-webview` +
Leaflet), portanto **não precisa de chave do Google Maps** nem de billing;
requer apenas internet para carregar os tiles. Sobre o mapa há uma camada de
**busca integrada** (barra flutuante + painel expansível por toque com catálogo
e favoritos): dá para buscar e selecionar uma linha e vê-la plotada sem sair do
mapa. O mapa usa um **único tile cartográfico fixo** — **OpenStreetMap padrão**
(`tile.openstreetmap.org`), cartográfico, **sem satélite** e **sem chave de
API** — com a atribuição obrigatória "© colaboradores do OpenStreetMap" exibida
no próprio mapa. Ao selecionar uma **parada** na busca, o mapa plota um
**marcador** nela (nome + endereço) e centraliza a visão no ponto. Com uma linha
selecionada (pela busca no mapa ou vinda
das Linhas de ônibus), o mapa **atualiza automaticamente** a posição dos veículos
(padrão de 15s, selecionável entre 10s, 15s e 30s, com botão de pausar), trocando
os marcadores sem recarregar o mapa (preserva o zoom/centro). O aplicativo mantém
uma lista de regiões de SP clicável como tela inicial, de modo que a navegação
funciona mesmo que o mapa não carregue. O passo a passo detalhado está em
[docs/07_apresentacao_do_programa.md](docs/07_apresentacao_do_programa.md) e em
[mobile/BUILD_APK.md](mobile/BUILD_APK.md).

Nota sobre o gráfico dos relatórios: a tela de Relatórios exibe, além da lista de
cards, um gráfico de **barras horizontais** ("Médias por parâmetro") desenhado
com `View` (barras proporcionais ao maior valor, com o rótulo textual completo e
o valor ao lado de cada barra). Não usa biblioteca de gráficos, o que mantém os
rótulos legíveis em telas estreitas e evita dependências nativas de desenho. Com
o histórico de medições agora **acumulado e limitado a 50** por parâmetro no
back-end, os cards mostram **amostras maiores que 1** e média/mínimo/máximo que
variam a cada atualização de transporte.

### Como gerar o APK (Android)

Para instalar o aplicativo em um celular Android sem usar o Expo Go, é possível
gerar um arquivo `.apk` com o **EAS Build** (serviço de build na nuvem do Expo).
O passo a passo completo e numerado (pré-requisitos, autenticação com a conta
Expo, inicialização do projeto, geração e instalação do APK) está em
[mobile/BUILD_APK.md](mobile/BUILD_APK.md).

## Configuração do token da SPTrans (Olho Vivo)

O transporte público em **tempo real** usa a API Olho Vivo da **SPTrans** (fonte
OFICIAL da Prefeitura de São Paulo), que exige um token de acesso **gratuito**. O
token nunca é escrito no código: ele é lido exclusivamente da variável de ambiente
`SPTRANS_TOKEN`.

Passo a passo para obter e configurar o token:

1. Acesse o portal do desenvolvedor da SPTrans:
   [https://www.sptrans.com.br/desenvolvedores/](https://www.sptrans.com.br/desenvolvedores/).
2. Cadastre-se / faça login e solicite a **chave de ativação** (token) da API
   Olho Vivo. O cadastro é gratuito.
3. Copie o token recebido.
4. Exporte a variável de ambiente `SPTRANS_TOKEN` com esse valor ANTES de subir o
   servidor. Use o placeholder `seu_token` abaixo apenas como exemplo e substitua
   pelo token real recebido da SPTrans:

   ```bash
   # Linux/macOS - definindo apenas para o processo do servidor
   SPTRANS_TOKEN=seu_token .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

   # Alternativa: exportar na sessao do terminal
   export SPTRANS_TOKEN=seu_token

   # Windows (PowerShell)
   $env:SPTRANS_TOKEN="seu_token"
   ```

Comportamento com e sem token:

- **COM `SPTRANS_TOKEN`**: a integração autentica no Olho Vivo e deriva métricas
  REAIS da frota em tempo real (linhas monitoradas e veículos em operação). O
  campo `fonte` das medições aponta a SPTrans Olho Vivo como fonte oficial.
- **SEM `SPTRANS_TOKEN`**: a integração usa um fallback FUNCIONAL com um conjunto
  de linhas de SP de exemplo, claramente rotulado como dado estático (GTFS /
  exemplo, NÃO é tempo real). O campo `fonte` deixa isso explícito. Assim o app
  roda de ponta a ponta mesmo sem o token.

O mesmo comportamento vale para os endpoints de acompanhamento de ônibus e busca
(`/api/v1/linhas/buscar`, `/linhas/{codigo_linha}/posicoes`,
`/linhas/{codigo_linha}/previsao` e `/paradas/buscar`): com token, os dados são
em tempo real; sem token, as respostas trazem `tempo_real=false` e uma `fonte`
que identifica o dado de exemplo. O token continua sendo lido exclusivamente da
variável de ambiente `SPTRANS_TOKEN`.

Obs: Não comite um token real! O valor `seu_token` nos
exemplos é apenas um placeholder.

## Documentação

A documentação acadêmica completa, seguindo a estrutura exigida
pela APS (objetivo e motivação, introdução, fundamentos, plano de
desenvolvimento, projeto e módulos, relatório de código, apresentação,
bibliografia, capa e ficha), está na pasta [docs/](docs/):

- [Indice da documentacao (docs/00_LEIA-ME.md)](docs/00_LEIA-ME.md)
- [Apresentacao do programa em funcionamento (docs/07_apresentacao_do_programa.md)](docs/07_apresentacao_do_programa.md)
- [Bibliografia e referencias (docs/08_bibliografia.md)](docs/08_bibliografia.md)

## Estrutura do repositório

```
server/        Back-end FastAPI (API REST) + SQLite
  app/main.py  Entrypoint da aplicacao FastAPI
  app/services/sptrans.py   Integracao SPTrans Olho Vivo (token + fallback)
  app/services/ibge.py      Base geografica oficial (IBGE, UF 35)
mobile/        Cliente movel Expo / React Native (TypeScript)
docs/          Documentacao academica em Portugues-BR
README.md      Este arquivo
```

## Referências

- [FastAPI](https://fastapi.tiangolo.com) - framework do servidor de API REST
  (back-end), em `server/app/main.py` e `server/app/routers/*`.
- [SQLAlchemy](https://www.sqlalchemy.org) - ORM de persistência, em
  `server/app/database.py` e `server/app/models.py`.
- [Pydantic](https://docs.pydantic.dev) - validação e serialização dos schemas,
  em `server/app/schemas.py`.
- [httpx](https://www.python-httpx.org) - cliente HTTP do servidor para consumir
  as fontes externas, em `server/app/services/*`.
- [pytest](https://docs.pytest.org) - testes automatizados do back-end, em
  `server/tests/*`.
- [Expo](https://docs.expo.dev) - plataforma e ferramentas do cliente móvel.
- [React Native](https://reactnative.dev) - framework do aplicativo móvel.
- [SPTrans Olho Vivo](https://www.sptrans.com.br/desenvolvedores/) - fonte OFICIAL
  da Prefeitura de São Paulo para transporte público (tempo real da frota de
  ônibus; token gratuito), consumida pelo servidor em
  `server/app/services/sptrans.py`. A mesma seção disponibiliza o GTFS estático
  usado como base do fallback.
- [IBGE - API de Localidades](https://servicodados.ibge.gov.br/api/v1/localidades) -
  base geográfica oficial (código da UF 35 = São Paulo), consumida pelo servidor
  em `server/app/services/ibge.py`.

Referências adicionais, com indicação de onde cada tecnologia foi aplicada,
estão em [docs/08_bibliografia.md](docs/08_bibliografia.md).
