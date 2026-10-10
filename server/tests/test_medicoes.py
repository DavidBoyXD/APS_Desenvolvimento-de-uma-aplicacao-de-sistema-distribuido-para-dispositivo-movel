"""Testes dos endpoints genericos de medicoes (listagem e filtro por tipo).

A atualizacao via SPTrans tem cobertura dedicada em test_transporte.py; aqui
cobrimos apenas os GET genericos sobre os dados do seed.
"""


def test_listar_medicoes(client) -> None:
    """GET /api/v1/medicoes retorna a lista de medicoes do seed."""
    resp = client.get("/api/v1/medicoes")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_filtrar_medicoes_por_tipo(client) -> None:
    """Filtro por tipo=transporte_publico retorna apenas medicoes desse tipo."""
    resp = client.get("/api/v1/medicoes", params={"tipo": "transporte_publico"})
    assert resp.status_code == 200
    dados = resp.json()
    assert len(dados) >= 1
    assert all(m["tipo"] == "transporte_publico" for m in dados)


def test_medicoes_da_regiao(client) -> None:
    """GET /api/v1/regioes/{id}/medicoes retorna as medicoes da regiao."""
    regiao_id = client.get("/api/v1/regioes").json()[0]["id"]
    resp = client.get(f"/api/v1/regioes/{regiao_id}/medicoes")
    assert resp.status_code == 200
    assert all(m["regiao_id"] == regiao_id for m in resp.json())
