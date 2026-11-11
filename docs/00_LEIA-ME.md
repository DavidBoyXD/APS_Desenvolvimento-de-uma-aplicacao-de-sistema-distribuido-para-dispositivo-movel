# Documentação da APS - Monitoramento de transporte público em SP

Atividades Práticas Supervisionadas (APS) da disciplina Desenvolvimento de
Sistemas Distribuídos (DSD), 7o/8o semestre do curso de Ciência da Computação
(CC) - Universidade Paulista (UNIP), ano de 2026.

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
| Ficha de APS | `10_capa_e_ficha_aps.md` (seção "Ficha de APS") |

Documentos complementares (conformidade e atribuições), referenciados ao longo
do trabalho:

| Documento complementar | Arquivo nesta pasta |
| --- | --- |
| Licenças e atribuições (auditoria) | `11_licencas_e_atribuicoes.md` |
| Política de Privacidade (LGPD) | `12_politica_de_privacidade.md` |
| Termos de Uso | `13_termos_de_uso.md` |

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

## Dados do grupo e itens a preencher pelo autor

Os integrantes do grupo e seus números de matrícula já estão preenchidos no
arquivo `10_capa_e_ficha_aps.md`:

- David Andrew Dezidério Gomes Silva - F3530E8
- Carlos Henrique Santana Rodrigues - R013944
- Henrique Vitale Cassú - N916FJ2
- Marcelo Augusto de Souza Silva - F356JE0

A orientação é da professora Jacqueline Zonichenn, no campus Paulista (São Paulo
- SP). Os itens abaixo dependem de ato físico no momento da entrega e
permanecem marcados como `[preencher pelo autor]` em `10_capa_e_ficha_aps.md`:

- Data de entrega.
- Assinatura na ficha de APS.

## Resumo técnico do que foi construído

- **Back-end (servidor):** API REST em Python com FastAPI, ORM SQLAlchemy 2.x e
  banco SQLite (migrável para PostgreSQL). Código em `server/`.
- **Cliente móvel:** aplicativo React Native com Expo (TypeScript), com lista de
  regiões de São Paulo, detalhe por região, relatórios com histórico acumulado e
  gráfico de barras, alertas, tela de Linhas de ônibus e um mapa visual
  (WebView + Leaflet + OpenStreetMap). Código em `mobile/`.
- **Funções extras (diferenciais):** busca livre com correspondência aproximada
  (fuzzy), favoritos de linhas salvos localmente (AsyncStorage), atualização
  automática da posição dos veículos (10/15/30s), relatórios com histórico
  (limite de 50 por parâmetro) e gráfico de barras, e o recurso "Você está aqui"
  (GPS via `expo-location`) condicionado ao consentimento explícito.
- **Conformidade com a LGPD (Lei nº 13.709/2018):** tela de consentimento na
  primeira execução (checkbox e registro local), Política de Privacidade, Termos
  de Uso, tela de Privacidade (acesso e exclusão de dados locais, revogação do
  consentimento), tabela de retenção e encarregado (David Andrew,
  daviddeziderio07@gmail.com). A localização nunca é enviada ao back-end.
- **Token da SPTrans:** o transporte público em tempo real usa um token gratuito
  lido da variável de ambiente `SPTRANS_TOKEN` (nunca escrito no código). Sem o
  token, o sistema usa um fallback de exemplo claramente rotulado, de modo que o
  app funciona de ponta a ponta. O passo a passo de cadastro do token está em
  `07_apresentacao_do_programa.md`.

Para rodar e demonstrar o sistema, siga o roteiro em `07_apresentacao_do_programa.md`.
