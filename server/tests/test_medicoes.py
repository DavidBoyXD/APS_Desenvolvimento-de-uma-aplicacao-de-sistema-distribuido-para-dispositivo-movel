"""Testes dos endpoints de medicoes e da atualizacao via Open-Meteo (mockada)."""

from app.services import openmeteo
from app.services.openmeteo import LeituraAr, OpenMeteoError


def test_listar_medicoes(client) -> None:
    """GET /api/v1/medicoes retorna a lista de medicoes do seed."""
    resp = client.get("/api/v1/medicoes")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_filtrar_medicoes_por_tipo(client) -> None:
    """Filtro por tipo=qualidade_ar retorna apenas medicoes desse tipo."""
    resp = client.get("/api/v1/medicoes", params={"tipo": "qualidade_ar"})
    assert resp.status_code == 200
    dados = resp.json()
    assert len(dados) >= 1
    assert all(m["tipo"] == "qualidade_ar" for m in dados)


def test_medicoes_da_regiao(client) -> None:
    """GET /api/v1/regioes/{id}/medicoes retorna as medicoes da regiao."""
    regiao_id = client.get("/api/v1/regioes").json()[0]["id"]
    resp = client.get(f"/api/v1/regioes/{regiao_id}/medicoes")
    assert resp.status_code == 200
    assert all(m["regiao_id"] == regiao_id for m in resp.json())


def test_atualizar_ar_mockado(client, monkeypatch) -> None:
    """POST atualizar-ar persiste as leituras retornadas pelo servico (mock)."""

    def fake_buscar(latitude, longitude, client=None):
        return [
            LeituraAr("pm2_5", 13.1, "ug/m3", "2026-09-30T12:00"),
            LeituraAr("pm10", 25.8, "ug/m3", "2026-09-30T12:00"),
        ]

    # Mocka a funcao no modulo do router (import direto) para nao usar rede.
    monkeypatch.setattr(
        "app.routers.medicoes.buscar_qualidade_ar", fake_buscar
    )

    regiao_id = client.get("/api/v1/regioes").json()[0]["id"]
    resp = client.post(f"/api/v1/regioes/{regiao_id}/atualizar-ar")
    assert resp.status_code == 200
    dados = resp.json()
    assert len(dados) == 2
    assert {d["parametro"] for d in dados} == {"pm2_5", "pm10"}
    assert all(d["tipo"] == "qualidade_ar" for d in dados)


def test_atualizar_ar_falha_rede_tratada(client, monkeypatch) -> None:
    """Falha de rede vira 502 padronizado (nunca 500 cru)."""

    def fake_buscar(latitude, longitude, client=None):
        raise OpenMeteoError("timeout simulado")

    monkeypatch.setattr(
        "app.routers.medicoes.buscar_qualidade_ar", fake_buscar
    )

    regiao_id = client.get("/api/v1/regioes").json()[0]["id"]
    resp = client.post(f"/api/v1/regioes/{regiao_id}/atualizar-ar")
    assert resp.status_code == 502
    corpo = resp.json()
    assert corpo["codigo"] == 502
    assert "qualidade do ar" in corpo["mensagem"].lower()


def test_mapear_payload_openmeteo(payload_openmeteo) -> None:
    """Valida o mapeamento do payload real da Open-Meteo (fixture JSON)."""
    leituras = openmeteo.mapear_payload(payload_openmeteo)
    por_parametro = {l.parametro: l for l in leituras}
    # Deve pegar o valor mais recente de cada parametro.
    assert por_parametro["pm2_5"].valor == 13.1
    assert por_parametro["pm10"].valor == 25.8
    assert por_parametro["ozone"].valor == 45.9
    assert por_parametro["pm2_5"].timestamp == "2026-09-30T12:00"
    # A unidade e lida do bloco 'hourly_units' do payload (nao mais hardcoded).
    assert por_parametro["pm2_5"].unidade == "\u00b5g/m\u00b3"
    assert por_parametro["ozone"].unidade == "\u00b5g/m\u00b3"


def test_mapear_payload_sem_hourly_units_usa_fallback() -> None:
    """Sem 'hourly_units', o mapeamento cai no fallback de unidade padrao."""
    payload = {
        "hourly": {
            "time": ["2026-09-30T10:00", "2026-09-30T11:00"],
            "pm2_5": [10.0, 12.5],
        }
    }
    leituras = openmeteo.mapear_payload(payload)
    assert leituras[0].parametro == "pm2_5"
    assert leituras[0].valor == 12.5
    assert leituras[0].unidade == openmeteo.UNIDADE_PADRAO


def test_mapear_payload_invalido() -> None:
    """Payload sem 'hourly' levanta OpenMeteoError (tratado)."""
    import pytest

    with pytest.raises(OpenMeteoError):
        openmeteo.mapear_payload({})
