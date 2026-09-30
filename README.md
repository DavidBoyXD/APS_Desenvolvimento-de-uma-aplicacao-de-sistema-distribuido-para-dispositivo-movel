# Monitor Ambiental Urbano

APS_7 / 8 Semestre CC na Universidade Paulista (UNIP)

Disciplina: Sistemas Distribuidos (SD). Tema da APS: "Desenvolvimento de uma
aplicacao de sistema distribuido para dispositivo movel".

## Descricao do projeto e tema

Este repositorio implementa uma aplicacao de sistema distribuido para dispositivo
movel voltada ao gerenciamento de informacoes ambientais urbanas. O nucleo cobre
qualidade do ar (poluicao), com tipos adicionais para transito e areas de
alagamento. A consulta e feita por regiao, ligada a um mapa, e o sistema oferece
relatorios agregados, alertas por limiar e tratamento de erros padronizado.

O trabalho e composto por dois programas que se comunicam pela rede, mais um banco
de dados, caracterizando o sistema distribuido:

- Cliente movel (React Native / Expo) que exibe o mapa, as regioes e as medicoes.
- Servidor de API REST (Python / FastAPI) que expoe os dados e a logica.
- Banco de dados (SQLite) que persiste regioes, medicoes e alertas.

## Arquitetura do sistema distribuido

```
+---------------------------+        HTTP / REST (JSON)        +---------------------------+
|  Cliente movel            |  <-----------------------------> |  Servidor de API REST     |
|  React Native / Expo      |     GET/POST /api/v1/...          |  FastAPI (Python)         |
|  (mapa, detalhe,          |                                  |  routers + servicos       |
|   relatorios, alertas)    |                                  |                           |
+---------------------------+                                  +------------+--------------+
                                                                            |
                                                          SQLAlchemy (ORM)  |
                                                                            v
                                                               +---------------------------+
                                                               |  Banco de dados SQLite    |
                                                               |  server/data/app.db       |
                                                               +---------------------------+

O servidor tambem consome fontes externas reais de dados: a Open-Meteo Air
Quality API (sem chave) para qualidade do ar, e a Overpass API do OpenStreetMap
(sem chave, dados sob licenca ODbL) para transito.
```

- Base da API: `http://HOST:8000`, prefixo `/api/v1`, corpo em JSON.
- Documentacao interativa (Swagger) em `http://HOST:8000/docs`.
- Verificacao de saude em `http://HOST:8000/health`.

### Atualizacao com fontes reais

- `POST /api/v1/regioes/{id}/atualizar-ar` - busca a qualidade do ar atual na
  Open-Meteo (sem chave) e persiste as medicoes de `qualidade_ar`.
- `POST /api/v1/regioes/{id}/atualizar-transito` - busca as vias reais ao redor
  da regiao na **Overpass API do OpenStreetMap** e persiste metricas de
  infraestrutura viaria como medicoes de `transito`: numero de vias principais,
  media de faixas (`lanes`) e media de velocidade maxima (`maxspeed`). Os dados
  do OpenStreetMap sao publicados sob a licenca **ODbL**
  ([openstreetmap.org/copyright](https://www.openstreetmap.org/copyright)); o
  campo `fonte` de cada medicao cita a origem. A chamada exige o header
  `User-Agent` (a API responde HTTP 406 sem ele).

Ambos os endpoints retornam **HTTP 502** padronizado em PT-BR quando a fonte
externa falha. Exemplo:

```bash
curl -X POST http://localhost:8000/api/v1/regioes/1/atualizar-transito
```

## Pre-requisitos

- Python 3.9 ou superior (back-end).
- Node.js 18 ou superior e npm (cliente movel).
- Expo (usado via `npx`, nao precisa instalar global).
- Opcional: Android Studio com emulador Android, ou o app Expo Go em um
  dispositivo fisico, para executar o cliente movel.

## Como rodar o SERVIDOR (back-end FastAPI)

No diretorio raiz do repositorio:

```bash
cd server
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Notas:

- No startup o servidor cria as tabelas e roda o seed idempotente (3 regioes
  reais: Sao Paulo, Rio de Janeiro e Curitiba, com medicoes iniciais).
- Apos subir, acesse:
  - `http://localhost:8000/docs` (Swagger, documentacao interativa da API).
  - `http://localhost:8000/health` (deve responder `{"status":"ok"}`).
  - `http://localhost:8000/api/v1/regioes` (lista de regioes para o mapa).
- O banco fica em `server/data/app.db` e e gerado em tempo de execucao (nao e
  versionado no Git).

Para rodar os testes automatizados do back-end:

```bash
cd server
.venv/bin/python -m pytest -q
```

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
aparecer em cinza. O aplicativo mantem uma lista de regioes clicavel como
alternativa. O passo a passo detalhado esta em
[docs/07_apresentacao_do_programa.md](docs/07_apresentacao_do_programa.md).

Nota sobre o grafico dos relatorios: a tela de Relatorios exibe, alem da lista de
cards, um grafico de barras ("Medias por parametro") desenhado com a biblioteca
`react-native-chart-kit` (que depende de `react-native-svg`). Essas dependencias
ja estao no `package.json` e sao instaladas com o `npm install`. Caso precise
reinstala-las de forma compativel com o SDK, use o gerenciador do Expo:
`cd mobile && npx expo install react-native-chart-kit react-native-svg`.

## Documentacao

A documentacao academica completa em Portugues-BR, seguindo a estrutura exigida
pela APS (objetivo e motivacao, introducao, fundamentos, plano de
desenvolvimento, projeto e modulos, relatorio de codigo, apresentacao,
bibliografia, capa e ficha), esta na pasta [docs/](docs/):

- [Indice da documentacao (docs/00_LEIA-ME.md)](docs/00_LEIA-ME.md)
- [Declaracao de uso de IA (DECLARACAO_IA.md)](DECLARACAO_IA.md)

## Estrutura do repositorio

```
server/        Back-end FastAPI (API REST) + SQLite
  app/main.py  Entrypoint da aplicacao FastAPI
mobile/        Cliente movel Expo / React Native (TypeScript)
docs/          Documentacao academica em Portugues-BR
DECLARACAO_IA.md   Declaracao de uso de Inteligencia Artificial
README.md      Este arquivo
```

## Referencias

- [FastAPI](https://fastapi.tiangolo.com) - framework do servidor de API REST
  (back-end).
- [Expo](https://docs.expo.dev) - plataforma e ferramentas do cliente movel.
- [React Native](https://reactnative.dev) - framework do aplicativo movel.
- [react-native-chart-kit](https://github.com/indiespirit/react-native-chart-kit) -
  biblioteca de graficos usada no grafico de barras da tela de Relatorios
  (`mobile/src/screens/RelatoriosScreen.tsx`); depende de
  [react-native-svg](https://github.com/software-mansion/react-native-svg).
- [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) -
  fonte real e gratuita (sem chave) de dados de qualidade do ar, consumida pelo
  servidor.
- [Overpass API do OpenStreetMap](https://wiki.openstreetmap.org/wiki/Overpass_API) -
  fonte real e gratuita (sem chave) de infraestrutura viaria (transito),
  consumida pelo servidor. Dados sob licenca
  [ODbL](https://www.openstreetmap.org/copyright).

Referencias adicionais, com indicacao de onde cada tecnologia foi aplicada,
estao em [docs/08_bibliografia.md](docs/08_bibliografia.md).
