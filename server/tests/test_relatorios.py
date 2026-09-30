"""Testes do endpoint de relatorios agregados."""


def test_relatorio_regiao_agrega(client) -> None:
    """GET /api/v1/relatorios/regiao/{id} agrega medicoes por parametro."""
    regiao_id = client.get("/api/v1/regioes").json()[0]["id"]
    resp = client.get(f"/api/v1/relatorios/regiao/{regiao_id}")
    assert resp.status_code == 200
    corpo = resp.json()
    assert corpo["regiao"]["id"] == regiao_id
    assert corpo["total_medicoes"] >= 1
    assert len(corpo["resumos"]) >= 1
    resumo = corpo["resumos"][0]
    for campo in ("contagem", "media", "minimo", "maximo", "ultimo_valor"):
        assert campo in resumo
    assert resumo["minimo"] <= resumo["media"] <= resumo["maximo"]


def test_relatorio_regiao_inexistente_404(client) -> None:
    """Relatorio de regiao inexistente retorna 404 padronizado."""
    resp = client.get("/api/v1/relatorios/regiao/99999")
    assert resp.status_code == 404
    assert resp.json()["codigo"] == 404
