"""Testes da fonte real de alagamento (Open-Meteo Flood API / GloFAS).

A rede e SEMPRE mockada (monkeypatch + httpx.MockTransport): os testes nunca
chamam a Flood API real. Espelham o padrao dos testes da Overpass em
test_transito.py.
"""

import httpx
import pytest

from app.services import flood
from app.services.flood import LeituraAlagamento, FloodError


def test_mapear_payload_flood(payload_flood) -> None:
    """Valida as metricas derivadas do payload real da Flood API (fixture JSON).

    Serie river_discharge: [61.95, 73.64, null, 88.12, 90.5]
    - valor nao-nulo mais recente -> 90.5 (2026-10-02), unidade 'm3/s' lida de
      daily_units;
    - media a partir de river_discharge_mean [60.1, 70.0, 80.0, 85.0, 88.0] -> 76.62;
    - maxima a partir de river_discharge_max [65.0, 78.0, 90.0, 95.0, 99.5] -> 99.5.
    """
    leituras = flood.mapear_payload(payload_flood)
    por_parametro = {l.parametro: l for l in leituras}

    assert por_parametro["river_discharge"].valor == 90.5
    assert por_parametro["river_discharge"].unidade == "m3/s"
    assert por_parametro["river_discharge"].timestamp == "2026-10-02"

    assert por_parametro["river_discharge_media"].valor == 76.62
    assert por_parametro["river_discharge_media"].unidade == "m3/s"
    # Agregados do periodo nao carregam um dia especifico (timestamp None).
    assert por_parametro["river_discharge_media"].timestamp is None

    assert por_parametro["river_discharge_maxima"].valor == 99.5
    assert por_parametro["river_discharge_maxima"].unidade == "m3/s"
    assert por_parametro["river_discharge_maxima"].timestamp is None


def test_mapear_payload_flood_fallback_sem_series_dedicadas() -> None:
    """Sem river_discharge_mean/max, a media/maxima vem da serie river_discharge.

    Cobre o ramo de fallback do mapear_payload: quando a API nao devolve as
    series dedicadas, a media e a media aritmetica dos valores nao-nulos de
    river_discharge e a maxima e o maximo deles. Os agregados seguem sem
    timestamp (resumem o periodo).
    """
    payload = {
        "daily_units": {"time": "iso8601", "river_discharge": "m3/s"},
        "daily": {
            "time": ["2026-09-28", "2026-09-29", "2026-09-30"],
            "river_discharge": [10.0, None, 20.0],
        },
    }
    por_parametro = {l.parametro: l for l in flood.mapear_payload(payload)}

    # Descarga atual: valor nao-nulo mais recente (20.0 em 2026-09-30).
    assert por_parametro["river_discharge"].valor == 20.0
    assert por_parametro["river_discharge"].timestamp == "2026-09-30"
    # Media dos validos [10.0, 20.0] = 15.0; maxima = 20.0; ambos sem timestamp.
    assert por_parametro["river_discharge_media"].valor == 15.0
    assert por_parametro["river_discharge_media"].timestamp is None
    assert por_parametro["river_discharge_maxima"].valor == 20.0
    assert por_parametro["river_discharge_maxima"].timestamp is None


def test_mapear_payload_flood_sem_valores_validos() -> None:
    """Serie so com nulos (nenhuma leitura valida) levanta FloodError."""
    payload = {
        "daily_units": {"time": "iso8601", "river_discharge": "m3/s"},
        "daily": {
            "time": ["2026-09-28", "2026-09-29"],
            "river_discharge": [None, None],
        },
    }
    with pytest.raises(FloodError):
        flood.mapear_payload(payload)


def test_mapear_payload_flood_invalido() -> None:
    """Payload sem 'daily' levanta FloodError (tratado)."""
    with pytest.raises(FloodError):
        flood.mapear_payload({})


def test_mapear_payload_flood_corpo_de_erro() -> None:
    """Corpo de erro {'error': True, 'reason': ...} levanta FloodError."""
    payload = {"error": True, "reason": "Latitude must be in range of -90 to 90."}
    with pytest.raises(FloodError):
        flood.mapear_payload(payload)


def test_atualizar_alagamento_mockado(client, monkeypatch) -> None:
    """POST atualizar-alagamento persiste as metricas retornadas pelo servico."""

    def fake_buscar(latitude, longitude, client=None):
        return [
            LeituraAlagamento("river_discharge", 90.5, "m3/s", "2026-10-02"),
            LeituraAlagamento("river_discharge_media", 76.62, "m3/s", "2026-10-02"),
            LeituraAlagamento("river_discharge_maxima", 99.5, "m3/s", "2026-10-02"),
        ]

    # Mocka a funcao no modulo do router (import direto) para nao usar rede.
    monkeypatch.setattr("app.routers.medicoes.buscar_alagamento", fake_buscar)

    regiao_id = client.get("/api/v1/regioes").json()[0]["id"]
    resp = client.post(f"/api/v1/regioes/{regiao_id}/atualizar-alagamento")
    assert resp.status_code == 200
    dados = resp.json()
    assert len(dados) == 3
    assert all(d["tipo"] == "alagamento" for d in dados)
    assert {d["parametro"] for d in dados} == {
        "river_discharge",
        "river_discharge_media",
        "river_discharge_maxima",
    }
    # A fonte deve citar a Flood API / GloFAS.
    assert all(
        "Flood" in d["fonte"] or "GloFAS" in d["fonte"] for d in dados
    )


def test_atualizar_alagamento_falha_rede_tratada(client, monkeypatch) -> None:
    """Falha de rede vira 502 padronizado (nunca 500 cru)."""

    def fake_buscar(latitude, longitude, client=None):
        raise FloodError("timeout simulado")

    monkeypatch.setattr("app.routers.medicoes.buscar_alagamento", fake_buscar)

    regiao_id = client.get("/api/v1/regioes").json()[0]["id"]
    resp = client.post(f"/api/v1/regioes/{regiao_id}/atualizar-alagamento")
    assert resp.status_code == 502
    corpo = resp.json()
    assert corpo["codigo"] == 502
    assert "alagamento" in corpo["mensagem"].lower()


def test_buscar_alagamento_camada_http_envia_params(payload_flood) -> None:
    """Testa a camada HTTP de buscar_alagamento com um cliente httpx mockado.

    Usa ``httpx.MockTransport`` para NAO tocar a rede real. Captura a requisicao
    enviada e garante que os parametros ``latitude``, ``longitude`` e ``daily``
    foram enviados, e que a resposta valida e mapeada para as leituras.
    """
    requisicoes: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requisicoes.append(request)
        return httpx.Response(200, json=payload_flood)

    transporte = httpx.MockTransport(handler)
    with httpx.Client(transport=transporte) as cliente_mock:
        leituras = flood.buscar_alagamento(-23.55, -46.63, client=cliente_mock)

    # A requisicao HTTP foi de fato disparada e capturada.
    assert len(requisicoes) == 1
    requisicao = requisicoes[0]

    # Os parametros esperados foram enviados na query string.
    params = requisicao.url.params
    assert params.get("latitude") == "-23.55"
    assert params.get("longitude") == "-46.63"
    assert params.get("daily") == flood.DAILY_PARAMS

    # A resposta valida vira as metricas derivadas (mesmo mapeamento da fixture).
    por_parametro = {l.parametro: l for l in leituras}
    assert por_parametro["river_discharge"].valor == 90.5
    assert por_parametro["river_discharge_media"].valor == 76.62
    assert por_parametro["river_discharge_maxima"].valor == 99.5


@pytest.mark.parametrize("status_http", [400, 500])
def test_buscar_alagamento_camada_http_erro_vira_flood_error(status_http) -> None:
    """Erro HTTP na camada de rede e mapeado para ``FloodError``.

    Cobre o mapeamento de ``httpx.HTTPError`` -> ``FloodError`` para status de
    erro tipicos da Flood API (400 em parametro invalido, 500 generico).
    """

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_http)

    transporte = httpx.MockTransport(handler)
    with httpx.Client(transport=transporte) as cliente_mock:
        with pytest.raises(FloodError):
            flood.buscar_alagamento(-23.55, -46.63, client=cliente_mock)
