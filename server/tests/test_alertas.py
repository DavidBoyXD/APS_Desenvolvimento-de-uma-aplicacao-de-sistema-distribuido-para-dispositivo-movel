"""Testes dos endpoints de alertas por limiar."""


def test_listar_alertas(client) -> None:
    """GET /api/v1/alertas retorna as regras do seed."""
    resp = client.get("/api/v1/alertas")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_criar_alerta_e_avaliar_dispara(client) -> None:
    """Criar alerta com limiar baixo e avaliar deve disparar o alerta."""
    regiao_id = client.get("/api/v1/regioes").json()[0]["id"]

    # A medicao seed de pm2_5 vale 12.5; limiar 5 com '>' deve disparar.
    nova = {
        "regiao_id": regiao_id,
        "tipo": "qualidade_ar",
        "parametro": "pm2_5",
        "limiar": 5.0,
        "condicao": ">",
        "ativo": True,
        "mensagem": "Teste: PM2.5 acima do limiar.",
    }
    criar = client.post("/api/v1/alertas", json=nova)
    assert criar.status_code == 201
    assert criar.json()["parametro"] == "pm2_5"

    avaliar = client.get(f"/api/v1/alertas/avaliar/{regiao_id}")
    assert avaliar.status_code == 200
    disparados = avaliar.json()
    assert any(
        d["parametro"] == "pm2_5" and d["valor_observado"] > d["limiar"]
        for d in disparados
    )


def test_criar_alerta_validacao_422(client) -> None:
    """Condicao invalida retorna 422 com schema de erro padronizado."""
    regiao_id = client.get("/api/v1/regioes").json()[0]["id"]
    invalido = {
        "regiao_id": regiao_id,
        "tipo": "qualidade_ar",
        "parametro": "pm2_5",
        "limiar": 5.0,
        "condicao": "!!",  # invalido: nao casa com ^[<>]$
    }
    resp = client.post("/api/v1/alertas", json=invalido)
    assert resp.status_code == 422
    corpo = resp.json()
    assert corpo["codigo"] == 422
    assert "invalidos" in corpo["mensagem"].lower()


def test_criar_alerta_regiao_inexistente_404(client) -> None:
    """Criar alerta para regiao inexistente retorna 404."""
    invalido = {
        "regiao_id": 99999,
        "tipo": "qualidade_ar",
        "parametro": "pm2_5",
        "limiar": 5.0,
        "condicao": ">",
    }
    resp = client.post("/api/v1/alertas", json=invalido)
    assert resp.status_code == 404
