# 4. Plano de desenvolvimento da aplicação

Este capítulo descreve os elementos e ferramentas do projeto, o passo a passo do
desenvolvimento e a caracterização do sistema distribuído, incluindo um diagrama
textual do fluxo cliente <-> API <-> banco <-> serviços oficiais de São Paulo.

## 4.1 Caracterização do sistema distribuído

O sistema tem três componentes principais que rodam de forma autônoma e se
comunicam por rede, mais os serviços externos oficiais de dados:

```
+---------------------------+          HTTP / JSON (REST)          +----------------------------+
|   CLIENTE MOVEL           |  ----------------------------------> |   SERVIDOR (API REST)      |
|   React Native / Expo     |     GET/POST /api/v1/...             |   FastAPI (Python)         |
|   (Android / iOS)         | <----------------------------------  |                            |
|   lista de regioes de SP   |     respostas JSON (dados/erros)     |   - routers (regioes,      |
|                           |                                      |     medicoes, localidades, |
|   mobile/                 |                                      |     relatorios, alertas)   |
|   - MapaScreen (lista SP)  |                                      |   - schemas (Pydantic)     |
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
   |   -> migravel p/ Postgres|                        |  - IBGE Localidades (base geografica SP)  |
   |   Regiao / Medicao /     |                        |                                          |
   |   Alerta                 |                        +------------------------------------------+
   +--------------------------+
```

Fluxo de uma consulta típica (abrir uma região no app):

1. O usuário toca em uma região de São Paulo na lista (cliente móvel).
2. O cliente faz `GET /api/v1/regioes/{id}/medicoes` ao servidor (HTTP/JSON).
3. O servidor consulta o banco via SQLAlchemy e devolve a lista de medições.
4. O cliente exibe as medições de transporte público da região.

Fluxo de atualização do transporte público (SPTrans Olho Vivo):

1. O cliente faz `POST /api/v1/regioes/{id}/atualizar-transporte`.
2. O servidor lê o token em `SPTRANS_TOKEN`. **Com token:** autentica no Olho Vivo
   (`POST /Login/Autenticar`), reutiliza a sessão (cookie) para `GET /Posicao` e
   deriva métricas reais (linhas monitoradas e veículos em operação). **Sem token:**
   usa o fallback de exemplo (sem tocar a rede), claramente rotulado como NÃO tempo
   real.
3. O servidor persiste as medições de `transporte_publico` (com `fonte` indicando
   tempo real ou fallback) e as retorna ao cliente.
4. Em caso de falha de rede/HTTP com token, o servidor devolve um erro 502
   padronizado (nunca um 500 cru), e o cliente mostra uma mensagem amigável.

Fluxo da base geográfica (IBGE):

1. O cliente/consumidor faz `GET /api/v1/localidades/sp`.
2. O servidor consulta a API de Localidades do IBGE (UF 35) e retorna os
   municípios de SP (id/nome/uf). Falha de rede também vira 502 padronizado.

## 4.2 Elementos do projeto (monorepo)

O repositório é um monorepo com três áreas:

- `server/` - back-end (API REST em FastAPI + SQLite).
- `mobile/` - cliente móvel (React Native/Expo em TypeScript).
- `docs/` - esta documentação acadêmica em Português-BR.

Além disso, na raiz: `README.md`, `.gitignore`, o documento de requisitos
`APS_7_8_CC_2025_DSD.docx` e a declaração de uso de IA (`DECLARACAO_IA.md`).

## 4.3 Ferramentas e bibliotecas (versão, link e onde foram aplicadas)

### Back-end (`server/requirements.txt`)

| Ferramenta | Versão | Link oficial | Onde foi aplicada |
| --- | --- | --- | --- |
| FastAPI | 0.115.6 | [fastapi.tiangolo.com](https://fastapi.tiangolo.com) | `server/app/main.py`, `server/app/routers/*` |
| Uvicorn (standard) | 0.32.1 | [uvicorn.org](https://www.uvicorn.org) | Execução do servidor (capítulo 7) |
| SQLAlchemy | 2.0.36 | [sqlalchemy.org](https://www.sqlalchemy.org) | `server/app/database.py`, `server/app/models.py` |
| Pydantic | 2.10.4 | [docs.pydantic.dev](https://docs.pydantic.dev) | `server/app/schemas.py` |
| httpx | 0.28.1 | [python-httpx.org](https://www.python-httpx.org) | `server/app/services/*` (sptrans, ibge) |
| pytest | 8.3.4 | [docs.pytest.org](https://docs.pytest.org) | `server/tests/*` |
| Python | 3.11 | [python.org](https://www.python.org) | Runtime do back-end |

Fontes de dados externas (recorte São Paulo):

- **SPTrans Olho Vivo** (transporte público, fonte OFICIAL de SP, tempo real com
  token gratuito via `SPTRANS_TOKEN`)
  ([sptrans.com.br/desenvolvedores](https://www.sptrans.com.br/desenvolvedores/)),
  aplicada em `server/app/services/sptrans.py`. GTFS estático da SPTrans citado
  como base do fallback.
- **IBGE - API de Localidades** (base geográfica oficial, UF 35)
  ([servicodados.ibge.gov.br/api/v1/localidades](https://servicodados.ibge.gov.br/api/v1/localidades)),
  aplicada em `server/app/services/ibge.py`.

### Cliente móvel (`mobile/package.json`)

| Ferramenta | Versão | Link oficial | Onde foi aplicada |
| --- | --- | --- | --- |
| Expo (SDK) | 58 | [docs.expo.dev](https://docs.expo.dev) | Projeto todo; `mobile/app.json` |
| React Native | 0.88.1 | [reactnative.dev](https://reactnative.dev) | Telas e UI em `mobile/src/*` |
| React | 19.3.0 | [react.dev](https://react.dev) | Componentes do app |
| @react-navigation/native | 7.5.0 | [reactnavigation.org](https://reactnavigation.org) | `mobile/App.tsx` |
| @react-navigation/native-stack | 7.20.0 | [reactnavigation.org](https://reactnavigation.org) | `mobile/App.tsx` |
| react-native-webview | 14.0.1 | [docs.expo.dev](https://docs.expo.dev/versions/v58.0.0/sdk/webview/) | `mobile/src/screens/MapaVisualScreen.tsx` (mapa Leaflet/OSM) |
| @react-native-async-storage/async-storage | 2.2.0 | [react-native-async-storage.github.io/async-storage](https://react-native-async-storage.github.io/async-storage/) | `mobile/src/ui/favoritos.ts`, `mobile/src/ui/consentimento.ts` |
| expo-location | ~58.0.20 | [docs.expo.dev](https://docs.expo.dev/versions/v58.0.0/sdk/location/) | `mobile/src/ui/localizacao.ts`, `MapaVisualScreen.tsx` ("Você está aqui") |
| react-native-screens | ~4.30.1 | [github.com/software-mansion/react-native-screens](https://github.com/software-mansion/react-native-screens) | Dependência da navegação |
| react-native-safe-area-context | ~5.11.1 | [github.com/th3rdwave/react-native-safe-area-context](https://github.com/th3rdwave/react-native-safe-area-context) | `mobile/App.tsx` (SafeAreaProvider) |
| TypeScript | ~6.0.3 | [typescriptlang.org](https://www.typescriptlang.org) | Todo o código `mobile/` |

## 4.4 Passo a passo do desenvolvimento

O desenvolvimento seguiu etapas incrementais, cada uma deixando o repositório em
estado funcional (baseline verde: pytest do back-end e `npx tsc --noEmit` do
mobile):

1. **Base geográfica oficial (IBGE).** Serviço `services/ibge.py` consumindo a API
   de Localidades do IBGE (UF 35), endpoint `GET /api/v1/localidades/sp`, e seed
   centrado em distritos reais da capital (Sé, Pinheiros, Mooca, Santana,
   Itaquera) com coordenadas de fontes oficiais da PMSP (GeoSampa).

2. **Transporte público oficial (SPTrans Olho Vivo).** Serviço
   `services/sptrans.py` com autenticação por token (`SPTRANS_TOKEN`), sessão via
   cookie reutilizando o mesmo `httpx.Client`, derivação de métricas reais do
   `GET /Posicao` e fallback de exemplo rotulado. Tipo `transporte_publico` no
   enum `TipoMedicao` e endpoint `POST /api/v1/regioes/{id}/atualizar-transporte`
   em `routers/medicoes.py`.

3. **Cliente móvel.** Lista de regiões da cidade de São Paulo; rótulos PT-BR do
   tipo em `src/ui/rotulos.ts`; `atualizarTransporte()` em `src/api/client.ts`;
   detalhe e relatórios para `transporte_publico`; gráfico de barras horizontais
   renderizado com `View` em `RelatoriosScreen.tsx`.

4. **Testes.** Suíte pytest com `test_ibge.py` e `test_transporte.py`, mais
   fixtures `ibge_municipios_sample.json` e `sptrans_posicao_sample.json`. A rede
   e o token são SEMPRE mockados.

5. **Documentação acadêmica (este conjunto de arquivos em `docs/`).**
   Cobertura de toda a estrutura exigida pela APS, com links de referência, o
   mapeamento fonte -> arquivo/função e o passo a passo do token da SPTrans.

## 4.5 Convenções e requisito de rastreabilidade

- Idioma Português-BR em toda a documentação; código em inglês com comentários em
  Português.
- Cada tecnologia/biblioteca/API citada tem link de referência real e a indicação
  de onde foi aplicada (ver tabelas acima e `08_bibliografia.md`).
- O campo `fonte` de cada medição no banco registra a origem do dado (SPTrans Olho
  Vivo tempo real ou fallback de exemplo), reforçando a rastreabilidade também em
  tempo de execução.
- Nenhum token real aparece no código ou nesta documentação: a SPTrans é acessada
  via `SPTRANS_TOKEN` (variável de ambiente), e o passo a passo de obtenção está em
  `07_apresentacao_do_programa.md`.
