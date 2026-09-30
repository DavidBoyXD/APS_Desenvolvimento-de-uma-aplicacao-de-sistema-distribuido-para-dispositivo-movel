# 5. Projeto: estrutura e modulos

Este capitulo descreve a estrutura real de diretorios do repositorio e o papel de
cada modulo. Os nomes de arquivos e funcoes correspondem ao codigo efetivamente
presente no projeto.

## 5.1 Estrutura de diretorios

```
APS_Desenvolvimento-de-uma-aplicacao-de-sistema-distribuido-para-dispositivo-movel/
├── APS_7_8_CC_2025_DSD.docx        # documento de requisitos original (mantido)
├── README.md
├── .gitignore
├── docs/                           # documentacao academica (este material)
│   ├── 00_LEIA-ME.md
│   ├── 01_objetivo_e_motivacao.md
│   ├── 02_introducao.md
│   ├── 03_fundamentos_tecnologias_moveis.md
│   ├── 04_plano_de_desenvolvimento.md
│   ├── 05_projeto_estrutura_e_modulos.md
│   ├── 06_relatorio_de_codigo.md
│   ├── 07_apresentacao_do_programa.md
│   ├── 08_bibliografia.md
│   ├── 09_declaracao_uso_ia.md
│   └── 10_capa_e_ficha_aps.md
├── server/                         # BACK-END (API REST FastAPI + SQLite)
│   ├── requirements.txt            # dependencias fixadas por versao
│   ├── conftest.py                 # configuracao dos testes (banco em memoria)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # entrypoint FastAPI, CORS, startup/seed
│   │   ├── database.py             # engine/sessao SQLAlchemy (SQLite)
│   │   ├── models.py               # modelos ORM: Regiao, Medicao, Alerta
│   │   ├── schemas.py              # schemas Pydantic (contrato da API)
│   │   ├── errors.py               # exception handlers globais (PT-BR)
│   │   ├── seed.py                 # populacao inicial idempotente
│   │   ├── services/
│   │   │   ├── openmeteo.py        # integracao Open-Meteo (httpx)
│   │   │   └── overpass.py         # integracao Overpass/OpenStreetMap (httpx)
│   │   └── routers/
│   │       ├── saude.py            # GET /api/v1/saude
│   │       ├── regioes.py          # GET regioes (mapa) + helper 404
│   │       ├── medicoes.py         # listar/filtrar + atualizar-ar + atualizar-transito
│   │       ├── relatorios.py       # agregacoes por regiao
│   │       └── alertas.py          # regras e avaliacao de alertas
│   └── tests/                      # suite pytest
│       ├── __init__.py
│       ├── test_health.py
│       ├── test_regioes.py
│       ├── test_medicoes.py
│       ├── test_transito.py
│       ├── test_relatorios.py
│       ├── test_alertas.py
│       └── fixtures/
│           ├── openmeteo_sample.json
│           └── overpass_sample.json
└── mobile/                         # CLIENTE MOVEL (React Native / Expo)
    ├── app.json                    # config Expo (nome "Monitor Ambiental Urbano")
    ├── package.json                # dependencias e scripts
    ├── tsconfig.json               # config TypeScript (strict)
    ├── index.ts                    # registro do componente raiz (Expo)
    ├── App.tsx                     # navegacao e registro das telas
    └── src/
        ├── types.ts                # tipos espelhando os schemas da API
        ├── navigation.ts           # tipos das rotas do stack
        ├── api/
        │   └── client.ts           # cliente HTTP tipado (fetch)
        ├── screens/
        │   ├── MapaScreen.tsx
        │   ├── DetalheScreen.tsx
        │   ├── RelatoriosScreen.tsx
        │   └── AlertasScreen.tsx
        └── ui/
            ├── estados.tsx         # EstadoCarregando/EstadoErro/EstadoVazio
            └── rotulos.ts          # rotulos PT-BR e formatacao pt-BR
```

Observacao: `server/data/app.db` (banco SQLite) e `mobile/node_modules/` sao
gerados em runtime/instalacao e estao no `.gitignore` (nao versionados).

## 5.2 Modelo de dados generico de "medicao ambiental por tipo"

O coracao do dominio esta em `server/app/models.py`. O modelo e **generico**: em
vez de uma tabela por assunto (ar, transito, alagamento), ha uma unica tabela
`Medicao` que representa qualquer observacao ambiental, distinguida por um
**tipo** e um **parametro**. Isso permite adicionar novos assuntos sem mudar o
esquema.

Entidades:

- **Regiao** (tabela `regioes`): local monitorado. Campos: `id`, `nome`,
  `cidade`, `uf`, `latitude`, `longitude`. As coordenadas alimentam os marcadores
  do mapa no cliente.
- **Medicao** (tabela `medicoes`): um valor observado. Campos: `id`, `regiao_id`
  (FK), `tipo` (enum `qualidade_ar` | `transito` | `alagamento`), `parametro`
  (string livre, ex.: `pm2_5`, `pm10`, `nivel_congestionamento`, `nivel_agua`),
  `valor` (float), `unidade`, `timestamp` (com fuso), `fonte` (origem do dado).
- **Alerta** (tabela `alertas`): regra de limiar. Campos: `id`, `regiao_id` (FK),
  `tipo`, `parametro`, `limiar` (float), `condicao` (`>` ou `<`), `ativo` (bool),
  `mensagem`.

O enum `TipoMedicao` (em `models.py`) fixa os tres tipos suportados. Como o
`parametro` e uma string, o mesmo tipo pode ter varios parametros (por exemplo,
`qualidade_ar` com `pm2_5`, `pm10`, `carbon_monoxide`, `nitrogen_dioxide`,
`ozone`). O campo `fonte` documenta, por linha, se o dado e real (Open-Meteo para
qualidade do ar; Overpass/OpenStreetMap para transito) ou simulado (alagamento).

## 5.3 Modulos do back-end (`server/app/`)

- **`main.py`** - cria a aplicacao FastAPI (titulo/descricao em PT-BR, visiveis no
  Swagger em `/docs`), habilita CORS (para o app Expo consumir), registra os
  exception handlers e os routers, e no `lifespan` de startup cria as tabelas e
  executa o seed idempotente. Mantem `GET /health`. **Nota de seguranca (CORS):**
  o CORS esta configurado com `allow_origins=["*"]` de forma proposital apenas
  para o contexto de desenvolvimento/APS, em que o endereco do cliente varia
  (emulador Android, dispositivo fisico, web). Em um cenario de producao, essa
  lista deve ser restringida aos dominios/hosts confiaveis do aplicativo. O
  proprio `main.py` traz esse aviso em comentario no ponto da configuracao.
- **`database.py`** - configura o engine SQLAlchemy 2.x apontando para o SQLite em
  `server/data/app.db` (cria o diretorio se preciso), a `SessionLocal`, a `Base`
  declarativa e a dependencia `get_db` (uma sessao por requisicao). Documenta no
  proprio codigo como migrar para PostgreSQL trocando a URL do engine.
- **`models.py`** - modelos ORM descritos na secao 5.2.
- **`schemas.py`** - schemas Pydantic v2 (entrada/saida) e o schema de erro
  padronizado `ErroResposta` (`codigo`, `mensagem`, `detalhe`). Inclui variantes
  `Create`/`Read`, `AlertaDisparado`, `ResumoParametro` e `RelatorioRegiao`.
- **`errors.py`** - funcao `registrar_handlers` que instala tres handlers globais:
  para `HTTPException` (ex.: 404), para `RequestValidationError` (422) e um
  generico para `Exception` (500 tratado), todos respondendo no formato
  `ErroResposta` com mensagens em PT-BR.
- **`services/openmeteo.py`** - integracao com a Open-Meteo Air Quality API.
  Define a URL/endpoint, os poluentes solicitados, a funcao `mapear_payload` (que
  extrai a leitura horaria mais recente nao nula por parametro) e
  `buscar_qualidade_ar` (faz a chamada HTTP com httpx e converte qualquer falha em
  `OpenMeteoError`).
- **`services/overpass.py`** - integracao com a Overpass API do OpenStreetMap
  (fonte real de transito, dados sob licenca ODbL). Espelha o padrao do
  `openmeteo.py`: define a URL/endpoint, a query Overpass QL (vias principais em
  um raio ao redor da regiao), a funcao `mapear_payload` (que deriva
  `vias_principais`, `faixas_media` e `velocidade_maxima_media` a partir das tags
  das vias) e `buscar_transito` (faz o POST com httpx enviando o header
  `User-Agent` obrigatorio e converte qualquer falha em `OverpassError`).
- **`seed.py`** - `executar_seed` popula o banco (se vazio) com 3 regioes reais
  (Sao Paulo/SP, Rio de Janeiro/RJ, Curitiba/PR) e, para cada uma, medicoes seed
  dos tres tipos e duas regras de alerta (PM2.5 > 25 e nivel_agua > 0.5).
- **`routers/`** - endpoints agrupados por dominio (detalhados no capitulo 6):
  - `saude.py`: `GET /api/v1/saude`.
  - `regioes.py`: `GET /api/v1/regioes`, `GET /api/v1/regioes/{id}` e o helper
    `obter_regiao_ou_404` (reusado pelos demais routers).
  - `medicoes.py`: `GET /api/v1/medicoes` (filtros por regiao/tipo),
    `GET /api/v1/regioes/{id}/medicoes`, `POST /api/v1/regioes/{id}/atualizar-ar`
    (qualidade do ar via Open-Meteo) e
    `POST /api/v1/regioes/{id}/atualizar-transito` (transito via Overpass/
    OpenStreetMap).
  - `relatorios.py`: `GET /api/v1/relatorios/regiao/{id}` (agregacoes).
  - `alertas.py`: `GET /api/v1/alertas`, `POST /api/v1/alertas`,
    `GET /api/v1/alertas/avaliar/{regiao_id}`.

## 5.4 Modulos do cliente movel (`mobile/`)

- **`App.tsx`** - componente raiz. Envolve o app em `SafeAreaProvider` e
  `NavigationContainer`, cria um stack nativo e registra as quatro telas com
  titulos em PT-BR.
- **`src/navigation.ts`** - define `RootStackParamList` com as rotas e seus
  parametros (`Mapa`, `Detalhe`, `Relatorios`, `Alertas`).
- **`src/types.ts`** - interfaces TypeScript que espelham os schemas da API
  (`Regiao`, `Medicao`, `Alerta`, `AlertaCreate`, `AlertaDisparado`,
  `ResumoRelatorio`, `RelatorioRegiao`, `ErroResposta`; e os tipos `TipoMedicao`
  e `CondicaoAlerta`).
- **`src/api/client.ts`** - cliente HTTP tipado com `fetch`. Define
  `API_BASE_URL` (default `http://10.0.2.2:8000` para emulador Android),
  a classe `ApiError` (mensagem PT-BR pronta para a UI), timeout via
  `AbortController` e as funcoes `getRegioes`, `getRegiao`, `getMedicoes`,
  `atualizarAr`, `getRelatorio`, `getAlertas`, `criarAlerta`, `avaliarAlertas`.
- **`src/screens/MapaScreen.tsx`** - tela inicial. Carrega as regioes, plota
  marcadores no `MapView` (react-native-maps) por latitude/longitude e mantem uma
  lista clicavel como alternativa. Trata carregamento, erro e vazio.
- **`src/screens/DetalheScreen.tsx`** - medicoes da regiao agrupadas por tipo em
  uma `SectionList`, com botao "Atualizar qualidade do ar" (chama `atualizarAr`) e
  acesso ao relatorio.
- **`src/screens/RelatoriosScreen.tsx`** - consome o relatorio agregado e mostra
  media, minimo, maximo, contagem e ultima leitura por parametro.
- **`src/screens/AlertasScreen.tsx`** - lista regras, formulario para criar uma
  regra (regiao, tipo, parametro, condicao, limiar, mensagem) e botao para avaliar
  os alertas de uma regiao, exibindo os disparados.
- **`src/ui/estados.tsx`** - componentes reutilizaveis de estado
  (`EstadoCarregando`, `EstadoErro` com "Tentar novamente", `EstadoVazio`).
- **`src/ui/rotulos.ts`** - rotulos em PT-BR para os tipos e formatacao numerica e
  de data/hora no padrao pt-BR.
