# 1. Objetivo e motivacao

## 1.1 Objetivo

Desenvolver uma aplicacao de **sistema distribuido para dispositivo movel** que
faca o gerenciamento de informacoes ambientais urbanas. O nucleo do sistema e a
**qualidade do ar** (poluicao), complementado por **transito** e **alagamento**,
apresentados de forma integrada por regiao e ligados a um **mapa**.

O sistema e composto por tres partes que se comunicam em rede, caracterizando o
sistema distribuido:

1. **Cliente movel** (aplicativo React Native/Expo) que roda no dispositivo do
   usuario e apresenta as informacoes.
2. **Servidor de aplicacao** (API REST em FastAPI) que centraliza a logica,
   integra fontes externas de dados e responde as consultas.
3. **Banco de dados** (SQLite, com caminho documentado para PostgreSQL) que
   persiste regioes, medicoes e regras de alerta.

Objetivos especificos, todos implementados no codigo do repositorio:

- Consultar informacoes ambientais **por regiao**, com as regioes posicionadas
  em um mapa por latitude/longitude (requisito de "consulta por regiao ligada a
  um mapa").
- Obter dados reais de qualidade do ar a partir de uma fonte publica e gratuita
  (Open-Meteo Air Quality API,
  [https://open-meteo.com/en/docs/air-quality-api](https://open-meteo.com/en/docs/air-quality-api)).
- Gerar **relatorios** agregados por regiao (media, minimo, maximo, contagem e
  ultima leitura por parametro).
- Emitir **alertas** por limiar (por exemplo, PM2.5 acima de um valor) e avaliar
  quais alertas disparam para cada regiao.
- Prover **tratamento de erros** robusto e padronizado, tanto no servidor quanto
  no cliente, com mensagens em Portugues.

## 1.2 Motivacao

A poluicao do ar, os congestionamentos e os alagamentos afetam diretamente a
saude e a rotina da populacao urbana. Reunir esses indicadores em um unico
aplicativo movel, organizado por regiao e com alertas, ajuda o cidadao a tomar
decisoes cotidianas (evitar uma area, adiar uma atividade fisica ao ar livre,
escolher um trajeto).

Do ponto de vista academico, o tema e um exemplo natural de **sistema
distribuido**: os dados nascem em servicos externos e no banco, sao processados
por um servidor central e consumidos por um cliente movel que roda em outro
dispositivo, tudo comunicando por HTTP/JSON sobre a rede. Isso permite exercitar
os conceitos da disciplina de Sistemas Distribuidos (comunicacao cliente-servidor,
protocolo de aplicacao, tratamento de falhas de rede, escalabilidade do banco)
em um contexto real e comprovavel.

## 1.3 Alinhamento com o enunciado da APS

O documento da APS (`APS_7_8_CC_2025_DSD.docx`, na raiz do repositorio) pede uma
aplicacao movel para gerenciamento de informacoes ambientais urbanas (poluicao do
ar, transito, areas de alagamento e inundacoes, entre outros), demonstravel em
dispositivo portatil ou simulador, e valoriza refinamento, tratamento de erros,
funcoes extras e relatorios adicionais. Este projeto atende a esses pontos:

- **Nucleo ambiental:** qualidade do ar com dados reais; transito e alagamento
  como tipos adicionais no mesmo modelo de dados.
- **Funcoes extras:** relatorios agregados e sistema de alertas por limiar.
- **Tratamento de erros:** handlers globais no servidor e tratamento de falhas de
  rede no cliente (ver `06_relatorio_de_codigo.md`).
- **Plataforma movel:** React Native/Expo, demonstravel em emulador Android/iOS
  ou em dispositivo fisico via Expo Go (ver `07_apresentacao_do_programa.md`).

> Observacao sobre o escopo do alagamento: conforme orientacao do autor, caso o
> tratamento de alagamento se mostrasse complexo demais, ele poderia ficar em
> segundo plano. Neste projeto ele foi mantido com fonte real: o modelo de dados
> e generico e representa o tipo `alagamento` (com metricas de descarga fluvial e
> alerta associado), alimentado pela Open-Meteo Flood API (base cientifica GloFAS)
> por meio do endpoint `POST /api/v1/regioes/{id}/atualizar-alagamento` (ver
> `03_fundamentos_tecnologias_moveis.md` e `06_relatorio_de_codigo.md`).
