# 1. Objetivo e motivacao

## 1.1 Objetivo

Desenvolver uma aplicacao de **sistema distribuido para dispositivo movel** que
faca o gerenciamento de informacoes urbanas da cidade de **Sao Paulo (SP)**, com
foco no **transporte publico** (frota de onibus da capital), ancorado em fontes e
autoridades OFICIAIS:

- **Transporte publico**: linhas monitoradas e veiculos em operacao da frota de
  onibus da capital, obtidos da SPTrans Olho Vivo.
- **Base geografica**: validacao/listagem dos municipios de SP (UF 35) pela API
  oficial do IBGE.

O sistema e composto por tres partes que se comunicam em rede, caracterizando o
sistema distribuido:

1. **Cliente movel** (aplicativo React Native/Expo) que roda no dispositivo do
   usuario e apresenta as informacoes, com o mapa enquadrado em Sao Paulo.
2. **Servidor de aplicacao** (API REST em FastAPI) que centraliza a logica,
   integra as fontes externas e responde as consultas.
3. **Banco de dados** (SQLite, com caminho documentado para PostgreSQL) que
   persiste regioes, medicoes e regras de alerta.

Objetivos especificos, todos implementados no codigo do repositorio:

- Consultar informacoes **por regiao** de Sao Paulo, com as regioes posicionadas
  em um mapa por latitude/longitude (requisito de "consulta por regiao ligada a um
  mapa").
- Obter dados de **transporte publico** da fonte OFICIAL de SP, a **SPTrans Olho
  Vivo** ([https://www.sptrans.com.br/desenvolvedores/](https://www.sptrans.com.br/desenvolvedores/)),
  em tempo real quando ha token, com fallback de exemplo quando nao ha token.
- Usar a base geografica OFICIAL do **IBGE** (API de Localidades, UF 35 = SP)
  para validar/listar os municipios de SP.
- Gerar **relatorios** agregados por regiao (media, minimo, maximo, contagem e
  ultima leitura por parametro), com grafico de barras no cliente.
- Emitir **alertas** por limiar (por exemplo, veiculos em operacao acima de um
  valor) e avaliar quais alertas disparam para cada regiao.
- Prover **tratamento de erros** robusto e padronizado, tanto no servidor quanto
  no cliente, com mensagens em Portugues.

## 1.2 Motivacao

O transporte publico por onibus e um dos pilares da mobilidade na cidade de Sao
Paulo e um tema de grande impacto no cotidiano do cidadao. Reunir indicadores da
frota (linhas monitoradas e veiculos em operacao) em um aplicativo movel,
organizado por regiao e com alertas, ajuda a visualizar a operacao do sistema de
onibus de forma acessivel e em mobilidade.

Ao se apoiar na SPTrans (fonte OFICIAL de transporte da Prefeitura de Sao Paulo) e
na base geografica OFICIAL do IBGE, o trabalho ganha credibilidade e
rastreabilidade: cada dado tem origem citada e verificavel.

Do ponto de vista academico, o tema e um exemplo natural de **sistema
distribuido**: os dados nascem em servicos externos e no banco, sao processados
por um servidor central e consumidos por um cliente movel que roda em outro
dispositivo, tudo comunicando por HTTP/JSON sobre a rede. Isso permite exercitar
os conceitos da disciplina de Sistemas Distribuidos (comunicacao cliente-servidor,
protocolo de aplicacao, autenticacao em servico externo com token, tratamento de
falhas de rede, escalabilidade do banco) em um contexto real e comprovavel.

## 1.3 Alinhamento com o enunciado da APS

O documento da APS (`APS_7_8_CC_2025_DSD.docx`, na raiz do repositorio) pede uma
aplicacao movel para gerenciamento de informacoes urbanas, demonstravel em
dispositivo portatil ou simulador, e valoriza refinamento, tratamento de erros,
funcoes extras e relatorios adicionais. Esta aplicacao, focada no transporte
publico de Sao Paulo, atende a esses pontos:

- **Nucleo da aplicacao:** transporte publico com a fonte OFICIAL da Prefeitura de
  SP (SPTrans Olho Vivo), por regiao, ligada a um mapa enquadrado na capital.
- **Funcoes extras:** relatorios agregados (com grafico de barras) e sistema de
  alertas por limiar.
- **Tratamento de erros:** handlers globais no servidor (respostas 502 e 404
  padronizadas em PT-BR) e tratamento de falhas de rede no cliente (ver
  `06_relatorio_de_codigo.md`).
- **Plataforma movel:** React Native/Expo, demonstravel em emulador Android/iOS
  ou em dispositivo fisico via Expo Go (ver `07_apresentacao_do_programa.md`).
