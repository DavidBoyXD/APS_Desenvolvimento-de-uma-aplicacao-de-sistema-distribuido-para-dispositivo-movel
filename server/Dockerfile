# ===========================================================================
# Dockerfile do back-end (FastAPI + Uvicorn).
#
# Contexto de build: este Dockerfile deve ser construido a partir do diretorio
# server/ (ou seja, o "Root Directory" do servico de hospedagem deve apontar
# para server/). Assim o import "app.main:app" resolve corretamente.
#
# Porta dinamica (PaaS): servicos como Render, Railway e Fly.io injetam a porta
# pela variavel de ambiente PORT. O CMD usa a forma shell para expandir
# ${PORT:-8000}, escutando na porta injetada (ou 8000 como padrao local).
# ===========================================================================

FROM python:3.11-slim

# Evita arquivos .pyc e garante logs sem buffer (melhor para PaaS).
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Instala dependencias primeiro (cache de camada) a partir do requirements.txt.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copia o restante do codigo do servidor (conteudo de server/).
COPY . .

# Porta informativa (o valor efetivo vem de ${PORT:-8000} no CMD).
EXPOSE 8000

# Forma shell para expandir a variavel de ambiente PORT em runtime.
CMD sh -c "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"
