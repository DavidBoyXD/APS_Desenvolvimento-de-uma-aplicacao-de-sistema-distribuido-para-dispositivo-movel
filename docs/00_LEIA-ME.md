# Documentacao da APS - Monitor Ambiental Urbano

Atividades Praticas Supervisionadas (APS) da disciplina **Sistemas Distribuidos (SD)**,
7o/8o semestre do curso de Ciencia da Computacao (CC) - Universidade Paulista (UNIP).

Tema: **Desenvolvimento de uma aplicacao de sistema distribuido para dispositivo movel**,
com foco no gerenciamento de informacoes ambientais urbanas (qualidade do ar,
transito e alagamento).

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
utilizado e onde foi aplicado no projeto**. Os links oficiais estao distribuidos
em cada documento e consolidados em `08_bibliografia.md`.

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
- **Cliente movel:** aplicativo React Native com Expo (TypeScript), com mapa,
  detalhe por regiao, relatorios e alertas. Codigo em `mobile/`.
- **Fonte de dados reais:** Open-Meteo Air Quality API
  ([https://open-meteo.com/en/docs/air-quality-api](https://open-meteo.com/en/docs/air-quality-api)),
  publica e sem chave, usada para a qualidade do ar.

Para rodar e demonstrar o sistema, siga o roteiro em `07_apresentacao_do_programa.md`.
