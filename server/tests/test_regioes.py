"""Testes dos endpoints de regioes."""


def test_listar_regioes(client) -> None:
    """GET /api/v1/regioes retorna as regioes do seed (agora >= 10)."""
    resp = client.get("/api/v1/regioes")
    assert resp.status_code == 200
    dados = resp.json()
    assert isinstance(dados, list)
    # O seed foi expandido de 5 para 12 distritos reais da capital de SP.
    assert len(dados) >= 10
    # Coordenadas presentes para o mapa.
    assert all("latitude" in r and "longitude" in r for r in dados)


def test_listar_regioes_inclui_distritos_novos(client) -> None:
    """O seed expandido inclui os 5 originais e os novos distritos reais de SP."""
    dados = client.get("/api/v1/regioes").json()
    nomes = {r["nome"] for r in dados}
    # Os 5 originais continuam presentes.
    assert {"Se", "Pinheiros", "Mooca", "Santana", "Itaquera"} <= nomes
    # Novos distritos reais adicionados (nomes SEM acento, padrao dos dados).
    assert {
        "Santo Amaro",
        "Butanta",
        "Lapa",
        "Vila Mariana",
        "Ipiranga",
        "Penha",
        "Tatuape",
    } <= nomes
    # A primeira regiao (usada por indice nos testes de transporte) e "Se".
    assert dados[0]["nome"] == "Se"


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
