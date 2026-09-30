"""Teste do health check da API.

Usa o TestClient do FastAPI (baseado no Starlette/httpx) para validar que a
rota GET /health responde 200 com {"status": "ok"}.

Referencia: https://fastapi.tiangolo.com/tutorial/testing/
"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_ok() -> None:
    """GET /health deve retornar 200 e o corpo esperado."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
