"""Entrypoint da API REST (FastAPI).

Nesta FEAT-001 expomos apenas a rota de saude (health check), que serve de
baseline verde e permite ao cliente movel e a ferramentas de monitoramento
verificar se o servidor esta no ar. As demais rotas (regioes, medicoes,
alertas, relatorios) serao adicionadas nas features seguintes.

Referencia FastAPI: https://fastapi.tiangolo.com/
"""

from fastapi import FastAPI

app = FastAPI(
    title="API Ambiental Urbana - APS SD",
    description=(
        "Back-end do sistema distribuido para gerenciamento de informacoes "
        "ambientais urbanas (qualidade do ar, transito, alagamento)."
    ),
    version="0.1.0",
)


@app.get("/health", tags=["saude"])
def health() -> dict:
    """Health check simples usado para monitoramento e testes de fumaca."""
    return {"status": "ok"}
