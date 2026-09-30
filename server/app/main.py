"""Entrypoint da API REST (FastAPI) do sistema distribuido ambiental urbano.

Arquitetura (sistema distribuido):
    App movel (cliente Expo/React Native)
        <-> API REST (este servidor FastAPI)
            <-> Banco de dados (SQLite; migravel para PostgreSQL)

Responsabilidades deste modulo:
- Cria a aplicacao FastAPI com titulo/descricao em PT-BR (aparecem no Swagger
  em /docs).
- Registra os routers (regioes, medicoes, relatorios, alertas, saude) sob o
  prefixo /api/v1.
- Registra os exception handlers globais (tratamento de erros padronizado).
- Habilita CORS para o app Expo poder consumir a API.
- No startup, cria as tabelas e roda o seed idempotente.
- Mantem GET /health para monitoramento e testes de fumaca.

Referencias:
- FastAPI: https://fastapi.tiangolo.com/
- CORS no FastAPI: https://fastapi.tiangolo.com/tutorial/cors/
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401 - importa para registrar as tabelas na Base
from .database import Base, SessionLocal, engine
from .errors import registrar_handlers
from .routers import alertas, medicoes, regioes, relatorios, saude
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
    title="API Ambiental Urbana - APS SD",
    description=(
        "Back-end do sistema distribuido para gerenciamento de informacoes "
        "ambientais urbanas. Nucleo: qualidade do ar (dados reais da Open-Meteo). "
        "Tipos adicionais: transito e alagamento (dados simulados). Oferece "
        "consulta por regiao (para o mapa), relatorios agregados, alertas por "
        "limiar e tratamento de erros padronizado."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS liberado para o app Expo (em dev, o cliente roda em host/porta variavel).
# ATENCAO (producao): allow_origins=["*"] e proposital apenas para o contexto de
# desenvolvimento/APS, em que o endereco do cliente muda (emulador, dispositivo
# fisico, web). Em producao, restrinja allow_origins a lista de dominios/hosts
# confiaveis do app. Ver: https://fastapi.tiangolo.com/tutorial/cors/
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
app.include_router(medicoes.router)
app.include_router(relatorios.router)
app.include_router(alertas.router)


@app.get("/health", tags=["saude"])
def health() -> dict:
    """Health check simples usado para monitoramento e testes de fumaca."""
    return {"status": "ok"}
