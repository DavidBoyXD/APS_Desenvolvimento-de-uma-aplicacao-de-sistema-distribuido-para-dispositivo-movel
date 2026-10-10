# 10. Capa e Ficha de APS

Os dados desta pagina dependem de informacoes pessoais e institucionais do autor.
Para nao inventar dados, os campos estao marcados como `[preencher pelo autor]`.

## 10.1 Capa

```
UNIVERSIDADE PAULISTA - UNIP

Curso: Ciencia da Computacao
Disciplina: Sistemas Distribuidos (SD)
Semestre: 7o / 8o

Atividades Praticas Supervisionadas (APS)

Titulo do trabalho:
Desenvolvimento de uma aplicacao de sistema distribuido para dispositivo movel
- Monitor Ambiental Urbano de Sao Paulo (qualidade do ar, alagamento e
  transporte publico)

Aluno(s) e RA:
- [preencher pelo autor: Nome completo] - RA: [preencher pelo autor]
- [preencher pelo autor: Nome completo] - RA: [preencher pelo autor]
  (repetir conforme o numero de integrantes)

Professor(a) orientador(a): [preencher pelo autor]
Polo / Campus: [preencher pelo autor]
Cidade / UF: [preencher pelo autor]
Ano: 2026
```

## 10.2 Ficha de APS

A ficha de APS e o formulario padrao da UNIP entregue junto ao trabalho. Os
campos abaixo devem ser preenchidos e assinados pelo autor conforme o modelo
oficial fornecido pela instituicao:

- Nome da instituicao: Universidade Paulista (UNIP)
- Curso: Ciencia da Computacao
- Disciplina: Sistemas Distribuidos
- Semestre/Turma: [preencher pelo autor]
- Titulo da APS: Desenvolvimento de uma aplicacao de sistema distribuido para
  dispositivo movel (Monitor Ambiental Urbano de Sao Paulo)
- Integrantes do grupo (nome e RA): [preencher pelo autor]
- Professor(a): [preencher pelo autor]
- Data de entrega: [preencher pelo autor]
- Nota / avaliacao: (reservado ao professor)
- Assinaturas dos integrantes: [preencher pelo autor]

> Observacao: substitua este texto pelo formulario oficial da Ficha de APS da
> UNIP, mantendo o titulo e a descricao do trabalho aqui indicados.

## 10.3 Resumo do trabalho (para a capa/apresentacao)

Aplicacao de sistema distribuido para dispositivo movel voltada ao gerenciamento
de informacoes ambientais urbanas da cidade de Sao Paulo (SP). E composta por um
cliente movel (React Native/Expo), um servidor de API REST (FastAPI/Python) e um
banco de dados (SQLite, migravel para PostgreSQL). Reune tres assuntos ancorados
em fontes e autoridades oficiais: **transporte publico** com a SPTrans Olho Vivo
(fonte OFICIAL da Prefeitura de SP, tempo real com token gratuito e fallback de
exemplo sem token); **qualidade do ar** com a Open-Meteo Air Quality API (dado
operacional) tendo a CETESB/QUALAR como autoridade oficial de referencia; e
**alagamento** com a Open-Meteo Flood API / GloFAS (dado operacional) tendo o
CGE-SP como autoridade oficial de referencia. A base geografica usa a API oficial
do IBGE (UF 35 = SP). Oferece consulta por regiao ligada a um mapa enquadrado em
Sao Paulo, relatorios agregados (com grafico de barras), alertas por limiar e
tratamento de erros padronizado. A documentacao completa esta nos arquivos
numerados desta pasta `docs/` (ver `00_LEIA-ME.md`).
