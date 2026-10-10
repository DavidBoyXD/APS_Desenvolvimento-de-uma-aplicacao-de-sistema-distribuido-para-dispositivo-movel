# Monitor de Transporte Publico de Sao Paulo (SP)

APS do 7o/8o semestre de Ciencia da Computacao (CC) na Universidade Paulista (UNIP).

Disciplina: Sistemas Distribuidos (SD). Tema da APS: "Desenvolvimento de uma
aplicacao de sistema distribuido para dispositivo movel".

## Descricao do projeto e tema

Este repositorio implementa uma aplicacao de sistema distribuido para dispositivo
movel voltada ao monitoramento do **transporte publico** da cidade de **Sao Paulo
(SP)**, usando a frota de onibus da capital como informacao urbana principal. O
sistema se apoia em duas fontes OFICIAIS:

- **Transporte publico** (frota de onibus da capital), via **SPTrans Olho Vivo**,
  a API oficial da Prefeitura de Sao Paulo.
- **Base geografica** (municipio/UF), via **API de Localidades do IBGE** (codigo
  da UF 35 = Sao Paulo).

A consulta e feita por regiao da capital (distritos reais de Sao Paulo), ligada a
um mapa, e o sistema oferece relatorios agregados, alertas por limiar e tratamento
de erros padronizado em Portugues-BR.

O trabalho e composto por dois programas que se comunicam pela rede, mais um banco
de dados, caracterizando o sistema distribuido:

- Cliente movel (React Native / Expo) que exibe o mapa de SP, as regioes e as
  medicoes.
- Servidor de API REST (Python / FastAPI) que expoe os dados e a logica e consome
  as fontes externas de SP.
- Banco de dados (SQLite) que persiste regioes, medicoes e alertas.

## Arquitetura do sistema distribuido

```
+---------------------------+        HTTP / REST (JSON)        +---------------------------+
|  Cliente movel            |  <=============================> |  Servidor de API REST     |
|  React Native / Expo      |     GET/POST /api/v1/...          |  FastAPI (Python)         |
|  (mapa de SP, detalhe,    |                                  |  routers + servicos       |
|   relatorios, alertas)    |                                  |                           |
+---------------------------+                                  +------------+--------------+
                                                                            |
                                                          SQLAlchemy (ORM)  |
                                                                            v
                                                               +---------------------------+
                                                               |  Banco de dados SQLite    |
                                                               |  server/data/app.db       |
                                                               +---------------------------+
```

O servidor consome fontes externas reais, com recorte em Sao Paulo. Para
transporte publico usa a fonte OFICIAL da Prefeitura (SPTrans Olho Vivo, que exige
token gratuito, com fallback funcional sem token). A base geografica vem da API
oficial do IBGE.

- Base da API: `http://HOST:8000`, prefixo `/api/v1`, corpo em JSON.
- Documentacao interativa (Swagger) em `http://HOST:8000/docs`.
- Verificacao de saude em `http://HOST:8000/health`.

## Fontes de dados (recorte Sao Paulo)

| Area | Fonte usada no codigo | Token | Onde foi aplicada |
| --- | --- | --- | --- |
| Transporte publico | SPTrans Olho Vivo (OFICIAL, tempo real) + exemplo/GTFS (fallback) | Sim (gratuito) | `server/app/services/sptrans.py` |
| Base geografica | API de Localidades do IBGE (codigo UF 35 = SP) | Nao | `server/app/services/ibge.py` |

Links reais:

- **SPTrans Olho Vivo** (fonte OFICIAL da Prefeitura de Sao Paulo, tempo real da
  frota de onibus; a mesma secao disponibiliza o GTFS estatico usado como base do
  fallback): [https://www.sptrans.com.br/desenvolvedores/](https://www.sptrans.com.br/desenvolvedores/).
  Aplicada em `server/app/services/sptrans.py`, consumida por
  `POST /api/v1/regioes/{id}/atualizar-transporte`.
- **IBGE - API de Localidades** (oficial, nacional, sem chave; codigo da UF 35 =
  Sao Paulo): [https://servicodados.ibge.gov.br/api/v1/localidades](https://servicodados.ibge.gov.br/api/v1/localidades).
  Aplicada em `server/app/services/ibge.py`, consumida por
  `GET /api/v1/localidades/sp`.

## Endpoints da API

Todos sob o prefixo `/api/v1`, corpo em JSON. Em caso de falha da fonte externa, o
servidor retorna **HTTP 502** padronizado em Portugues-BR (schema `ErroResposta`
com `codigo`, `mensagem` e `detalhe`, nunca um erro 500 cru).

- `GET /health` - verificacao de saude (`{"status":"ok"}`).
- `GET /api/v1/regioes` - lista de regioes de SP (para o mapa, com lat/lon).
- `GET /api/v1/regioes/{id}` - detalhe de uma regiao.
- `GET /api/v1/medicoes` - lista de medicoes (filtros por regiao/tipo).
- `GET /api/v1/regioes/{id}/medicoes` - medicoes de uma regiao.
- `POST /api/v1/regioes/{id}/atualizar-transporte` - busca a frota de onibus na
  **SPTrans Olho Vivo** e persiste metricas de `transporte_publico`. Com o token
  `SPTRANS_TOKEN` definido, deriva metricas REAIS em tempo real (linhas
  monitoradas e veiculos em operacao). SEM o token, usa um fallback de exemplo
  claramente rotulado (nao e tempo real), para o app funcionar de ponta a ponta.
  Veja a secao "Configuracao do token da SPTrans" abaixo.
  **Semantica (metrica por cidade, nao por regiao):** o endpoint recebe
  `regiao_id` por uniformidade, mas o `/Posicao` da SPTrans devolve a frota de
  Sao Paulo inteira e ignora o lat/lon da regiao. Portanto `linhas_monitoradas` e
  `veiculos_em_operacao` sao metricas da cidade de Sao Paulo como um todo (frota
  do Olho Vivo), nao geofiltradas por regiao: atualizar regioes diferentes no
  mesmo instante grava os mesmos valores.
- `GET /api/v1/localidades/sp` - municipios de SP validados na API oficial do
  IBGE (codigo da UF 35).
- `GET /api/v1/relatorios/regiao/{id}` - agregacoes (media, minimo, maximo,
  contagem e ultima leitura) por parametro.
- `GET /api/v1/alertas`, `POST /api/v1/alertas`,
  `GET /api/v1/alertas/avaliar/{regiao_id}` - regras de alerta por limiar e
  avaliacao.

Exemplo de chamada:

```bash
curl -X POST http://localhost:8000/api/v1/regioes/1/atualizar-transporte
```

## Pre-requisitos

- Python 3.11 (back-end). O repositorio foi validado com Python 3.11.
- Node.js 18 ou superior e npm (cliente movel).
- Expo (usado via `npx`, nao precisa instalar global). O projeto usa Expo SDK 57.
- Opcional: Android Studio com emulador Android, ou o app Expo Go em um
  dispositivo fisico, para executar o cliente movel.
- Opcional: token gratuito da SPTrans para o transporte publico em tempo real
  (sem ele, o app funciona via fallback). Veja a secao do token mais abaixo.

## Como rodar o SERVIDOR (back-end FastAPI)

No diretorio raiz do repositorio:

```bash
cd server
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Notas:

- No startup o servidor cria as tabelas e roda o seed idempotente com 5 regioes
  reais de Sao Paulo (Se, Pinheiros, Mooca, Santana e Itaquera), todas com
  `uf = "SP"` e coordenadas reais da capital.
- Apos subir, acesse:
  - `http://localhost:8000/docs` (Swagger, documentacao interativa da API).
  - `http://localhost:8000/health` (deve responder `{"status":"ok"}`).
  - `http://localhost:8000/api/v1/regioes` (lista de regioes de SP para o mapa).
  - `http://localhost:8000/api/v1/localidades/sp` (municipios de SP validados na
    API oficial do IBGE, codigo da UF 35).
- O banco fica em `server/data/app.db` e e gerado em tempo de execucao (nao e
  versionado no Git).

Para rodar os testes automatizados do back-end:

```bash
cd server
.venv/bin/python -m pytest -q
```

Os testes nao dependem de rede nem de token real: as chamadas externas e a
autenticacao da SPTrans sao mockadas (monkeypatch e `httpx.MockTransport`).

## Como rodar o APP (cliente movel Expo / React Native)

Em outro terminal, a partir do diretorio raiz do repositorio:

```bash
cd mobile
npm install
npx expo start
```

Depois de iniciar, abra o app em uma das opcoes:

- Emulador Android (Android Studio) ou simulador iOS (macOS).
- Dispositivo fisico com o aplicativo Expo Go, lendo o QR Code exibido no
  terminal.

### Configuracao da base da API (EXPO_PUBLIC_API_BASE_URL)

O cliente le a base da API pela variavel de ambiente
`EXPO_PUBLIC_API_BASE_URL`. Se nao for definida, o valor padrao e
`http://10.0.2.2:8000`, apropriado para o emulador Android.

- Emulador Android: `10.0.2.2` e o apelido que o emulador usa para alcancar o
  `localhost` da maquina host, por isso o padrao ja funciona com o servidor local.
- Simulador iOS ou web: use `http://localhost:8000`.
- Dispositivo fisico (Expo Go): use o IP da sua maquina na rede local, por
  exemplo `http://192.168.0.10:8000`.

Exemplos para definir a variavel antes de iniciar o Expo:

```bash
# Simulador iOS ou navegador
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000 npx expo start

# Dispositivo fisico via Expo Go (troque pelo IP da sua maquina na LAN)
EXPO_PUBLIC_API_BASE_URL=http://192.168.0.10:8000 npx expo start
```

Nota sobre o mapa no Android: o componente de mapa (`react-native-maps`) pode
exigir uma chave do Google Maps para renderizar no Android; sem ela o mapa pode
aparecer em cinza. O aplicativo mantem uma lista de regioes de SP clicavel como
alternativa (fallback), de modo que a navegacao funciona mesmo sem a chave. O
passo a passo detalhado esta em
[docs/07_apresentacao_do_programa.md](docs/07_apresentacao_do_programa.md).

Nota sobre o grafico dos relatorios: a tela de Relatorios exibe, alem da lista de
cards, um grafico de barras ("Medias por parametro") desenhado com a biblioteca
`react-native-chart-kit` (que depende de `react-native-svg`). Essas dependencias
ja estao no `package.json` e sao instaladas com o `npm install`. Caso precise
reinstala-las de forma compativel com o SDK, use o gerenciador do Expo:
`cd mobile && npx expo install react-native-chart-kit react-native-svg`.

## Configuracao do token da SPTrans (Olho Vivo)

O transporte publico em **tempo real** usa a API Olho Vivo da **SPTrans** (fonte
OFICIAL da Prefeitura de Sao Paulo), que exige um token de acesso **gratuito**. O
token nunca e escrito no codigo: ele e lido exclusivamente da variavel de ambiente
`SPTRANS_TOKEN`.

Passo a passo para obter e configurar o token:

1. Acesse o portal do desenvolvedor da SPTrans:
   [https://www.sptrans.com.br/desenvolvedores/](https://www.sptrans.com.br/desenvolvedores/).
2. Cadastre-se / faca login e solicite a sua **chave de ativacao** (token) da API
   Olho Vivo. O cadastro e gratuito.
3. Copie o token recebido.
4. Exporte a variavel de ambiente `SPTRANS_TOKEN` com esse valor ANTES de subir o
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

- **COM `SPTRANS_TOKEN`**: a integracao autentica no Olho Vivo e deriva metricas
  REAIS da frota em tempo real (linhas monitoradas e veiculos em operacao). O
  campo `fonte` das medicoes aponta a SPTrans Olho Vivo como fonte oficial.
- **SEM `SPTRANS_TOKEN`**: a integracao usa um fallback FUNCIONAL com um conjunto
  de linhas de SP de exemplo, claramente rotulado como dado estatico (GTFS /
  exemplo, NAO e tempo real). O campo `fonte` deixa isso explicito. Assim o app
  roda de ponta a ponta mesmo sem o token.

Importante: nunca comite um token real neste repositorio. O valor `seu_token` nos
exemplos e apenas um placeholder.

## Documentacao

A documentacao academica completa em Portugues-BR, seguindo a estrutura exigida
pela APS (objetivo e motivacao, introducao, fundamentos, plano de
desenvolvimento, projeto e modulos, relatorio de codigo, apresentacao,
bibliografia, capa e ficha), esta na pasta [docs/](docs/):

- [Indice da documentacao (docs/00_LEIA-ME.md)](docs/00_LEIA-ME.md)
- [Apresentacao do programa em funcionamento (docs/07_apresentacao_do_programa.md)](docs/07_apresentacao_do_programa.md)
- [Bibliografia e referencias (docs/08_bibliografia.md)](docs/08_bibliografia.md)
- [Declaracao de uso de IA (DECLARACAO_IA.md)](DECLARACAO_IA.md)

## Estrutura do repositorio

```
server/        Back-end FastAPI (API REST) + SQLite
  app/main.py  Entrypoint da aplicacao FastAPI
  app/services/sptrans.py   Integracao SPTrans Olho Vivo (token + fallback)
  app/services/ibge.py      Base geografica oficial (IBGE, UF 35)
mobile/        Cliente movel Expo / React Native (TypeScript)
docs/          Documentacao academica em Portugues-BR
DECLARACAO_IA.md   Declaracao de uso de Inteligencia Artificial
README.md      Este arquivo
```

## Referencias

- [FastAPI](https://fastapi.tiangolo.com) - framework do servidor de API REST
  (back-end), em `server/app/main.py` e `server/app/routers/*`.
- [SQLAlchemy](https://www.sqlalchemy.org) - ORM de persistencia, em
  `server/app/database.py` e `server/app/models.py`.
- [Pydantic](https://docs.pydantic.dev) - validacao e serializacao dos schemas,
  em `server/app/schemas.py`.
- [httpx](https://www.python-httpx.org) - cliente HTTP do servidor para consumir
  as fontes externas, em `server/app/services/*`.
- [pytest](https://docs.pytest.org) - testes automatizados do back-end, em
  `server/tests/*`.
- [Expo](https://docs.expo.dev) - plataforma e ferramentas do cliente movel.
- [React Native](https://reactnative.dev) - framework do aplicativo movel.
- [react-native-chart-kit](https://github.com/indiespirit/react-native-chart-kit) -
  biblioteca de graficos usada no grafico de barras da tela de Relatorios
  (`mobile/src/screens/RelatoriosScreen.tsx`); depende de
  [react-native-svg](https://github.com/software-mansion/react-native-svg).
- [SPTrans Olho Vivo](https://www.sptrans.com.br/desenvolvedores/) - fonte OFICIAL
  da Prefeitura de Sao Paulo para transporte publico (tempo real da frota de
  onibus; token gratuito), consumida pelo servidor em
  `server/app/services/sptrans.py`. A mesma secao disponibiliza o GTFS estatico
  usado como base do fallback.
- [IBGE - API de Localidades](https://servicodados.ibge.gov.br/api/v1/localidades) -
  base geografica oficial (codigo da UF 35 = Sao Paulo), consumida pelo servidor
  em `server/app/services/ibge.py`.

Referencias adicionais, com indicacao de onde cada tecnologia foi aplicada,
estao em [docs/08_bibliografia.md](docs/08_bibliografia.md).
