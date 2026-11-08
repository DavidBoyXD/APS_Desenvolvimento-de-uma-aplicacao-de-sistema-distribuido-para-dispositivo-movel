# 10. Capa e Ficha de APS

Os dados do grupo (nomes e RA) estão preenchidos abaixo. Apenas os campos que
dependem de informação institucional específica permanecem marcados como
`[preencher pelo autor]`: professor(a) orientador(a), polo/campus, turma e data
de entrega.

## 10.1 Capa

```
UNIVERSIDADE PAULISTA - UNIP

Curso: Ciencia da Computacao
Disciplina: Sistemas Distribuidos (SD)
Semestre: 7o / 8o

Atividades Praticas Supervisionadas (APS)

Titulo do trabalho:
Desenvolvimento de uma aplicacao de sistema distribuido para dispositivo movel
- Monitoramento de transporte publico em SP

Alunos e RA:
- David Andrew Deziderio Gomes Silva - RA F3530E8
- Carlos Henrique Santana Rodrigues - RA R013944
- Henrique Vitale Cassu - RA N916FJ2
- Marcelo Augusto de Souza Silva - RA F356JE0

Professor(a) orientador(a): [preencher pelo autor]
Polo / Campus: [preencher pelo autor]
Turma: [preencher pelo autor]
Cidade / UF: Sao Paulo / SP
Ano: 2025
```

## 10.2 Ficha de APS

A ficha de APS é o formulário padrão da UNIP entregue junto ao trabalho. Os
campos abaixo estão preenchidos com os dados do grupo; os itens institucionais
específicos e as assinaturas devem ser completados pelo autor conforme o modelo
oficial fornecido pela instituição:

- Nome da instituição: Universidade Paulista (UNIP)
- Curso: Ciência da Computação
- Disciplina: Sistemas Distribuídos (SD)
- Semestre: 7º / 8º
- Ano: 2025
- Turma: [preencher pelo autor]
- Título da APS: Desenvolvimento de uma aplicação de sistema distribuído para
  dispositivo móvel - Monitoramento de transporte público em SP
- Integrantes do grupo (nome e RA):
  - David Andrew Dezidério Gomes Silva - RA F3530E8
  - Carlos Henrique Santana Rodrigues - RA R013944
  - Henrique Vitale Cassú - RA N916FJ2
  - Marcelo Augusto de Souza Silva - RA F356JE0
- Professor(a) orientador(a): [preencher pelo autor]
- Polo / Campus: [preencher pelo autor]
- Data de entrega: [preencher pelo autor]
- Nota / avaliação: (reservado ao professor)
- Assinaturas dos integrantes: [preencher pelo autor]

> Observação: substitua este texto pelo formulário oficial da Ficha de APS da
> UNIP, mantendo o título, os integrantes e a descrição do trabalho aqui
> indicados.

## 10.3 Resumo do trabalho (para a capa/apresentação)

Aplicação de sistema distribuído para dispositivo móvel voltada ao monitoramento
do transporte público (frota de ônibus) da cidade de São Paulo (SP). É composta
por um cliente móvel (React Native/Expo), um servidor de API REST (FastAPI/Python)
e um banco de dados (SQLite, migrável para PostgreSQL). Apoia-se em fontes
OFICIAIS: **transporte público** com a SPTrans Olho Vivo (fonte OFICIAL da
Prefeitura de SP, tempo real com token gratuito e fallback de exemplo sem token) e
**base geográfica** com a API oficial do IBGE (UF 35 = SP). Oferece consulta por
região, um mapa visual (WebView + Leaflet + OpenStreetMap) com busca integrada,
busca livre de linhas e paradas com correspondência aproximada (fuzzy), favoritos
de linhas salvos localmente, atualização automática da posição dos veículos,
relatórios agregados com histórico e gráfico de barras, alertas por limiar e
tratamento de erros padronizado. O tratamento de dados pessoais segue a LGPD
(consentimento explícito, Política de Privacidade, Termos de Uso e tela de
Privacidade para acesso e exclusão dos dados locais), e o recurso "Você está
aqui" (GPS) é condicionado ao consentimento, com a coordenada usada apenas no
aparelho. A documentação completa está nos arquivos numerados desta pasta `docs/`
(ver `00_LEIA-ME.md`).
