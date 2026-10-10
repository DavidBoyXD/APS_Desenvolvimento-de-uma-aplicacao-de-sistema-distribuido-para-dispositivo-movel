# 1. Objetivo e motivacao

## 1.1 Objetivo

Desenvolver uma aplicacao de **sistema distribuido para dispositivo movel** que
faca o gerenciamento de informacoes ambientais urbanas da cidade de **Sao Paulo
(SP)**. Nesta versao, o sistema reune tres assuntos, todos ancorados em fontes e
autoridades OFICIAIS do territorio nacional/paulistano:

- **Qualidade do ar** (poluicao): material particulado (PM2.5, PM10) e gases
  (monoxido de carbono, dioxido de nitrogenio, ozonio).
- **Alagamento/chuva**: risco de cheia derivado da descarga fluvial.
- **Transporte publico**: frota de onibus da capital (linhas monitoradas e
  veiculos em operacao).

O sistema e composto por tres partes que se comunicam em rede, caracterizando o
sistema distribuido:

1. **Cliente movel** (aplicativo React Native/Expo) que roda no dispositivo do
   usuario e apresenta as informacoes, com o mapa enquadrado em Sao Paulo.
2. **Servidor de aplicacao** (API REST em FastAPI) que centraliza a logica,
   integra as fontes externas e responde as consultas.
3. **Banco de dados** (SQLite, com caminho documentado para PostgreSQL) que
   persiste regioes, medicoes e regras de alerta.

Objetivos especificos, todos implementados no codigo do repositorio:

- Consultar informacoes ambientais **por regiao** de Sao Paulo, com as regioes
  posicionadas em um mapa por latitude/longitude (requisito de "consulta por
  regiao ligada a um mapa").
- Obter dados de **transporte publico** da fonte OFICIAL de SP, a **SPTrans Olho
  Vivo** ([https://www.sptrans.com.br/desenvolvedores/](https://www.sptrans.com.br/desenvolvedores/)),
  em tempo real quando ha token, com fallback de exemplo quando nao ha token.
- Obter dados de **qualidade do ar** de uma fonte operacional publica (Open-Meteo
  Air Quality API), tendo a **CETESB/QUALAR** como autoridade oficial de
  referencia em SP.
- Obter dados de **alagamento** (descarga fluvial) de uma fonte operacional
  publica (Open-Meteo Flood API / GloFAS), tendo o **CGE-SP** como autoridade
  oficial de referencia em SP.
- Usar a base geografica OFICIAL do **IBGE** (API de Localidades, UF 35 = SP)
  para validar/listar os municipios de SP.
- Gerar **relatorios** agregados por regiao (media, minimo, maximo, contagem e
  ultima leitura por parametro), com grafico de barras no cliente.
- Emitir **alertas** por limiar (por exemplo, PM2.5 acima de um valor) e avaliar
  quais alertas disparam para cada regiao.
- Prover **tratamento de erros** robusto e padronizado, tanto no servidor quanto
  no cliente, com mensagens em Portugues.

## 1.2 Motivacao

A cidade de Sao Paulo convive de forma intensa com a poluicao do ar, com os
alagamentos em periodos de chuva e com a complexidade do transporte publico por
onibus. Reunir esses indicadores em um unico aplicativo movel, organizado por
regiao e com alertas, ajuda o cidadao a tomar decisoes cotidianas (evitar uma
area, adiar uma atividade fisica ao ar livre, acompanhar a frota de onibus).

Ao se apoiar em orgaos OFICIAIS de Sao Paulo (SPTrans para transporte, CETESB
para ar, CGE-SP para alagamento) e na base geografica OFICIAL do IBGE, o trabalho
ganha credibilidade e rastreabilidade: cada dado tem origem citada e verificavel.

Do ponto de vista academico, o tema e um exemplo natural de **sistema
distribuido**: os dados nascem em servicos externos e no banco, sao processados
por um servidor central e consumidos por um cliente movel que roda em outro
dispositivo, tudo comunicando por HTTP/JSON sobre a rede. Isso permite exercitar
os conceitos da disciplina de Sistemas Distribuidos (comunicacao cliente-servidor,
protocolo de aplicacao, autenticacao em servico externo com token, tratamento de
falhas de rede, escalabilidade do banco) em um contexto real e comprovavel.

## 1.3 Alinhamento com o enunciado da APS

O documento da APS (`APS_7_8_CC_2025_DSD.docx`, na raiz do repositorio) pede uma
aplicacao movel para gerenciamento de informacoes ambientais urbanas (poluicao do
ar, transito, areas de alagamento e inundacoes, entre outros), demonstravel em
dispositivo portatil ou simulador, e valoriza refinamento, tratamento de erros,
funcoes extras e relatorios adicionais. Esta versao, focada em Sao Paulo, atende a
esses pontos:

- **Nucleo ambiental:** qualidade do ar e alagamento com dados operacionais e
  autoridades oficiais de SP citadas; transporte publico com a fonte OFICIAL da
  Prefeitura de SP (SPTrans Olho Vivo).
- **Funcoes extras:** relatorios agregados (com grafico de barras) e sistema de
  alertas por limiar.
- **Tratamento de erros:** handlers globais no servidor (respostas 502 e 404
  padronizadas em PT-BR) e tratamento de falhas de rede no cliente (ver
  `06_relatorio_de_codigo.md`).
- **Plataforma movel:** React Native/Expo, demonstravel em emulador Android/iOS
  ou em dispositivo fisico via Expo Go (ver `07_apresentacao_do_programa.md`).

> Observacao sobre o tipo de transito: a versao anterior do projeto usava a
> Overpass API do OpenStreetMap para derivar metricas de infraestrutura viaria
> (tipo `transito`). Esse caminho foi mantido como LEGADO no modelo generico (o
> enum `TipoMedicao` ainda inclui `transito`), mas a fonte OFICIAL de transporte
> de Sao Paulo nesta versao passou a ser a SPTrans (tipo `transporte_publico`).
> Ver `03_fundamentos_tecnologias_moveis.md` e `06_relatorio_de_codigo.md`.
