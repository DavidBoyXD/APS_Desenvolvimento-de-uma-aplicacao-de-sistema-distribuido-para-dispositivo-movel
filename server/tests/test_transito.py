"""Testes da fonte real de transito (Overpass API) e do endpoint (mockados).

A rede e SEMPRE mockada (monkeypatch): os testes nunca chamam a Overpass real.
Espelham o padrao dos testes da integracao Open-Meteo em test_medicoes.py.
"""

import httpx
import pytest

from app.services import overpass
from app.services.overpass import LeituraTransito, OverpassError


def test_mapear_payload_overpass(payload_overpass) -> None:
    """Valida as metricas derivadas do payload real da Overpass (fixture JSON).

    Fixture com 4 vias nomeadas (uma via sem nome e ignorada):
    - lanes validas: 2, 3, 4 (de '2;4') -> media 3.0
    - maxspeed: 50, 60, 40 e '30 mph' (~48.28) -> media 49.57
    """
    leituras = overpass.mapear_payload(payload_overpass)
    por_parametro = {l.parametro: l for l in leituras}

    assert por_parametro["vias_principais"].valor == 4.0
    assert por_parametro["vias_principais"].unidade == "vias"

    assert por_parametro["faixas_media"].valor == 3.0
    assert por_parametro["faixas_media"].unidade == "faixas"

    assert por_parametro["velocidade_maxima_media"].valor == 49.57
    assert por_parametro["velocidade_maxima_media"].unidade == "km/h"


def test_mapear_payload_overpass_invalido() -> None:
    """Payload sem 'elements' levanta OverpassError (tratado)."""
    with pytest.raises(OverpassError):
        overpass.mapear_payload({})


def test_mapear_payload_overpass_sem_vias_validas() -> None:
    """Payload so com vias sem nome levanta OverpassError."""
    payload = {"elements": [{"type": "way", "tags": {"highway": "primary"}}]}
    with pytest.raises(OverpassError):
        overpass.mapear_payload(payload)


def test_atualizar_transito_mockado(client, monkeypatch) -> None:
    """POST atualizar-transito persiste as metricas retornadas pelo servico."""

    def fake_buscar(latitude, longitude, client=None):
        return [
            LeituraTransito("vias_principais", 12.0, "vias"),
            LeituraTransito("faixas_media", 2.5, "faixas"),
            LeituraTransito("velocidade_maxima_media", 55.0, "km/h"),
        ]

    # Mocka a funcao no modulo do router (import direto) para nao usar rede.
    monkeypatch.setattr("app.routers.medicoes.buscar_transito", fake_buscar)

    regiao_id = client.get("/api/v1/regioes").json()[0]["id"]
    resp = client.post(f"/api/v1/regioes/{regiao_id}/atualizar-transito")
    assert resp.status_code == 200
    dados = resp.json()
    assert len(dados) == 3
    assert all(d["tipo"] == "transito" for d in dados)
    assert {d["parametro"] for d in dados} == {
        "vias_principais",
        "faixas_media",
        "velocidade_maxima_media",
    }
    # A fonte deve citar OpenStreetMap/Overpass (ODbL).
    assert all("OpenStreetMap" in d["fonte"] for d in dados)


def test_atualizar_transito_falha_rede_tratada(client, monkeypatch) -> None:
    """Falha de rede vira 502 padronizado (nunca 500 cru)."""

    def fake_buscar(latitude, longitude, client=None):
        raise OverpassError("timeout simulado")

    monkeypatch.setattr("app.routers.medicoes.buscar_transito", fake_buscar)

    regiao_id = client.get("/api/v1/regioes").json()[0]["id"]
    resp = client.post(f"/api/v1/regioes/{regiao_id}/atualizar-transito")
    assert resp.status_code == 502
    corpo = resp.json()
    assert corpo["codigo"] == 502
    assert "transito" in corpo["mensagem"].lower()


def test_buscar_transito_camada_http_envia_user_agent(payload_overpass) -> None:
    """Testa a camada HTTP de buscar_transito com um cliente httpx mockado.

    Usa ``httpx.MockTransport`` para NAO tocar a rede real. Captura a requisicao
    enviada e garante que:

    - o header ``User-Agent`` foi enviado e e igual a ``overpass.USER_AGENT``
      (remover o header quebraria este teste, cobrindo a lacuna da revisao);
    - o corpo (form) contem o parametro ``data`` com a query Overpass QL;
    - a resposta valida e mapeada para as ``LeituraTransito`` derivadas.
    """
    requisicoes: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requisicoes.append(request)
        return httpx.Response(200, json=payload_overpass)

    transporte = httpx.MockTransport(handler)
    with httpx.Client(transport=transporte) as cliente_mock:
        leituras = overpass.buscar_transito(
            -23.561, -46.656, client=cliente_mock
        )

    # A requisicao HTTP foi de fato disparada e capturada.
    assert len(requisicoes) == 1
    requisicao = requisicoes[0]

    # O header obrigatorio foi enviado com o valor esperado.
    assert requisicao.headers.get("User-Agent") == overpass.USER_AGENT

    # O corpo (form url-encoded) carrega o parametro 'data' com a query.
    corpo = requisicao.content.decode("utf-8")
    assert corpo.startswith("data=")
    assert "way" in corpo  # trecho da query Overpass QL

    # A resposta valida vira as metricas derivadas (mesmo mapeamento da fixture).
    por_parametro = {l.parametro: l for l in leituras}
    assert por_parametro["vias_principais"].valor == 4.0
    assert por_parametro["faixas_media"].valor == 3.0
    assert por_parametro["velocidade_maxima_media"].valor == 49.57


@pytest.mark.parametrize("status_http", [406, 500])
def test_buscar_transito_camada_http_erro_vira_overpass_error(status_http) -> None:
    """Erro HTTP na camada de rede e mapeado para ``OverpassError``.

    Cobre o mapeamento de ``httpx.HTTPError`` -> ``OverpassError`` para status
    de erro tipicos da Overpass (406 quando falta o User-Agent, 500 generico).
    """

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_http)

    transporte = httpx.MockTransport(handler)
    with httpx.Client(transport=transporte) as cliente_mock:
        with pytest.raises(OverpassError):
            overpass.buscar_transito(-23.561, -46.656, client=cliente_mock)
