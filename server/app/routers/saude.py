"""Router de saude (health check) sob o prefixo /api/v1.

Complementa a rota raiz /health, permitindo que o cliente movel verifique a
disponibilidade do servidor pelo mesmo prefixo versionado das demais rotas.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/v1", tags=["saude"])


@router.get("/saude")
def saude() -> dict:
    """Retorna o estado do servidor."""
    return {"status": "ok"}
