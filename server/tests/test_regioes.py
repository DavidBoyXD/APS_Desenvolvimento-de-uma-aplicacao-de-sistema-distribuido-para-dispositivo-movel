"""Testes dos endpoints de regioes."""


def test_listar_regioes(client) -> None:
    """GET /api/v1/regioes retorna as regioes do seed (>= 3)."""
    resp = client.get("/api/v1/regioes")
    assert resp.status_code == 200
    dados = resp.json()
    assert isinstance(dados, list)
    assert len(dados) >= 3
    # Coordenadas presentes para o mapa.
    assert all("latitude" in r and "longitude" in r for r in dados)


def test_obter_regiao_existente(client) -> None:
    """GET /api/v1/regioes/{id} de uma regiao valida retorna 200."""
    primeira = client.get("/api/v1/regioes").json()[0]
    resp = client.get(f"/api/v1/regioes/{primeira['id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == primeira["id"]


def test_obter_regiao_inexistente_404(client) -> None:
    """Regiao inexistente retorna 404 no schema ErroResposta em PT-BR."""
    resp = client.get("/api/v1/regioes/99999")
    assert resp.status_code == 404
    corpo = resp.json()
    assert corpo["codigo"] == 404
    assert "nao encontrada" in corpo["mensagem"].lower()
    assert "detalhe" in corpo
