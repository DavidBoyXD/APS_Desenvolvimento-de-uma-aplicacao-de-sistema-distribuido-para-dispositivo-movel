# 4. Plano de desenvolvimento da aplicacao

Este capitulo descreve os elementos e ferramentas do projeto, o passo a passo do
desenvolvimento e a caracterizacao do sistema distribuido, incluindo um diagrama
textual do fluxo cliente <-> API <-> banco <-> servicos oficiais de Sao Paulo.

## 4.1 Caracterizacao do sistema distribuido

O sistema tem tres componentes principais que rodam de forma autonoma e se
comunicam por rede, mais os servicos externos (oficiais e operacionais) de dados:

```
+---------------------------+          HTTP / JSON (REST)          +----------------------------+
|   CLIENTE MOVEL           |  ----------------------------------> |   SERVIDOR (API REST)      |
|   React Native / Expo     |     GET/POST /api/v1/...             |   FastAPI (Python)         |
|   (Android / iOS)         | <----------------------------------  |                            |
|   mapa enquadrado em SP    |     respostas JSON (dados/erros)     |   - routers (regioes,      |
|                           |                                      |     medicoes, localidades, |
|   mobile/                 |                                      |     relatorios, alertas)   |
|   - MapaScreen (SP)        |                                      |   - schemas (Pydantic)     |
|   - DetalheScreen          |                                      |   - errors (handlers 502)  |
|   - RelatoriosScreen       |                                      |   server/                  |
|   - AlertasScreen          |                                      +-------------+--------------+
+---------------------------+                                                    |
                                                                                 |  httpx (HTTP)
                        SQLAlchemy (ORM)                                         |
                                                                                 v
   +--------------------------+                        +------------------------------------------+
   |   BANCO DE DADOS         | <----------------------|  SERVICOS EXTERNOS                        |
   |   SQLite (app.db)        |                        |  - SPTrans Olho Vivo (OFICIAL SP, token) |
   |   -> migravel p/ Postgres|                        |  - Open-Meteo Air Quality (ar; CETESB)   |
   |   Regiao / Medicao /     |                        |  - Open-Meteo Flood/GloFAS (alag.; CGE-SP)|
   |   Alerta                 |                        |  - IBGE Localidades (base geografica SP)  |
   +--------------------------+                        +------------------------------------------+
```

Fluxo de uma consulta tipica (abrir uma regiao no app):

1. O usuario toca em uma regiao de Sao Paulo no mapa (cliente movel).
2. O cliente faz `GET /api/v1/medicoes?regiao_id={id}` ao servidor (HTTP/JSON).
3. O servidor consulta o banco via SQLAlchemy e devolve a lista de medicoes.
4. O cliente exibe as medicoes agrupadas por tipo.

Fluxo de atualizacao do transporte publico (SPTrans Olho Vivo):

1. O cliente faz `POST /api/v1/regioes/{id}/atualizar-transporte`.
2. O servidor le o token em `SPTRANS_TOKEN`. **Com token:** autentica no Olho Vivo
   (`POST /Login/Autenticar`), reutiliza a sessao (cookie) para `GET /Posicao` e
   deriva metricas reais (linhas monitoradas e veiculos em operacao). **Sem token:**
   usa o fallback de exemplo (sem tocar a rede), claramente rotulado como NAO tempo
   real.
3. O servidor persiste as medicoes de `transporte_publico` (com `fonte` indicando
   tempo real ou fallback) e as retorna ao cliente.
4. Em caso de falha de rede/HTTP com token, o servidor devolve um erro 502
   padronizado (nunca um 500 cru), e o cliente mostra uma mensagem amigavel.

Fluxo de atualizacao da qualidade do ar e do alagamento (Open-Meteo):

1. O cliente faz `POST /api/v1/regioes/{id}/atualizar-ar` ou `.../atualizar-alagamento`.
2. O servidor chama a Open-Meteo (via httpx) com a latitude/longitude da regiao.
3. O servidor persiste as novas medicoes (com `fonte` citando a Open-Meteo como
   dado operacional e a CETESB/QUALAR ou o CGE-SP como autoridade oficial de SP) e
   as retorna ao cliente.
4. Em caso de falha, o servidor devolve o mesmo 502 padronizado.

Fluxo da base geografica (IBGE):

1. O cliente/consumidor faz `GET /api/v1/localidades/sp`.
2. O servidor consulta a API de Localidades do IBGE (UF 35) e retorna os
   municipios de SP (id/nome/uf). Falha de rede tambem vira 502 padronizado.

## 4.2 Elementos do projeto (monorepo)

O repositorio e um monorepo com tres areas:

- `server/` - back-end (API REST em FastAPI + SQLite).
- `mobile/` - cliente movel (React Native/Expo em TypeScript).
- `docs/` - esta documentacao academica em Portugues-BR.

Alem disso, na raiz: `README.md`, `.gitignore`, o documento de requisitos
`APS_7_8_CC_2025_DSD.docx` e a declaracao de uso de IA (`DECLARACAO_IA.md`).

## 4.3 Ferramentas e bibliotecas (versao, link e onde foram aplicadas)

### Back-end (`server/requirements.txt`)

| Ferramenta | Versao | Link oficial | Onde foi aplicada |
| --- | --- | --- | --- |
| FastAPI | 0.115.6 | [fastapi.tiangolo.com](https://fastapi.tiangolo.com) | `server/app/main.py`, `server/app/routers/*` |
| Uvicorn (standard) | 0.32.1 | [uvicorn.org](https://www.uvicorn.org) | Execucao do servidor (capitulo 7) |
| SQLAlchemy | 2.0.36 | [sqlalchemy.org](https://www.sqlalchemy.org) | `server/app/database.py`, `server/app/models.py` |
| Pydantic | 2.10.4 | [docs.pydantic.dev](https://docs.pydantic.dev) | `server/app/schemas.py` |
| httpx | 0.28.1 | [python-httpx.org](https://www.python-httpx.org) | `server/app/services/*` (sptrans, openmeteo, flood, ibge, overpass) |
| pytest | 8.3.4 | [docs.pytest.org](https://docs.pytest.org) | `server/tests/*` |
| Python | 3.11 | [python.org](https://www.python.org) | Runtime do back-end |

Fontes de dados externas (recorte Sao Paulo):

- **SPTrans Olho Vivo** (transporte publico, fonte OFICIAL de SP, tempo real com
  token gratuito via `SPTRANS_TOKEN`)
  ([sptrans.com.br/desenvolvedores](https://www.sptrans.com.br/desenvolvedores/)),
  aplicada em `server/app/services/sptrans.py`. GTFS estatico da SPTrans citado
  como base do fallback.
- **Open-Meteo Air Quality API** (qualidade do ar, dado operacional)
  ([open-meteo.com/en/docs/air-quality-api](https://open-meteo.com/en/docs/air-quality-api)),
  aplicada em `server/app/services/openmeteo.py`. Autoridade oficial de SP citada:
  CETESB/QUALAR ([qualar.cetesb.sp.gov.br](https://qualar.cetesb.sp.gov.br)).
- **Open-Meteo Flood API / GloFAS** (alagamento, dado operacional)
  ([open-meteo.com/en/docs/flood-api](https://open-meteo.com/en/docs/flood-api)),
  aplicada em `server/app/services/flood.py`. Autoridade oficial de SP citada:
  CGE-SP ([cgesp.org](https://www.cgesp.org/)).
- **IBGE - API de Localidades** (base geografica oficial, UF 35)
  ([servicodados.ibge.gov.br/api/v1/localidades](https://servicodados.ibge.gov.br/api/v1/localidades)),
  aplicada em `server/app/services/ibge.py`.
- **Overpass API do OpenStreetMap** (transito LEGADO, dados ODbL)
  ([wiki.openstreetmap.org/wiki/Overpass_API](https://wiki.openstreetmap.org/wiki/Overpass_API)),
  aplicada em `server/app/services/overpass.py`.

### Cliente movel (`mobile/package.json`)

| Ferramenta | Versao | Link oficial | Onde foi aplicada |
| --- | --- | --- | --- |
| Expo (SDK) | 57 | [docs.expo.dev](https://docs.expo.dev) | Projeto todo; `mobile/app.json` |
| React Native | 0.86.3 | [reactnative.dev](https://reactnative.dev) | Telas e UI em `mobile/src/*` |
| React | 19.2.3 | [react.dev](https://react.dev) | Componentes do app |
| @react-navigation/native | 7.5.0 | [reactnavigation.org](https://reactnavigation.org) | `mobile/App.tsx` |
| @react-navigation/native-stack | 7.20.0 | [reactnavigation.org](https://reactnavigation.org) | `mobile/App.tsx` |
| react-native-maps | 1.27.2 | [github.com/react-native-maps](https://github.com/react-native-maps/react-native-maps) | `mobile/src/screens/MapaScreen.tsx` (enquadrado em SP) |
| react-native-chart-kit | 7.0.4 | [github.com/indiespirit/react-native-chart-kit](https://github.com/indiespirit/react-native-chart-kit) | `mobile/src/screens/RelatoriosScreen.tsx` (grafico de barras) |
| react-native-svg | 15.15.4 | [github.com/software-mansion/react-native-svg](https://github.com/software-mansion/react-native-svg) | Dependencia do chart-kit |
| react-native-screens | 4.26.2 | [github.com/software-mansion/react-native-screens](https://github.com/software-mansion/react-native-screens) | Dependencia da navegacao |
| react-native-safe-area-context | 5.7.0 | [github.com/th3rdwave/react-native-safe-area-context](https://github.com/th3rdwave/react-native-safe-area-context) | `mobile/App.tsx` (SafeAreaProvider) |
| TypeScript | 5.9 | [typescriptlang.org](https://www.typescriptlang.org) | Todo o codigo `mobile/` |

## 4.4 Passo a passo do desenvolvimento

O desenvolvimento desta versao de Sao Paulo seguiu etapas incrementais, cada uma
deixando o repositorio em estado funcional (baseline verde: pytest do back-end e
`npx tsc --noEmit` do mobile):

1. **Base geografica oficial (IBGE).** Servico `services/ibge.py` consumindo a API
   de Localidades do IBGE (UF 35), endpoint `GET /api/v1/localidades/sp`, e seed
   recentrado em distritos reais da capital (Se, Pinheiros, Mooca, Santana,
   Itaquera) com coordenadas de fontes oficiais da PMSP (GeoSampa).

2. **Reorientacao de ar e alagamento para SP.** Servicos `services/openmeteo.py` e
   `services/flood.py` passam a citar a CETESB/QUALAR e o CGE-SP como autoridades
   oficiais de SP no campo `fonte`, mantendo a Open-Meteo como dado operacional.

3. **Transporte publico oficial (SPTrans Olho Vivo).** Novo servico
   `services/sptrans.py` com autenticacao por token (`SPTRANS_TOKEN`), sessao via
   cookie reutilizando o mesmo `httpx.Client`, derivacao de metricas reais do
   `GET /Posicao` e fallback de exemplo rotulado. Novo valor `transporte_publico`
   no enum `TipoMedicao` e endpoint
   `POST /api/v1/regioes/{id}/atualizar-transporte` em `routers/medicoes.py`.

4. **Cliente movel reorientado para SP.** Mapa enquadrado na cidade de Sao Paulo;
   rotulos PT-BR do novo tipo em `src/ui/rotulos.ts`; `atualizarTransporte()` em
   `src/api/client.ts`; relatorios e detalhe suportando `transporte_publico`;
   grafico de barras com react-native-chart-kit em `RelatoriosScreen.tsx`.

5. **Testes.** Suite pytest ampliada com `test_ibge.py` e `test_transporte.py`,
   mais fixtures `ibge_municipios_sample.json` e `sptrans_posicao_sample.json`. A
   rede e o token sao SEMPRE mockados.

6. **Documentacao academica (este conjunto de arquivos em `docs/`).**
   Cobertura de toda a estrutura exigida pela APS, com links de referencia, o
   mapeamento fonte -> arquivo/funcao e o passo a passo do token da SPTrans.

## 4.5 Convencoes e requisito de rastreabilidade

- Idioma Portugues-BR em toda a documentacao; codigo em ingles com comentarios em
  Portugues.
- Cada tecnologia/biblioteca/API citada tem link de referencia real e a indicacao
  de onde foi aplicada (ver tabelas acima e `08_bibliografia.md`).
- O campo `fonte` de cada medicao no banco registra a origem do dado (SPTrans Olho
  Vivo tempo real ou fallback de exemplo; Open-Meteo Air Quality com CETESB/QUALAR;
  Open-Meteo Flood/GloFAS com CGE-SP), reforcando a rastreabilidade tambem em tempo
  de execucao.
- Nenhum token real aparece no codigo ou nesta documentacao: a SPTrans e acessada
  via `SPTRANS_TOKEN` (variavel de ambiente), e o passo a passo de obtencao esta em
  `07_apresentacao_do_programa.md`.
