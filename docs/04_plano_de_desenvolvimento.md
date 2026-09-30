# 4. Plano de desenvolvimento da aplicacao

Este capitulo descreve os elementos e ferramentas do projeto, o passo a passo do
desenvolvimento e a caracterizacao do sistema distribuido, incluindo um diagrama
textual do fluxo cliente <-> API <-> banco.

## 4.1 Caracterizacao do sistema distribuido

O sistema tem tres componentes principais que rodam de forma autonoma e se
comunicam por rede, mais um servico externo de dados reais:

```
+---------------------------+          HTTP / JSON (REST)          +----------------------------+
|   CLIENTE MOVEL           |  ----------------------------------> |   SERVIDOR (API REST)      |
|   React Native / Expo     |     GET/POST /api/v1/...             |   FastAPI (Python)         |
|   (Android / iOS)         | <----------------------------------  |                            |
|                           |     respostas JSON (dados/erros)     |   - routers (regioes,      |
|   mobile/                 |                                      |     medicoes, relatorios,  |
|   - MapaScreen            |                                      |     alertas, saude)        |
|   - DetalheScreen         |                                      |   - schemas (Pydantic)     |
|   - RelatoriosScreen      |                                      |   - errors (handlers)      |
|   - AlertasScreen         |                                      |   server/                  |
+---------------------------+                                      +-------------+--------------+
                                                                                 |
                                              SQLAlchemy (ORM)                    |  httpx (HTTP)
                                                                                 |
                                          +--------------------------+           |   +-------------------------------+
                                          |   BANCO DE DADOS         | <---------+   |  SERVICO EXTERNO              |
                                          |   SQLite (app.db)        |               |  Open-Meteo Air Quality API   |
                                          |   -> migravel p/ Postgres|               |  (dados reais de qualidade    |
                                          |   Regiao / Medicao /     |               |   do ar, sem chave)           |
                                          |   Alerta                 |               +-------------------------------+
                                          +--------------------------+
```

Fluxo de uma consulta tipica (abrir uma regiao no app):

1. O usuario toca em uma regiao no mapa (cliente movel).
2. O cliente faz `GET /api/v1/medicoes?regiao_id={id}` ao servidor (HTTP/JSON).
3. O servidor consulta o banco via SQLAlchemy e devolve a lista de medicoes.
4. O cliente exibe as medicoes agrupadas por tipo.

Fluxo de atualizacao de dados reais (botao "Atualizar qualidade do ar"):

1. O cliente faz `POST /api/v1/regioes/{id}/atualizar-ar`.
2. O servidor chama a Open-Meteo (via httpx) com a latitude/longitude da regiao.
3. O servidor persiste as novas medicoes no banco e as retorna ao cliente.
4. Em caso de falha de rede com a Open-Meteo, o servidor devolve um erro 502
   padronizado (nunca um erro 500 cru), e o cliente mostra uma mensagem amigavel.

Fluxo de atualizacao de transito (dados reais de infraestrutura viaria):

1. O cliente faz `POST /api/v1/regioes/{id}/atualizar-transito`.
2. O servidor chama a Overpass API do OpenStreetMap (via httpx, com header
   `User-Agent`) buscando as vias principais ao redor da regiao.
3. O servidor deriva metricas reais (numero de vias, media de faixas e media de
   velocidade maxima), persiste como medicoes de `transito` (com `fonte` citando
   OpenStreetMap/Overpass sob ODbL) e as retorna ao cliente.
4. Em caso de falha da Overpass, o servidor devolve o mesmo 502 padronizado.

## 4.2 Elementos do projeto (monorepo)

O repositorio e um monorepo com tres areas:

- `server/` - back-end (API REST em FastAPI + SQLite).
- `mobile/` - cliente movel (React Native/Expo em TypeScript).
- `docs/` - esta documentacao academica em Portugues-BR.

Alem disso, na raiz: `README.md`, `.gitignore`, o documento de requisitos
`APS_7_8_CC_2025_DSD.docx` e a declaracao de uso de IA (capitulo 9).

## 4.3 Ferramentas e bibliotecas (versao, link e onde foram aplicadas)

### Back-end (`server/requirements.txt`)

| Ferramenta | Versao | Link oficial | Onde foi aplicada |
| --- | --- | --- | --- |
| FastAPI | 0.115.6 | [fastapi.tiangolo.com](https://fastapi.tiangolo.com) | `server/app/main.py`, `server/app/routers/*` |
| Uvicorn (standard) | 0.32.1 | [uvicorn.org](https://www.uvicorn.org) | Execucao do servidor (capitulo 7) |
| SQLAlchemy | 2.0.36 | [sqlalchemy.org](https://www.sqlalchemy.org) | `server/app/database.py`, `server/app/models.py` |
| Pydantic | 2.10.4 | [docs.pydantic.dev](https://docs.pydantic.dev) | `server/app/schemas.py` |
| httpx | 0.28.1 | [python-httpx.org](https://www.python-httpx.org) | `server/app/services/openmeteo.py`, `server/app/services/overpass.py` |
| pytest | 8.3.4 | [docs.pytest.org](https://docs.pytest.org) | `server/tests/*` |
| Python | 3.9 | [python.org](https://www.python.org) | Runtime do back-end |

Fontes de dados externas (reais, gratuitas, sem chave):

- **Open-Meteo Air Quality API** (qualidade do ar)
  ([open-meteo.com/en/docs/air-quality-api](https://open-meteo.com/en/docs/air-quality-api)),
  aplicada em `server/app/services/openmeteo.py`.
- **Overpass API do OpenStreetMap** (transito / infraestrutura viaria)
  ([wiki.openstreetmap.org/wiki/Overpass_API](https://wiki.openstreetmap.org/wiki/Overpass_API)),
  endpoint `https://overpass-api.de/api/interpreter`, dados sob licenca **ODbL**
  ([openstreetmap.org/copyright](https://www.openstreetmap.org/copyright)),
  aplicada em `server/app/services/overpass.py`. Exige o header `User-Agent`.

### Cliente movel (`mobile/package.json`)

| Ferramenta | Versao | Link oficial | Onde foi aplicada |
| --- | --- | --- | --- |
| Expo (SDK) | 57 | [docs.expo.dev](https://docs.expo.dev) | Projeto todo; `mobile/app.json` |
| React Native | (do SDK 57) | [reactnative.dev](https://reactnative.dev) | Telas e UI em `mobile/src/*` |
| @react-navigation/native | 7.5.0 | [reactnavigation.org](https://reactnavigation.org) | `mobile/App.tsx` |
| @react-navigation/native-stack | 7.20.0 | [reactnavigation.org](https://reactnavigation.org) | `mobile/App.tsx` |
| react-native-maps | 1.27.2 | [github.com/react-native-maps](https://github.com/react-native-maps/react-native-maps) | `mobile/src/screens/MapaScreen.tsx` |
| react-native-screens | 4.26.2 | [github.com/software-mansion/react-native-screens](https://github.com/software-mansion/react-native-screens) | Dependencia da navegacao |
| react-native-safe-area-context | 5.7.0 | [github.com/th3rdwave/react-native-safe-area-context](https://github.com/th3rdwave/react-native-safe-area-context) | `mobile/App.tsx` (SafeAreaProvider) |
| TypeScript | (do SDK) | [typescriptlang.org](https://www.typescriptlang.org) | Todo o codigo `mobile/` |

## 4.4 Passo a passo do desenvolvimento

O desenvolvimento seguiu quatro etapas incrementais, cada uma deixando o
repositorio em estado funcional (baseline verde):

1. **Preparacao do monorepo e ambiente (scaffolding).**
   - Criacao das pastas `server/`, `mobile/` e `docs/` e do `.gitignore`.
   - Back-end: `python -m venv .venv` e instalacao das dependencias fixadas em
     `server/requirements.txt`; rota `GET /health` e teste inicial com pytest.
   - Cliente: inicializacao do app Expo (template blank-typescript) e checagem de
     tipos com `npx tsc --noEmit`.

2. **Back-end completo (API REST).**
   - Camada de dados: `database.py` (engine/sessao SQLite), `models.py` (Regiao,
     Medicao, Alerta) e `schemas.py` (Pydantic).
   - Integracao externa: `services/openmeteo.py` (qualidade do ar) e
     `services/overpass.py` (transito via OpenStreetMap), ambos com consulta via
     httpx e tratamento de erro dedicado.
   - Rotas por dominio em `routers/` (regioes, medicoes, relatorios, alertas,
     saude) e tratamento de erros global em `errors.py`.
   - Seed idempotente (`seed.py`) com 3 regioes brasileiras reais e medicoes/
     alertas de exemplo.
   - Suite de testes em `tests/` (pytest) cobrindo saude, regioes, medicoes,
     relatorios, alertas e o mapeamento do payload da Open-Meteo.

3. **Cliente movel.**
   - Tipos TypeScript espelhando os schemas (`src/types.ts`) e cliente HTTP
     tipado (`src/api/client.ts`).
   - Navegacao em pilha (`App.tsx`, `src/navigation.ts`) e as quatro telas
     (`src/screens/*`): Mapa, Detalhe, Relatorios e Alertas.
   - Componentes de estado e rotulos em PT-BR (`src/ui/*`).
   - Validacao por checagem de tipos (`npx tsc --noEmit`).

4. **Documentacao academica (este conjunto de arquivos em `docs/`).**
   - Cobertura de toda a estrutura exigida pela APS, com links de referencia e a
     declaracao de uso de IA.

## 4.5 Convencoes e requisito de rastreabilidade

- Idioma Portugues-BR em toda a documentacao; codigo em ingles com comentarios em
  Portugues.
- Cada tecnologia/biblioteca/API citada tem link de referencia real e a indicacao
  de onde foi aplicada (ver tabelas acima e `08_bibliografia.md`).
- O campo `fonte` de cada medicao no banco registra a origem do dado (real ou
  simulado), reforcando a rastreabilidade tambem em tempo de execucao.
