# Como hospedar o back-end (FastAPI) e integrar ao APK

Este guia explica, passo a passo, como publicar o **servidor FastAPI** (pasta
`server/`) em um serviço de hospedagem com plano gratuito e, em seguida, gerar o
**APK** do aplicativo apontando para esse endereço público. Ao final, o app
Android funcionará **em qualquer lugar** (inclusive no celular com dados móveis,
fora da rede local), e não apenas no emulador ou na rede local.

## Visão geral: por que hospedar o servidor

O aplicativo móvel é a parte **cliente** de um sistema distribuído: ele depende
de um **servidor FastAPI** para obter regiões, medições, relatórios e alertas.

- No emulador Android, o app fala com o servidor local pelo endereço
  `http://10.0.2.2:8000` (apelido do `localhost` da máquina). Isso **não**
  funciona em um celular físico.
- Para que o **APK instalado em um celular** funcione em qualquer rede, o
  servidor precisa estar acessível pela internet, em um endereço público **HTTPS**
  (por exemplo, `https://seu-servico.onrender.com`).

A ordem do processo é sempre: **publicar o servidor → obter a URL pública →
gerar o APK com essa URL**.

## O que já está pronto no repositório

A pasta `server/` já contém tudo o que o serviço de hospedagem precisa:

- **`server/Dockerfile`** — imagem baseada em `python:3.11-slim` que instala as
  dependências de `requirements.txt` e sobe o Uvicorn. O comando de inicialização
  usa a porta injetada pela plataforma:
  `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}`. Os PaaS gratuitos
  (Render, Railway, Fly.io) injetam a porta na variável de ambiente `PORT`; o
  servidor escuta nela automaticamente, sem necessidade de configuração manual.
- **`server/.dockerignore`** — mantém a imagem enxuta (exclui `data/`, `.venv/`,
  caches e testes).
- **`server/render.yaml`** — blueprint opcional do Render (descreve um Web Service
  Docker com health check em `/health`).
- **CORS liberado** (`allow_origins=["*"]`, sem credenciais) em
  `server/app/main.py`. Um APK empacotado não envia uma origem web tradicional,
  então liberar `*` (sem `allow_credentials`) é aceitável para esta demonstração
  acadêmica. Em um cenário de produção real, restrinja a lista de origens.
- **Health check** em `GET /health` (responde `{"status":"ok"}`), usado pelo
  serviço de hospedagem para saber se a aplicação subiu.

> **Importante (contexto de build):** o **Root Directory** do serviço deve
> apontar para **`server/`**. É a partir dessa pasta que o `Dockerfile` e o
> import `app.main:app` funcionam.

## Pré-requisitos

1. **Repositório no GitHub** (ou GitLab) com este projeto, acessível para
   conectar ao serviço de hospedagem.
2. **Conta gratuita no serviço escolhido.** Este guia usa o **Render**
   ([https://render.com](https://render.com)) como exemplo principal por ser
   simples e oferecer tanto o modo Docker quanto o modo nativo Python. Railway
   ([https://railway.app](https://railway.app)) e Fly.io
   ([https://fly.io](https://fly.io)) funcionam de forma equivalente usando o
   mesmo `Dockerfile`.

Tudo é feito pelo **site do serviço** (no navegador) e pela conta conectada ao
GitHub. Nenhum segredo precisa ser commitado no repositório.

## Caminho A — Docker via Render (recomendado)

Este caminho usa o `server/Dockerfile` e funciona de forma idêntica em Railway e
Fly.io (todos aceitam Dockerfile).

1. Acesse [https://dashboard.render.com](https://dashboard.render.com) e faça
   login.
2. Clique em **New → Web Service**.
3. Conecte a conta do GitHub e selecione o repositório deste projeto.
4. Configure o serviço:
   - **Root Directory:** `server`
   - **Language/Runtime:** `Docker` (o Render detecta o `server/Dockerfile`
     automaticamente quando o Root Directory é `server`).
   - **Instance Type / Plan:** `Free`.
   - **Health Check Path:** `/health`.
5. Clique em **Create Web Service**. O Render vai construir a imagem Docker e
   subir a aplicação. Acompanhe os logs; ao final, o serviço fica **Live**.
6. Anote a **URL pública** exibida no topo da página do serviço, no formato
   `https://SEU_SERVICO.onrender.com`. Guarde essa URL: ela será usada no build
   do APK.

> **Atalho opcional (blueprint):** em vez de configurar os campos na mão, é
> possível usar **New → Blueprint** e apontar para o arquivo `server/render.yaml`
> deste repositório. Ele já declara o Web Service Docker, o plano `free` e o
> health check `/health`.

## Caminho B — Nativo Python via Render (sem Docker)

Se preferir não usar Docker, o Render também constrói a aplicação diretamente a
partir do Python:

1. Em **New → Web Service**, conecte o repositório.
2. Configure:
   - **Root Directory:** `server`
   - **Language/Runtime:** `Python 3` (selecione a versão 3.11, se solicitado).
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type / Plan:** `Free`.
   - **Health Check Path:** `/health`.
3. Clique em **Create Web Service** e aguarde o deploy ficar **Live**.
4. Anote a **URL pública** (`https://SEU_SERVICO.onrender.com`).

> O `$PORT` no Start Command é essencial: o Render injeta a porta por essa
> variável de ambiente, e o servidor precisa escutar exatamente nela.

## Como testar o servidor publicado

Com o serviço **Live**, abra no navegador (trocando `SEU_SERVIDOR` pela URL pública):

- `https://SEU_SERVIDOR/health` — deve responder `{"status":"ok"}`.
- `https://SEU_SERVIDOR/docs` — abre o Swagger (documentação interativa da API).
- `https://SEU_SERVIDOR/api/v1/regioes` — lista as 12 regiões de São Paulo criadas
  pelo seed no startup.
- `https://SEU_SERVIDOR/api/v1/linhas/buscar?termo=8000` — busca de linhas de
  ônibus na SPTrans Olho Vivo (tempo real com `SPTRANS_TOKEN`; caso contrário,
  retorna linhas de exemplo com `tempo_real=false`).

Se esses três endereços responderem, o servidor está pronto para o APK.

## Passo de integração com o APK

Depois de ter a URL pública do servidor, gere o APK apontando para ela. O app lê
a base da API pela variável de ambiente `EXPO_PUBLIC_API_BASE_URL`, que é
**embutida no pacote em tempo de build** (o valor fica "congelado" no APK).

No terminal, **dentro da pasta `mobile/`** (após `eas login` e `eas init`,
conforme [mobile/BUILD_APK.md](../mobile/BUILD_APK.md)):

```bash
# Linux/macOS (define a variavel apenas para o comando de build)
EXPO_PUBLIC_API_BASE_URL=https://SEU_SERVIDOR eas build -p android --profile preview
```

```powershell
# Windows (PowerShell): defina a variavel e depois rode o build
$env:EXPO_PUBLIC_API_BASE_URL="https://SEU_SERVIDOR"
eas build -p android --profile preview
```

Troque `https://SEU_SERVIDOR` pela URL real (ex.:
`https://SEU_SERVICO.onrender.com`), **sem** barra no final. Esse é exatamente o
Passo 5/6 do guia [mobile/BUILD_APK.md](../mobile/BUILD_APK.md): aqui apenas se
usa a URL pública obtida acima no lugar do servidor local.

**Quem faz o quê, onde e quando:**

1. No **site do serviço** (Render), publica-se o servidor e copia-se a URL
   pública (*primeiro*).
2. No **terminal, na pasta `mobile/`**, roda-se o `eas build` com
   `EXPO_PUBLIC_API_BASE_URL=https://SEU_SERVIDOR` (*depois* de ter a URL).
3. O EAS gera o `.apk` na nuvem e devolve um link de download; instale no celular
   e o app passará a falar com o servidor público em qualquer rede.

## Nota sobre disco efêmero, seed e PostgreSQL (opcional)

Os planos gratuitos usam **disco efêmero**: o arquivo SQLite
(`server/data/app.db`) é **recriado a cada restart ou novo deploy**. Isso é
aceitável para esta demonstração acadêmica porque:

- o **seed idempotente** roda no startup e recria as 12 regiões de São Paulo
  automaticamente;
- as métricas de transporte, a posição/previsão dos ônibus e a busca de
  linhas/paradas são buscadas **em runtime** nas fontes oficiais (SPTrans Olho
  Vivo e IBGE), não dependendo de dados antigos no banco.

Token da SPTrans (opcional): o transporte em tempo real e os endpoints de
acompanhamento/busca de ônibus usam a SPTrans Olho Vivo, que exige um token
gratuito lido apenas da variável de ambiente `SPTRANS_TOKEN`. No serviço de
hospedagem, defina essa variável (ex.: em **Environment** no Render) para ter
dados em tempo real; sem ela, o servidor responde com o fallback de exemplo
(`tempo_real=false`), de modo que o deploy funciona mesmo sem o token. Nunca
comite o token no repositório.

Se, mais adiante, for desejada **persistência real** (dados sobrevivendo a
redeploys), isso é **opcional** e fora do escopo mínimo: basta provisionar um
**PostgreSQL gerenciado** (o Render oferece um plano gratuito) e definir a
variável de ambiente `DATABASE_URL` do Web Service para a URL de conexão, no
formato:

```
postgresql+psycopg://usuario:senha@host:5432/nome_do_banco
```

O código já lê `DATABASE_URL` da variável de ambiente
(`server/app/database.py`); usando PostgreSQL, adicione o driver
`psycopg[binary]` ao `server/requirements.txt`. Enquanto `DATABASE_URL` não for
definida, o servidor continua usando SQLite por padrão.

## Resumo

1. Publique `server/` no Render (Caminho A com Docker ou Caminho B nativo
   Python), com Root Directory `server` e health check `/health`.
2. Teste `https://SEU_SERVIDOR/health` e `https://SEU_SERVIDOR/docs`.
3. Gere o APK em `mobile/` com
   `EXPO_PUBLIC_API_BASE_URL=https://SEU_SERVIDOR eas build -p android --profile preview`.
4. Instale o `.apk` no celular — o app funcionará em qualquer rede.
