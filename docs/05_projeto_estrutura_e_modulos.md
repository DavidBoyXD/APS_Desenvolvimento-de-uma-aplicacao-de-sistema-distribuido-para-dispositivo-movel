# 5. Projeto: estrutura e modulos

Este capitulo descreve a estrutura real de diretorios do repositorio e o papel de
cada modulo. Os nomes de arquivos e funcoes correspondem ao codigo efetivamente
presente no projeto.

## 5.1 Estrutura de diretorios

```
APS_Desenvolvimento-de-uma-aplicacao-de-sistema-distribuido-para-dispositivo-movel/
├── APS_7_8_CC_2025_DSD.docx        # documento de requisitos original (mantido)
├── README.md
├── DECLARACAO_IA.md
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
│   │   ├── models.py               # modelos ORM: Regiao, Medicao, Alerta + enum
│   │   ├── schemas.py              # schemas Pydantic (contrato da API)
│   │   ├── errors.py               # exception handlers globais (PT-BR)
│   │   ├── seed.py                 # populacao inicial idempotente (regioes de SP)
│   │   ├── services/
│   │   │   ├── sptrans.py          # SPTrans Olho Vivo (transporte, token + fallback)
│   │   │   └── ibge.py             # IBGE Localidades (base geografica SP, UF 35)
│   │   └── routers/
│   │       ├── saude.py            # GET /health e /api/v1/saude
│   │       ├── regioes.py          # GET regioes (mapa) + helper 404
│   │       ├── localidades.py      # GET /api/v1/localidades/sp (IBGE)
│   │       ├── medicoes.py         # listar/filtrar + atualizar-transporte
│   │       ├── relatorios.py       # agregacoes por regiao
│   │       └── alertas.py          # regras e avaliacao de alertas
│   └── tests/                      # suite pytest
│       ├── __init__.py
│       ├── test_health.py
│       ├── test_regioes.py
│       ├── test_medicoes.py
│       ├── test_transporte.py      # SPTrans (token mockado + fallback)
│       ├── test_ibge.py            # IBGE Localidades (rede mockada)
│       ├── test_relatorios.py
│       ├── test_alertas.py
│       └── fixtures/
│           ├── sptrans_posicao_sample.json
│           └── ibge_municipios_sample.json
└── mobile/                         # CLIENTE MOVEL (React Native / Expo)
    ├── app.json                    # config Expo
    ├── package.json                # dependencias e scripts
    ├── tsconfig.json               # config TypeScript (strict)
    ├── index.ts                    # registro do componente raiz (Expo)
    ├── App.tsx                     # navegacao e registro das telas
    └── src/
        ├── types.ts                # tipos espelhando os schemas da API
        ├── navigation.ts           # tipos das rotas do stack
        ├── api/
        │   └── client.ts           # cliente HTTP tipado (fetch) + atualizarTransporte()
        ├── screens/
        │   ├── MapaScreen.tsx       # mapa enquadrado em SP
        │   ├── DetalheScreen.tsx    # transporte publico + botao "Atualizar transporte"
        │   ├── RelatoriosScreen.tsx # grafico de barras + transporte_publico
        │   └── AlertasScreen.tsx
        └── ui/
            ├── estados.tsx         # EstadoCarregando/EstadoErro/EstadoVazio
            └── rotulos.ts          # rotulos PT-BR (transporte_publico)
```

Observacao: `server/data/app.db` (banco SQLite) e `mobile/node_modules/` sao
gerados em runtime/instalacao e estao no `.gitignore` (nao versionados). As pastas
`mobile/ios` e `mobile/android`, quando existem, sao geradas por Continuous Native
Generation e nao devem ser editadas a mao.

## 5.2 Modelo de dados generico de "medicao por tipo"

O coracao do dominio esta em `server/app/models.py`. O modelo e **generico**: em
vez de uma tabela por assunto, ha uma unica tabela `Medicao` que representa
qualquer observacao urbana, distinguida por um **tipo** e um **parametro**. Isso
mantem o esquema aberto a extensoes futuras sem alterar as tabelas.

Entidades:

- **Regiao** (tabela `regioes`): local monitorado em Sao Paulo. Campos: `id`,
  `nome`, `cidade`, `uf`, `latitude`, `longitude`. As coordenadas alimentam os
  marcadores do mapa no cliente.
- **Medicao** (tabela `medicoes`): um valor observado. Campos: `id`, `regiao_id`
  (FK), `tipo` (enum `transporte_publico`), `parametro` (string livre, ex.:
  `linhas_monitoradas`, `veiculos_em_operacao`, `linhas_exemplo`), `valor`
  (float), `unidade`, `timestamp` (com fuso), `fonte` (origem do dado).
- **Alerta** (tabela `alertas`): regra de limiar. Campos: `id`, `regiao_id` (FK),
  `tipo`, `parametro`, `limiar` (float), `condicao` (`>` ou `<`), `ativo` (bool),
  `mensagem`.

O enum `TipoMedicao` (em `models.py`) fixa os tipos suportados; nesta aplicacao,
apenas `transporte_publico` (SPTrans Olho Vivo). Como o `parametro` e uma string,
o mesmo tipo pode ter varios parametros. O campo `fonte` documenta, por linha, a
origem do dado.

## 5.3 Modulos do back-end (`server/app/`)

- **`main.py`** - cria a aplicacao FastAPI (titulo "API Transporte Publico SP -
  APS SD", visivel no Swagger em `/docs`), habilita CORS (para o app Expo
  consumir), registra os exception handlers e os routers (incluindo
  `localidades.py`), e no `lifespan` de startup cria as tabelas e executa o seed
  idempotente. Mantem `GET /health`.
- **`database.py`** - configura o engine SQLAlchemy 2.x apontando para o SQLite em
  `server/data/app.db`, a `SessionLocal`, a `Base` declarativa e a dependencia
  `get_db` (uma sessao por requisicao). Documenta no proprio codigo como migrar
  para PostgreSQL trocando a URL do engine.
- **`models.py`** - modelos ORM descritos na secao 5.2 (enum com apenas
  `transporte_publico`).
- **`schemas.py`** - schemas Pydantic v2 (entrada/saida), o schema de erro
  padronizado `ErroResposta` (`codigo`, `mensagem`, `detalhe`) e o `MunicipioSPRead`
  (resposta do endpoint de localidades do IBGE).
- **`errors.py`** - instala handlers globais para `HTTPException` (ex.: 404 e
  502), `RequestValidationError` (422) e um generico para `Exception` (500
  tratado), todos respondendo no formato `ErroResposta` em PT-BR.
- **`services/sptrans.py`** - integracao com a SPTrans Olho Vivo (fonte OFICIAL de
  transporte publico de SP). Le o token de `SPTRANS_TOKEN` (`obter_token`),
  autentica (`_autenticar`, estabelecendo a sessao via cookie), deriva metricas
  reais do `GET /Posicao` (`mapear_payload`: `linhas_monitoradas` e
  `veiculos_em_operacao`) e, sem token, retorna o fallback de exemplo
  (`_leituras_fallback`: `linhas_exemplo`). Expoe `FONTE` (tempo real) e
  `FONTE_FALLBACK` (exemplo). Converte qualquer `httpx.HTTPError` em `SPTransError`.
- **`services/ibge.py`** - integracao com a API de Localidades do IBGE (base
  geografica OFICIAL, UF 35 = SP). Define `IBGE_MUNICIPIOS_SP_URL`, `mapear_payload`
  (le a LISTA de municipios, extraindo `id`, `nome` e a sigla da UF dos blocos
  aninhados) e `buscar_municipios_sp`. Converte falhas em `IbgeError`.
- **`seed.py`** - `executar_seed` popula o banco (se vazio) com 5 regioes reais de
  Sao Paulo/SP (distritos da capital: Se, Pinheiros, Mooca, Santana, Itaquera) com
  coordenadas reais de fontes oficiais da PMSP (GeoSampa) e nome validavel pelo
  IBGE (codigo 35 / 3550308). Para cada regiao gera uma medicao-semente de
  transporte publico de EXEMPLO (`veiculos_em_operacao`) e uma regra de alerta
  (`veiculos_em_operacao > 300`). Os valores de seed sao apenas exemplos iniciais;
  o campo `fonte` aponta a fonte real substituivel. Idempotente.
- **`routers/`** - endpoints agrupados por dominio (detalhados no capitulo 6):
  - `saude.py`: `GET /health` e `GET /api/v1/saude`.
  - `regioes.py`: `GET /api/v1/regioes`, `GET /api/v1/regioes/{id}` e o helper
    `obter_regiao_ou_404` (reusado pelos demais routers).
  - `localidades.py`: `GET /api/v1/localidades/sp` (municipios de SP via IBGE).
  - `medicoes.py`: `GET /api/v1/medicoes` (filtros por regiao/tipo),
    `GET /api/v1/regioes/{id}/medicoes` e
    `POST /api/v1/regioes/{id}/atualizar-transporte` (SPTrans Olho Vivo, token +
    fallback).
  - `relatorios.py`: `GET /api/v1/relatorios/regiao/{id}` (agregacoes).
  - `alertas.py`: `GET /api/v1/alertas`, `POST /api/v1/alertas`,
    `GET /api/v1/alertas/avaliar/{regiao_id}`.

## 5.4 Modulos do cliente movel (`mobile/`)

- **`App.tsx`** - componente raiz. Envolve o app em `SafeAreaProvider` e
  `NavigationContainer`, cria um stack nativo (React Navigation) e registra as
  telas com titulos em PT-BR.
- **`src/navigation.ts`** - define `RootStackParamList` com as rotas e seus
  parametros (`Mapa`, `Detalhe`, `Relatorios`, `Alertas`).
- **`src/types.ts`** - interfaces TypeScript que espelham os schemas da API,
  incluindo o tipo `transporte_publico` em `TipoMedicao`.
- **`src/api/client.ts`** - cliente HTTP tipado com `fetch`. Define
  `API_BASE_URL` (default `http://10.0.2.2:8000` para emulador Android), a classe
  `ApiError` (mensagem PT-BR pronta para a UI), timeout via `AbortController` e as
  funcoes `getRegioes`, `getRegiao`, `getMedicoes`, **`atualizarTransporte`**,
  `getRelatorio`, `getAlertas`, `criarAlerta`, `avaliarAlertas`.
- **`src/screens/MapaScreen.tsx`** - tela inicial. Carrega as regioes, plota
  marcadores no `MapView` (react-native-maps) por latitude/longitude com o
  enquadramento inicial centrado na cidade de Sao Paulo (`REGIAO_INICIAL`:
  lat -23.55, lon -46.63, delta ~0.3) e mantem uma lista clicavel ("Regioes
  monitoradas em Sao Paulo") como alternativa. Trata carregamento, erro e vazio.
- **`src/screens/DetalheScreen.tsx`** - medicoes de transporte publico da regiao,
  com o botao **"Atualizar transporte"** (chama
  `POST /api/v1/regioes/{id}/atualizar-transporte`) e acesso ao relatorio.
- **`src/screens/RelatoriosScreen.tsx`** - consome o relatorio agregado e mostra
  media, minimo, maximo, contagem e ultima leitura por parametro em cards. No topo,
  apresenta um **grafico de barras** ("Medias por parametro") com `BarChart` do
  **react-native-chart-kit** (que depende de **react-native-svg**), largura
  calculada com `useWindowDimensions` e renderizado como `ListHeaderComponent` da
  `FlatList`. Trata dataset vazio.
- **`src/screens/AlertasScreen.tsx`** - lista regras, formulario para criar uma
  regra (com o tipo `transporte_publico`) e botao para avaliar os alertas de uma
  regiao.
- **`src/ui/estados.tsx`** - componentes reutilizaveis de estado
  (`EstadoCarregando`, `EstadoErro` com "Tentar novamente", `EstadoVazio`).
- **`src/ui/rotulos.ts`** - rotulos em PT-BR do tipo ("Transporte publico
  (SPTrans)") e dos parametros do transporte publico (`linhas_monitoradas` ->
  "Linhas monitoradas", `veiculos_em_operacao` -> "Veiculos em operacao",
  `linhas_exemplo` -> "Linhas (exemplo, sem token)"), alem da formatacao numerica
  e de data/hora no padrao pt-BR.
