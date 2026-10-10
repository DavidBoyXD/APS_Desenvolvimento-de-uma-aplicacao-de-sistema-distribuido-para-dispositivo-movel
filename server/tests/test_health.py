"""Teste do health check da API.

Usa o TestClient (fixture ``client`` do conftest, com banco de teste isolado)
para validar que GET /health responde 200 com {"status": "ok"}.

Referencia: https://fastapi.tiangolo.com/tutorial/testing/
"""


def test_health_ok(client) -> None:
    """GET /health deve retornar 200 e o corpo esperado."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_saude_versionada(client) -> None:
    """GET /api/v1/saude tambem responde 200."""
    response = client.get("/api/v1/saude")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
