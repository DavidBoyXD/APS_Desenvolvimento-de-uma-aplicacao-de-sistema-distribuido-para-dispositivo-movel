# 5. Projeto: estrutura e módulos

Este capítulo descreve a estrutura real de diretórios do repositório e o papel de
cada módulo. Os nomes de arquivos e funções correspondem ao código efetivamente
presente no projeto.

## 5.1 Estrutura de diretórios

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
│   │       ├── regioes.py          # GET regioes (lista) + helper 404
│   │       ├── localidades.py      # GET /api/v1/localidades/sp (IBGE)
│   │       ├── medicoes.py         # listar/filtrar + atualizar-transporte
│   │       ├── linhas.py           # busca de linhas/paradas + posicao/previsao
│   │       ├── relatorios.py       # agregacoes por regiao
│   │       └── alertas.py          # regras e avaliacao de alertas
│   └── tests/                      # suite pytest
│       ├── __init__.py
│       ├── test_health.py
│       ├── test_regioes.py
│       ├── test_medicoes.py
│       ├── test_transporte.py      # SPTrans (token mockado + fallback)
│       ├── test_linhas.py          # linhas/paradas, posicao e previsao (mock)
│       ├── test_ibge.py            # IBGE Localidades (rede mockada)
│       ├── test_relatorios.py
│       ├── test_alertas.py
│       └── fixtures/
│           ├── sptrans_posicao_sample.json
│           ├── sptrans_linha_buscar_sample.json
│           ├── sptrans_posicao_linha_sample.json
│           ├── sptrans_previsao_linha_sample.json
│           ├── sptrans_parada_buscar_sample.json
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
        │   ├── MapaScreen.tsx       # lista de regioes de SP + botoes de acao
        │   ├── DetalheScreen.tsx    # transporte publico + botao "Atualizar transporte"
        │   ├── RelatoriosScreen.tsx # grafico de barras + transporte_publico
        │   ├── AlertasScreen.tsx
        │   ├── LinhasScreen.tsx     # busca de linhas/paradas + posicao/previsao
        │   └── MapaVisualScreen.tsx # mapa visual opcional (regioes/veiculos)
        └── ui/
            ├── estados.tsx         # EstadoCarregando/EstadoErro/EstadoVazio
            ├── webview.ts          # carregamento defensivo do react-native-webview
            └── rotulos.ts          # rotulos PT-BR (transporte_publico)
```

Observação: `server/data/app.db` (banco SQLite) e `mobile/node_modules/` são
gerados em runtime/instalação e estão no `.gitignore` (não versionados). As pastas
`mobile/ios` e `mobile/android`, quando existem, são geradas por Continuous Native
Generation e não devem ser editadas à mão.

## 5.2 Modelo de dados genérico de "medição por tipo"

O coração do domínio está em `server/app/models.py`. O modelo é **genérico**: em
vez de uma tabela por assunto, há uma única tabela `Medicao` que representa
qualquer observação urbana, distinguida por um **tipo** e um **parâmetro**. Isso
mantém o esquema aberto a extensões futuras sem alterar as tabelas.

Entidades:

- **Regiao** (tabela `regioes`): local monitorado em São Paulo. Campos: `id`,
  `nome`, `cidade`, `uf`, `latitude`, `longitude`. As coordenadas são exibidas na
  lista de regiões do cliente.
- **Medicao** (tabela `medicoes`): um valor observado. Campos: `id`, `regiao_id`
  (FK), `tipo` (enum `transporte_publico`), `parametro` (string livre, ex.:
  `linhas_monitoradas`, `veiculos_em_operacao`, `linhas_exemplo`), `valor`
  (float), `unidade`, `timestamp` (com fuso), `fonte` (origem do dado).
- **Alerta** (tabela `alertas`): regra de limiar. Campos: `id`, `regiao_id` (FK),
  `tipo`, `parametro`, `limiar` (float), `condicao` (`>` ou `<`), `ativo` (bool),
  `mensagem`.

O enum `TipoMedicao` (em `models.py`) fixa os tipos suportados; nesta aplicação,
apenas `transporte_publico` (SPTrans Olho Vivo). Como o `parametro` é uma string,
o mesmo tipo pode ter vários parâmetros. O campo `fonte` documenta, por linha, a
origem do dado.

## 5.3 Módulos do back-end (`server/app/`)

- **`main.py`** - cria a aplicação FastAPI (título "API Transporte Publico SP -
  APS SD", visível no Swagger em `/docs`), habilita CORS (para o app Expo
  consumir), registra os exception handlers e os routers (incluindo
  `localidades.py`), e no `lifespan` de startup cria as tabelas e executa o seed
  idempotente. Mantém `GET /health`.
- **`database.py`** - configura o engine SQLAlchemy 2.x apontando para o SQLite em
  `server/data/app.db`, a `SessionLocal`, a `Base` declarativa e a dependência
  `get_db` (uma sessão por requisição). Documenta no próprio código como migrar
  para PostgreSQL trocando a URL do engine.
- **`models.py`** - modelos ORM descritos na seção 5.2 (enum com apenas
  `transporte_publico`).
- **`schemas.py`** - schemas Pydantic v2 (entrada/saída), o schema de erro
  padronizado `ErroResposta` (`codigo`, `mensagem`, `detalhe`), o `MunicipioSPRead`
  (resposta do endpoint de localidades do IBGE) e os schemas de saída do
  acompanhamento de ônibus e busca (`LinhaRead`, `VeiculoPosicaoRead`,
  `PosicaoLinhaRead`, `PrevisaoVeiculoRead`, `ParadaPrevisaoRead`,
  `PrevisaoLinhaRead`, `ParadaRead`), que carregam `tempo_real` e `fonte` para
  distinguir dado em tempo real de dado de EXEMPLO.
- **`errors.py`** - instala handlers globais para `HTTPException` (ex.: 404 e
  502), `RequestValidationError` (422) e um genérico para `Exception` (500
  tratado), todos respondendo no formato `ErroResposta` em PT-BR.
- **`services/sptrans.py`** - integração com a SPTrans Olho Vivo (fonte OFICIAL de
  transporte público de SP). Lê o token de `SPTRANS_TOKEN` (`obter_token`),
  autentica (`_autenticar`, estabelecendo a sessão via cookie), deriva métricas
  reais do `GET /Posicao` (`mapear_payload`: `linhas_monitoradas` e
  `veiculos_em_operacao`) e, sem token, retorna o fallback de exemplo
  (`_leituras_fallback`: `linhas_exemplo`). Também expõe o **acompanhamento de
  ônibus e a busca** (itens B e C): `buscar_linhas` (`/Linha/Buscar`),
  `buscar_posicoes_linha` (`/Posicao/Linha`), `buscar_previsao_linha`
  (`/Previsao/Linha`) e `buscar_paradas` (`/Parada/Buscar`), com dataclasses de
  leitura (`LinhaOnibus`, `VeiculoPosicao`, `PosicaoLinha`, `PrevisaoVeiculo`,
  `ParadaPrevisao`, `PrevisaoLinha`, `Parada`) e mapeadores puros. O fluxo de
  autenticação é reutilizado por `_consultar_olhovivo` (mesma sessão/cookie) e,
  sem token, cada função devolve um conjunto de EXEMPLO rotulado como não tempo
  real (`tempo_real=False`). Expõe `FONTE` (tempo real) e `FONTE_FALLBACK`
  (exemplo). Converte qualquer `httpx.HTTPError` em `SPTransError`.
- **`services/ibge.py`** - integração com a API de Localidades do IBGE (base
  geográfica OFICIAL, UF 35 = SP). Define `IBGE_MUNICIPIOS_SP_URL`, `mapear_payload`
  (lê a LISTA de municípios, extraindo `id`, `nome` e a sigla da UF dos blocos
  aninhados) e `buscar_municipios_sp`. Converte falhas em `IbgeError`.
- **`seed.py`** - `executar_seed` popula o banco (se vazio) com 12 regiões reais
  de São Paulo/SP (distritos da capital) com coordenadas reais de fontes oficiais
  da PMSP (GeoSampa) e nome validável pelo IBGE (código 35 / 3550308). As cinco
  regiões originais são preservadas na mesma ordem (Sé, Pinheiros, Mooca, Santana,
  Itaquera) e foram acrescentados mais sete distritos (Santo Amaro, Butantã, Lapa,
  Vila Mariana, Ipiranga, Penha, Tatuapé), cada um com coordenadas de um marco
  reconhecido (praça/estação/terminal). Para cada região gera uma medição-semente
  de transporte público de EXEMPLO (`veiculos_em_operacao`) e uma regra de alerta
  (`veiculos_em_operacao > 300`). Os valores de seed são apenas exemplos iniciais;
  o campo `fonte` aponta a fonte real substituível. Idempotente.
- **`routers/`** - endpoints agrupados por domínio (detalhados no capítulo 6):
  - `saude.py`: `GET /health` e `GET /api/v1/saude`.
  - `regioes.py`: `GET /api/v1/regioes`, `GET /api/v1/regioes/{id}` e o helper
    `obter_regiao_ou_404` (reusado pelos demais routers).
  - `localidades.py`: `GET /api/v1/localidades/sp` (municípios de SP via IBGE).
  - `medicoes.py`: `GET /api/v1/medicoes` (filtros por região/tipo),
    `GET /api/v1/regioes/{id}/medicoes` e
    `POST /api/v1/regioes/{id}/atualizar-transporte` (SPTrans Olho Vivo, token +
    fallback).
  - `linhas.py`: acompanhamento de ônibus e busca na SPTrans Olho Vivo -
    `GET /api/v1/linhas/buscar`, `GET /api/v1/linhas/{codigo_linha}/posicoes`,
    `GET /api/v1/linhas/{codigo_linha}/previsao` e `GET /api/v1/paradas/buscar`.
    Traduz `SPTransError` em HTTP 502 PT-BR e usa o fallback de exemplo sem token.
  - `relatorios.py`: `GET /api/v1/relatorios/regiao/{id}` (agregações).
  - `alertas.py`: `GET /api/v1/alertas`, `POST /api/v1/alertas`,
    `GET /api/v1/alertas/avaliar/{regiao_id}`.

## 5.4 Módulos do cliente móvel (`mobile/`)

- **`App.tsx`** - componente raiz. Envolve o app em `SafeAreaProvider` e
  `NavigationContainer`, cria um stack nativo (React Navigation) e registra as
  telas com títulos em PT-BR.
- **`src/navigation.ts`** - define `RootStackParamList` com as rotas e seus
  parâmetros (`Mapa`, `Detalhe`, `Relatorios`, `Alertas`, `Linhas`).
- **`src/types.ts`** - interfaces TypeScript que espelham os schemas da API,
  incluindo o tipo `transporte_publico` em `TipoMedicao` e os tipos de
  acompanhamento de ônibus e busca (`LinhaRead`, `VeiculoPosicaoRead`,
  `PosicaoLinhaRead`, `PrevisaoVeiculoRead`, `ParadaPrevisaoRead`,
  `PrevisaoLinhaRead`, `ParadaRead`).
- **`src/api/client.ts`** - cliente HTTP tipado com `fetch`. Define
  `API_BASE_URL` (default `http://10.0.2.2:8000` para emulador Android), a classe
  `ApiError` (mensagem PT-BR pronta para a UI), timeout via `AbortController` e as
  funções `getRegioes`, `getRegiao`, `getMedicoes`, **`atualizarTransporte`**,
  `getRelatorio`, `getAlertas`, `criarAlerta`, `avaliarAlertas` e as novas
  `buscarLinhas`, `getPosicoesLinha`, `getPrevisaoLinha` e `buscarParadas`.
- **`src/screens/MapaScreen.tsx`** - tela inicial. Carrega as regiões da API e as
  apresenta em uma lista clicável ("Regiões monitoradas em São Paulo"); cada item
  mostra nome, cidade/UF e as coordenadas e abre o Detalhe ao ser tocado. No
  cabeçalho há dois botões de acesso rápido, **"Linhas de onibus"** (abre a tela
  de Linhas) e **"Ver alertas"**. A tela não depende de nenhum módulo nativo de
  mapa e trata carregamento, erro e vazio.
- **`src/screens/LinhasScreen.tsx`** - tela de **acompanhamento de ônibus e
  busca** (SPTrans Olho Vivo). Tem duas abas ("Linhas" e "Paradas") que
  reutilizam o mesmo campo de busca. Ao buscar uma linha (`buscarLinhas`), lista
  letreiro, terminais, sentido e indicação de circular; ao selecionar uma linha,
  os botões "Ver posicao" (`getPosicoesLinha`) e "Ver previsao"
  (`getPrevisaoLinha`) mostram, em LISTA, a posição dos veículos (prefixo,
  acessibilidade, horário e latitude/longitude em texto) e a previsão de chegada
  por parada. Na aba "Paradas" (`buscarParadas`) lista nome, endereço e
  coordenadas. Quando o back-end sinaliza `tempo_real === false`, a tela exibe um
  aviso de dado de EXEMPLO. Não usa nenhum módulo nativo de mapa.
- **`src/screens/DetalheScreen.tsx`** - medições de transporte público da região,
  com o botão **"Atualizar transporte"** (chama
  `POST /api/v1/regioes/{id}/atualizar-transporte`) e acesso ao relatório.
- **`src/screens/RelatoriosScreen.tsx`** - consome o relatório agregado e mostra
  média, mínimo, máximo, contagem e última leitura por parâmetro em cards. No topo,
  apresenta um **gráfico de barras** ("Médias por parâmetro") com `BarChart` do
  **react-native-chart-kit** (que depende de **react-native-svg**), largura
  calculada com `useWindowDimensions` e renderizado como `ListHeaderComponent` da
  `FlatList`. Trata dataset vazio.
- **`src/screens/AlertasScreen.tsx`** - lista regras, formulário para criar uma
  regra (com o tipo `transporte_publico`) e botão para avaliar os alertas de uma
  região.
- **`src/ui/estados.tsx`** - componentes reutilizáveis de estado
  (`EstadoCarregando`, `EstadoErro` com "Tentar novamente", `EstadoVazio`).
- **`src/ui/rotulos.ts`** - rótulos em PT-BR do tipo ("Transporte público
  (SPTrans)") e dos parâmetros do transporte público (`linhas_monitoradas` ->
  "Linhas monitoradas", `veiculos_em_operacao` -> "Veículos em operação",
  `linhas_exemplo` -> "Linhas (exemplo, sem token)"), além da formatação numérica
  e de data/hora no padrão pt-BR. Inclui também os rótulos da tela de Linhas: o
  aviso de dado de EXEMPLO (`AVISO_DADO_EXEMPLO`), o sentido (`rotuloSentido`) e a
  acessibilidade do veículo (`rotuloAcessivel`).
