"""Entrypoint da API REST (FastAPI) do sistema distribuído de transporte público.

Arquitetura (sistema distribuído):
    App móvel (cliente Expo/React Native)
        <-> API REST (este servidor FastAPI)
            <-> Banco de dados (SQLite; migrável para PostgreSQL)

Responsabilidades deste módulo:
- Cria a aplicação FastAPI com título/descrição em PT-BR (aparecem no Swagger
  em /docs).
- Registra os routers (regiões, medições, relatórios, alertas, saúde) sob o
  prefixo /api/v1.
- Registra os exception handlers globais (tratamento de erros padronizado).
- Habilita CORS para o app Expo poder consumir a API.
- No startup, cria as tabelas e roda o seed idempotente.
- Mantém GET /health para monitoramento e testes de fumaça.

Referências:
- FastAPI: https://fastapi.tiangolo.com/
- CORS no FastAPI: https://fastapi.tiangolo.com/tutorial/cors/
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401 - importa para registrar as tabelas na Base
from .database import Base, SessionLocal, engine
from .errors import registrar_handlers
from .routers import alertas, localidades, medicoes, regioes, relatorios, saude
from .seed import executar_seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ciclo de vida: cria tabelas e roda o seed idempotente no startup."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        executar_seed(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="API Transporte Publico SP - APS SD",
    description=(
        "Back-end do sistema distribuido para informacoes de transporte publico "
        "de Sao Paulo. A fonte de medicoes e real e verificavel: SPTrans Olho "
        "Vivo (frota de onibus da capital em tempo real). A base geografica "
        "(municipio/UF) e validada pela API de Localidades do IBGE. Oferece "
        "consulta por regiao (para o mapa), relatorios agregados, alertas por "
        "limiar e tratamento de erros padronizado."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS liberado para o app Expo (em dev, o cliente roda em host/porta variável).
# ATENÇÃO (produção): allow_origins=["*"] é proposital apenas para o contexto de
# desenvolvimento/APS, em que o endereço do cliente muda (emulador, dispositivo
# físico, web). Em produção, restrinja allow_origins à lista de domínios/hosts
# confiáveis do app. Ver: https://fastapi.tiangolo.com/tutorial/cors/
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tratamento de erros global (respostas padronizadas em PT-BR).
registrar_handlers(app)

# Rotas versionadas.
app.include_router(saude.router)
app.include_router(regioes.router)
app.include_router(localidades.router)
app.include_router(medicoes.router)
app.include_router(relatorios.router)
app.include_router(alertas.router)


@app.get("/health", tags=["saude"])
def health() -> dict:
    """Health check simples usado para monitoramento e testes de fumaça."""
    return {"status": "ok"}
