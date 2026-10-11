# 1. Objetivo e motivação

## 1.1 Objetivo

Desenvolver uma aplicação de **sistema distribuído para dispositivo móvel** que
faça o gerenciamento de informações urbanas da cidade de **São Paulo (SP)**, com
foco no **transporte público** (frota de ônibus da capital), ancorado em fontes e
autoridades OFICIAIS:

- **Transporte público**: linhas monitoradas e veículos em operação da frota de
  ônibus da capital, obtidos da SPTrans Olho Vivo.
- **Base geográfica**: validação/listagem dos municípios de SP (UF 35) pela API
  oficial do IBGE.

O sistema é composto por três partes que se comunicam em rede, caracterizando o
sistema distribuído:

1. **Cliente móvel** (aplicativo React Native/Expo) que roda no dispositivo do
   usuário e apresenta as informações, com o mapa enquadrado em São Paulo.
2. **Servidor de aplicação** (API REST em FastAPI) que centraliza a lógica,
   integra as fontes externas e responde às consultas.
3. **Banco de dados** (SQLite, com caminho documentado para PostgreSQL) que
   persiste regiões, medições e regras de alerta.

Objetivos específicos, todos implementados no código do repositório:

- Consultar informações **por região** de São Paulo, com as regiões posicionadas
  em um mapa por latitude/longitude (requisito de "consulta por região ligada a um
  mapa").
- Obter dados de **transporte público** da fonte OFICIAL de SP, a **SPTrans Olho
  Vivo** ([https://www.sptrans.com.br/desenvolvedores/](https://www.sptrans.com.br/desenvolvedores/)),
  em tempo real quando há token, com fallback de exemplo quando não há token.
- Usar a base geográfica OFICIAL do **IBGE** (API de Localidades, UF 35 = SP)
  para validar/listar os municípios de SP.
- Gerar **relatórios** agregados por região (média, mínimo, máximo, contagem e
  última leitura por parâmetro), com gráfico de barras no cliente.
- Emitir **alertas** por limiar (por exemplo, veículos em operação acima de um
  valor) e avaliar quais alertas disparam para cada região.
- Prover **tratamento de erros** robusto e padronizado, tanto no servidor quanto
  no cliente, com mensagens em Português.

## 1.2 Motivação

O transporte público por ônibus é um dos pilares da mobilidade na cidade de São
Paulo e um tema de grande impacto no cotidiano do cidadão. Reunir indicadores da
frota (linhas monitoradas e veículos em operação) em um aplicativo móvel,
organizado por região e com alertas, ajuda a visualizar a operação do sistema de
ônibus de forma acessível e em mobilidade.

Ao se apoiar na SPTrans (fonte OFICIAL de transporte da Prefeitura de São Paulo) e
na base geográfica OFICIAL do IBGE, o trabalho ganha credibilidade e
rastreabilidade: cada dado tem origem citada e verificável.

Do ponto de vista acadêmico, o tema é um exemplo natural de **sistema
distribuído**: os dados nascem em serviços externos e no banco, são processados
por um servidor central e consumidos por um cliente móvel que roda em outro
dispositivo, tudo comunicando por HTTP/JSON sobre a rede. Isso permite exercitar
os conceitos da disciplina de Sistemas Distribuídos (comunicação cliente-servidor,
protocolo de aplicação, autenticação em serviço externo com token, tratamento de
falhas de rede, escalabilidade do banco) em um contexto real e comprovável.

## 1.3 Alinhamento com o enunciado da APS

O documento da APS (`APS_7_8_CC_2025_DSD.docx`, na raiz do repositório) pede uma
aplicação móvel para gerenciamento de informações urbanas, demonstrável em
dispositivo portátil ou simulador, e valoriza refinamento, tratamento de erros,
funções extras e relatórios adicionais. Esta aplicação, focada no transporte
público de São Paulo, atende a esses pontos:

- **Núcleo da aplicação:** transporte público com a fonte OFICIAL da Prefeitura de
  SP (SPTrans Olho Vivo), por região, ligada a um mapa enquadrado na capital.
- **Funções extras:** relatórios agregados (com gráfico de barras) e sistema de
  alertas por limiar.
- **Tratamento de erros:** handlers globais no servidor (respostas 502 e 404
  padronizadas em PT-BR) e tratamento de falhas de rede no cliente (ver
  `06_relatorio_de_codigo.md`).
- **Plataforma móvel:** React Native/Expo, demonstrável em emulador Android/iOS
  ou em dispositivo físico via Expo Go (ver `07_apresentacao_do_programa.md`).
