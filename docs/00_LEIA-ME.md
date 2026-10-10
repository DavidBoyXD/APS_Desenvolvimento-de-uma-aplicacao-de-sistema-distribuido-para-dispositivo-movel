# Documentacao da APS - Monitor de Transporte Publico de Sao Paulo (SP)

Atividades Praticas Supervisionadas (APS) da disciplina **Sistemas Distribuidos (SD)**,
7o/8o semestre do curso de Ciencia da Computacao (CC) - Universidade Paulista (UNIP).

Tema: **Desenvolvimento de uma aplicacao de sistema distribuido para dispositivo movel**,
com foco no monitoramento do **transporte publico** (frota de onibus) da cidade de
**Sao Paulo (SP)**.

O trabalho se apoia em fontes e autoridades OFICIAIS, com recorte em Sao Paulo:

- **Transporte publico:** SPTrans Olho Vivo (fonte OFICIAL da Prefeitura de SP,
  tempo real da frota de onibus), com fallback de exemplo quando nao ha token.
- **Base geografica:** API oficial de Localidades do **IBGE** (codigo da UF 35 = SP).

Toda a documentacao esta em Portugues-Brasil. O codigo-fonte permanece em ingles
(convencao tecnica), com comentarios em Portugues.

## Como esta organizada esta pasta

Cada arquivo cobre um item exigido pela estrutura do trabalho escrito da APS.
A tabela abaixo mapeia o item da APS ao arquivo correspondente.

| Item exigido pela APS | Arquivo nesta pasta |
| --- | --- |
| Capa | `10_capa_e_ficha_aps.md` (secao "Capa") - [preencher pelo autor] |
| Indice | Este arquivo (`00_LEIA-ME.md`) e o indice/sumario |
| Objetivo e motivacao | `01_objetivo_e_motivacao.md` |
| Introducao | `02_introducao.md` |
| Fundamentos das tecnologias moveis escolhidas | `03_fundamentos_tecnologias_moveis.md` |
| Plano de desenvolvimento da aplicacao | `04_plano_de_desenvolvimento.md` |
| Projeto (estrutura e modulos) do programa | `05_projeto_estrutura_e_modulos.md` |
| Relatorio com as linhas de codigo | `06_relatorio_de_codigo.md` |
| Apresentacao do programa em funcionamento | `07_apresentacao_do_programa.md` |
| Bibliografia | `08_bibliografia.md` |
| Declaracao de uso de IA (norma anexada) | `09_declaracao_uso_ia.md` |
| Ficha de APS | `10_capa_e_ficha_aps.md` (secao "Ficha de APS") - [preencher pelo autor] |

## Requisito transversal de rastreabilidade

Por decisao do autor do trabalho, **todo artefato, tecnologia, biblioteca ou API
citado nesta documentacao traz a referencia/link real da fonte, o que foi
utilizado e onde foi aplicado no projeto** (arquivo e funcao). Os links oficiais
estao distribuidos em cada documento e consolidados em `08_bibliografia.md`. O
mapeamento fonte -> arquivo/funcao esta detalhado em `06_relatorio_de_codigo.md`.

## Fontes e autoridades oficiais de Sao Paulo (resumo)

- **SPTrans Olho Vivo** (transporte publico, tempo real da frota de onibus):
  [https://www.sptrans.com.br/desenvolvedores/](https://www.sptrans.com.br/desenvolvedores/).
  Aplicada em `server/app/services/sptrans.py`.
- **IBGE - API de Localidades** (base geografica oficial, UF 35 = SP):
  [https://servicodados.ibge.gov.br/api/v1/localidades](https://servicodados.ibge.gov.br/api/v1/localidades).
  Aplicada em `server/app/services/ibge.py`.

## Dados a serem preenchidos pelo autor

Os itens abaixo dependem de informacoes pessoais/institucionais e por isso NAO
foram inventados. Estao marcados como `[preencher pelo autor]` no arquivo
`10_capa_e_ficha_aps.md`:

- Nome(s) do(s) aluno(s) e respectivos RA (Registro Academico).
- Nome do professor/orientador e do polo/campus.
- Turma, periodo e data de entrega.
- Assinatura na declaracao de uso de IA e na ficha de APS.

## Resumo tecnico do que foi construido

- **Back-end (servidor):** API REST em Python com FastAPI, ORM SQLAlchemy 2.x e
  banco SQLite (migravel para PostgreSQL). Codigo em `server/`.
- **Cliente movel:** aplicativo React Native com Expo (TypeScript), com mapa
  enquadrado em Sao Paulo, detalhe por regiao, relatorios (com grafico de barras)
  e alertas. Codigo em `mobile/`.
- **Token da SPTrans:** o transporte publico em tempo real usa um token gratuito
  lido da variavel de ambiente `SPTRANS_TOKEN` (nunca escrito no codigo). Sem o
  token, o sistema usa um fallback de exemplo claramente rotulado, de modo que o
  app funciona de ponta a ponta. O passo a passo de cadastro do token esta em
  `07_apresentacao_do_programa.md`.

Para rodar e demonstrar o sistema, siga o roteiro em `07_apresentacao_do_programa.md`.
