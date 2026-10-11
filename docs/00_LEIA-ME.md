# Documentação da APS - Monitor de Transporte Público de São Paulo (SP)

Atividades Práticas Supervisionadas (APS) da disciplina **Sistemas Distribuídos (SD)**,
7o/8o semestre do curso de Ciência da Computação (CC) - Universidade Paulista (UNIP).

Tema: **Desenvolvimento de uma aplicação de sistema distribuído para dispositivo móvel**,
com foco no monitoramento do **transporte público** (frota de ônibus) da cidade de
**São Paulo (SP)**.

O trabalho se apoia em fontes e autoridades OFICIAIS, com recorte em São Paulo:

- **Transporte público:** SPTrans Olho Vivo (fonte OFICIAL da Prefeitura de SP,
  tempo real da frota de ônibus), com fallback de exemplo quando não há token.
- **Base geográfica:** API oficial de Localidades do **IBGE** (código da UF 35 = SP).

Toda a documentação está em Português-Brasil. O código-fonte permanece em inglês
(convenção técnica), com comentários em Português.

## Como está organizada esta pasta

Cada arquivo cobre um item exigido pela estrutura do trabalho escrito da APS.
A tabela abaixo mapeia o item da APS ao arquivo correspondente.

| Item exigido pela APS | Arquivo nesta pasta |
| --- | --- |
| Capa | `10_capa_e_ficha_aps.md` (seção "Capa") - [preencher pelo autor] |
| Índice | Este arquivo (`00_LEIA-ME.md`) é o índice/sumário |
| Objetivo e motivação | `01_objetivo_e_motivacao.md` |
| Introdução | `02_introducao.md` |
| Fundamentos das tecnologias móveis escolhidas | `03_fundamentos_tecnologias_moveis.md` |
| Plano de desenvolvimento da aplicação | `04_plano_de_desenvolvimento.md` |
| Projeto (estrutura e módulos) do programa | `05_projeto_estrutura_e_modulos.md` |
| Relatório com as linhas de código | `06_relatorio_de_codigo.md` |
| Apresentação do programa em funcionamento | `07_apresentacao_do_programa.md` |
| Bibliografia | `08_bibliografia.md` |
| Declaração de uso de IA (norma anexada) | `09_declaracao_uso_ia.md` |
| Ficha de APS | `10_capa_e_ficha_aps.md` (seção "Ficha de APS") - [preencher pelo autor] |

## Requisito transversal de rastreabilidade

Por decisão do autor do trabalho, **todo artefato, tecnologia, biblioteca ou API
citado nesta documentação traz a referência/link real da fonte, o que foi
utilizado e onde foi aplicado no projeto** (arquivo e função). Os links oficiais
estão distribuídos em cada documento e consolidados em `08_bibliografia.md`. O
mapeamento fonte -> arquivo/função está detalhado em `06_relatorio_de_codigo.md`.

## Fontes e autoridades oficiais de São Paulo (resumo)

- **SPTrans Olho Vivo** (transporte público, tempo real da frota de ônibus):
  [https://www.sptrans.com.br/desenvolvedores/](https://www.sptrans.com.br/desenvolvedores/).
  Aplicada em `server/app/services/sptrans.py`.
- **IBGE - API de Localidades** (base geográfica oficial, UF 35 = SP):
  [https://servicodados.ibge.gov.br/api/v1/localidades](https://servicodados.ibge.gov.br/api/v1/localidades).
  Aplicada em `server/app/services/ibge.py`.

## Dados a serem preenchidos pelo autor

Os itens abaixo dependem de informações pessoais/institucionais e por isso NÃO
foram inventados. Estão marcados como `[preencher pelo autor]` no arquivo
`10_capa_e_ficha_aps.md`:

- Nome(s) do(s) aluno(s) e respectivos RA (Registro Acadêmico).
- Nome do professor/orientador e do polo/campus.
- Turma, período e data de entrega.
- Assinatura na declaração de uso de IA e na ficha de APS.

## Resumo técnico do que foi construído

- **Back-end (servidor):** API REST em Python com FastAPI, ORM SQLAlchemy 2.x e
  banco SQLite (migrável para PostgreSQL). Código em `server/`.
- **Cliente móvel:** aplicativo React Native com Expo (TypeScript), com mapa
  enquadrado em São Paulo, detalhe por região, relatórios (com gráfico de barras)
  e alertas. Código em `mobile/`.
- **Token da SPTrans:** o transporte público em tempo real usa um token gratuito
  lido da variável de ambiente `SPTRANS_TOKEN` (nunca escrito no código). Sem o
  token, o sistema usa um fallback de exemplo claramente rotulado, de modo que o
  app funciona de ponta a ponta. O passo a passo de cadastro do token está em
  `07_apresentacao_do_programa.md`.

Para rodar e demonstrar o sistema, siga o roteiro em `07_apresentacao_do_programa.md`.
