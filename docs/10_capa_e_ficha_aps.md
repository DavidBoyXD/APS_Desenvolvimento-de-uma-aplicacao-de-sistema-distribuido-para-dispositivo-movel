# 10. Capa e Ficha de APS

Os dados do grupo (nomes e número de matrícula) estão preenchidos abaixo. O
único campo que depende de informação institucional específica e permanece
marcado como `[preencher pelo autor]` é a turma. Após preencher a turma, apague
a marcação `[preencher pelo autor]` e deixe apenas o valor.

## 10.1 Capa

```
UNIVERSIDADE PAULISTA - UNIP

Curso: Ciencia da Computacao
Disciplina: Desenvolvimento de Sistemas Distribuidos (DSD)
Semestre: 7o / 8o

Atividades Praticas Supervisionadas (APS)

Titulo do trabalho:
Desenvolvimento de uma aplicacao de sistema distribuido para dispositivo movel
- Monitoramento de transporte publico em SP

Alunos:
- David Andrew Deziderio Gomes Silva - F3530E8
- Carlos Henrique Santana Rodrigues - R013944
- Henrique Vitale Cassu - N916FJ2
- Marcelo Augusto de Souza Silva - F356JE0

Professora orientadora: Jacqueline Zonichenn
Campus: Paulista
Turma: [preencher pelo autor]
Cidade / UF: Sao Paulo - SP
Ano: 2026
```

## 10.2 Ficha de APS

A ficha de APS é o formulário padrão da UNIP entregue junto ao trabalho. Os
campos abaixo estão preenchidos com os dados do grupo; a turma, a data de
entrega e as assinaturas devem ser completadas pelo autor conforme o modelo
oficial fornecido pela instituição. Cada campo ainda marcado com
`[preencher pelo autor]` deve ter a marcação apagada depois que o valor correto
for inserido no lugar.

- Nome da instituição: Universidade Paulista (UNIP)
- Curso: Ciência da Computação
- Disciplina: Desenvolvimento de Sistemas Distribuídos (DSD)
- Semestre: 7º / 8º
- Ano: 2026
- Turma: [preencher pelo autor]
- Título da APS: Desenvolvimento de uma aplicação de sistema distribuído para
  dispositivo móvel - Monitoramento de transporte público em SP
- Integrantes do grupo (nome e número de matrícula):
  - David Andrew Dezidério Gomes Silva - F3530E8
  - Carlos Henrique Santana Rodrigues - R013944
  - Henrique Vitale Cassú - N916FJ2
  - Marcelo Augusto de Souza Silva - F356JE0
- Professora orientadora: Jacqueline Zonichenn
- Campus: Paulista
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
