"""Testes da fonte oficial de localidades (API do IBGE) e do endpoint (mockados).

A rede e SEMPRE mockada (monkeypatch / httpx.MockTransport): os testes nunca
chamam a API real do IBGE. Espelham o padrao de test_transito.py.
"""

import httpx
import pytest

from app.services import ibge
from app.services.ibge import IbgeError, MunicipioSP


def test_mapear_payload_ibge(payload_ibge) -> None:
    """Valida a extracao de municipios da LISTA do IBGE (fixture JSON).

    A fixture tem 5 municipios reais de SP (capital + RMSP). Verificamos que o
    id/nome sao extraidos e que a UF lida dos blocos aninhados e 'SP'.
    """
    municipios = ibge.mapear_payload(payload_ibge)
    assert len(municipios) == 5
    assert all(isinstance(m, MunicipioSP) for m in municipios)
    assert all(m.uf == "SP" for m in municipios)

    por_nome = {m.nome: m for m in municipios}
    assert por_nome["São Paulo"].id == 3550308
    assert por_nome["Guarulhos"].id == 3518800


def test_mapear_payload_ibge_invalido() -> None:
    """Payload que nao e uma lista levanta IbgeError (tratado)."""
    with pytest.raises(IbgeError):
        ibge.mapear_payload({"erro": "nao e lista"})


def test_mapear_payload_ibge_lista_vazia() -> None:
    """Lista sem municipios validos levanta IbgeError."""
    with pytest.raises(IbgeError):
        ibge.mapear_payload([{"foo": "bar"}])


def test_buscar_municipios_sp_camada_http(payload_ibge) -> None:
    """Testa a camada HTTP de buscar_municipios_sp com httpx.MockTransport.

    Usa ``httpx.MockTransport`` para NAO tocar a rede real. Garante que a
    requisicao e disparada para o endpoint do IBGE e que a resposta e mapeada.
    """
    requisicoes: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requisicoes.append(request)
        return httpx.Response(200, json=payload_ibge)

    transporte = httpx.MockTransport(handler)
    with httpx.Client(transport=transporte) as cliente_mock:
        municipios = ibge.buscar_municipios_sp(client=cliente_mock)

    assert len(requisicoes) == 1
    assert str(requisicoes[0].url) == ibge.IBGE_MUNICIPIOS_SP_URL

    por_nome = {m.nome: m for m in municipios}
    assert por_nome["São Paulo"].id == 3550308
    assert all(m.uf == "SP" for m in municipios)


@pytest.mark.parametrize("status_http", [404, 500])
def test_buscar_municipios_sp_erro_http_vira_ibge_error(status_http) -> None:
    """Erro HTTP na camada de rede e mapeado para ``IbgeError``."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_http)

    transporte = httpx.MockTransport(handler)
    with httpx.Client(transport=transporte) as cliente_mock:
        with pytest.raises(IbgeError):
            ibge.buscar_municipios_sp(client=cliente_mock)


def test_endpoint_localidades_sp_mockado(client, monkeypatch) -> None:
    """GET /localidades/sp retorna os municipios mockados (sem rede real)."""

    def fake_buscar(client=None):
        return [
            MunicipioSP(id=3550308, nome="São Paulo", uf="SP"),
            MunicipioSP(id=3518800, nome="Guarulhos", uf="SP"),
        ]

    monkeypatch.setattr(
        "app.routers.localidades.buscar_municipios_sp", fake_buscar
    )

    resp = client.get("/api/v1/localidades/sp")
    assert resp.status_code == 200
    dados = resp.json()
    assert len(dados) == 2
    assert {d["nome"] for d in dados} == {"São Paulo", "Guarulhos"}
    assert all(d["uf"] == "SP" for d in dados)


def test_endpoint_localidades_sp_falha_vira_502(client, monkeypatch) -> None:
    """Falha do IBGE vira 502 padronizado em PT-BR (nunca 500 cru)."""

    def fake_buscar(client=None):
        raise IbgeError("timeout simulado")

    monkeypatch.setattr(
        "app.routers.localidades.buscar_municipios_sp", fake_buscar
    )

    resp = client.get("/api/v1/localidades/sp")
    assert resp.status_code == 502
    corpo = resp.json()
    assert corpo["codigo"] == 502
    assert "sp" in corpo["mensagem"].lower() or "ibge" in corpo["mensagem"].lower()
