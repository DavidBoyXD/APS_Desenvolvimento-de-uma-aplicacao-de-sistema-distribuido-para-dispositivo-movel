# 10. Capa e Ficha de APS

Os dados desta página dependem de informações pessoais e institucionais do autor.
Para não inventar dados, os campos estão marcados como `[preencher pelo autor]`.

## 10.1 Capa

```
UNIVERSIDADE PAULISTA - UNIP

Curso: Ciencia da Computacao
Disciplina: Sistemas Distribuidos (SD)
Semestre: 7o / 8o

Atividades Praticas Supervisionadas (APS)

Titulo do trabalho:
Desenvolvimento de uma aplicacao de sistema distribuido para dispositivo movel
- Monitor de Transporte Publico de Sao Paulo (SPTrans Olho Vivo)

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

A ficha de APS é o formulário padrão da UNIP entregue junto ao trabalho. Os
campos abaixo devem ser preenchidos e assinados pelo autor conforme o modelo
oficial fornecido pela instituição:

- Nome da instituição: Universidade Paulista (UNIP)
- Curso: Ciência da Computação
- Disciplina: Sistemas Distribuídos
- Semestre/Turma: [preencher pelo autor]
- Título da APS: Desenvolvimento de uma aplicação de sistema distribuído para
  dispositivo móvel (Monitor de Transporte Público de São Paulo)
- Integrantes do grupo (nome e RA): [preencher pelo autor]
- Professor(a): [preencher pelo autor]
- Data de entrega: [preencher pelo autor]
- Nota / avaliação: (reservado ao professor)
- Assinaturas dos integrantes: [preencher pelo autor]

> Observação: substitua este texto pelo formulário oficial da Ficha de APS da
> UNIP, mantendo o título e a descrição do trabalho aqui indicados.

## 10.3 Resumo do trabalho (para a capa/apresentação)

Aplicação de sistema distribuído para dispositivo móvel voltada ao monitoramento
do transporte público (frota de ônibus) da cidade de São Paulo (SP). É composta
por um cliente móvel (React Native/Expo), um servidor de API REST (FastAPI/Python)
e um banco de dados (SQLite, migrável para PostgreSQL). Apoia-se em fontes
OFICIAIS: **transporte público** com a SPTrans Olho Vivo (fonte OFICIAL da
Prefeitura de SP, tempo real com token gratuito e fallback de exemplo sem token) e
**base geográfica** com a API oficial do IBGE (UF 35 = SP). Oferece consulta por
região ligada a um mapa enquadrado em São Paulo, relatórios agregados (com gráfico
de barras), alertas por limiar e tratamento de erros padronizado. A documentação
completa está nos arquivos numerados desta pasta `docs/` (ver `00_LEIA-ME.md`).
