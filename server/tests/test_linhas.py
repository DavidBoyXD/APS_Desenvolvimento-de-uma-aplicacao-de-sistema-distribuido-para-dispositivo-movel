"""Testes de acompanhamento de ônibus e busca (SPTrans Olho Vivo).

A REDE e o TOKEN são SEMPRE mockados: nenhum teste chama a API Olho Vivo real
nem usa um token real. Segue o modelo de test_transporte.py, cobrindo para cada
função/endpoint:

1) mapeamento puro do payload (fixtures no formato real documentado);
2) fluxo HTTP Autenticar -> endpoint (httpx.MockTransport), verificando os
   params (termosBusca/codigoLinha) e o reuso do cookie na MESMA sessão;
3) fallback sem token NÃO toca a rede e retorna exemplo rotulado;
4) erro externo (HTTP 401/500 ou autenticação false) -> SPTransError e, via
   endpoint, HTTP 502 em PT-BR no schema ErroResposta.
"""

import httpx
import pytest

from app.services import sptrans
from app.services.sptrans import ENV_TOKEN, SPTransError

TOKEN_FAKE = "token-de-teste-fake"


# ---------------------------------------------------------------------------
# 1) Mapeamento puro (payload -> dataclasses)
# ---------------------------------------------------------------------------
def test_mapear_linhas(payload_linha_buscar) -> None:
    linhas = sptrans.mapear_linhas(payload_linha_buscar)
    assert len(linhas) == 2
    primeira = linhas[0]
    assert primeira.codigo_linha == 1273
    assert primeira.letreiro == "8000"
    assert primeira.sentido == 1
    assert primeira.terminal_principal == "TERM. LAPA"
    assert primeira.terminal_secundario == "TERM. PINHEIROS"
    assert primeira.circular is False
    assert primeira.tempo_real is True


def test_mapear_linhas_invalido() -> None:
    with pytest.raises(SPTransError):
        sptrans.mapear_linhas({})


def test_mapear_posicao_linha(payload_posicao_linha) -> None:
    posicao = sptrans.mapear_posicao_linha(payload_posicao_linha)
    assert posicao.horario_referencia == "08:15"
    assert len(posicao.veiculos) == 2
    assert posicao.veiculos[0].prefixo == "11433"
    assert posicao.veiculos[0].acessivel is True
    assert posicao.veiculos[0].latitude == -23.5235
    assert posicao.tempo_real is True


def test_mapear_posicao_linha_invalido() -> None:
    with pytest.raises(SPTransError):
        sptrans.mapear_posicao_linha({"hr": "08:00"})


def test_mapear_previsao_linha(payload_previsao_linha) -> None:
    previsao = sptrans.mapear_previsao_linha(payload_previsao_linha)
    assert previsao.horario_referencia == "08:20"
    assert len(previsao.paradas) == 2
    parada = previsao.paradas[0]
    assert parada.codigo_parada == 700016767
    assert parada.nome == "PARADA BUTANTA B/C"
    assert len(parada.veiculos) == 2
    assert parada.veiculos[0].prefixo == "11433"
    assert parada.veiculos[0].horario_previsto == "08:25"
    # A segunda parada nao tem veiculos previstos.
    assert previsao.paradas[1].veiculos == []
    assert previsao.tempo_real is True


def test_mapear_previsao_linha_invalido() -> None:
    with pytest.raises(SPTransError):
        sptrans.mapear_previsao_linha({"hr": "08:00"})


def test_mapear_paradas(payload_parada_buscar) -> None:
    paradas = sptrans.mapear_paradas(payload_parada_buscar)
    assert len(paradas) == 2
    assert paradas[0].codigo == 340015329
    assert paradas[0].nome == "PRACA DA SE"
    assert paradas[0].endereco == "PCA DA SE/ R DA SE"
    assert paradas[0].latitude == -23.5501
    assert paradas[0].tempo_real is True


def test_mapear_paradas_invalido() -> None:
    with pytest.raises(SPTransError):
        sptrans.mapear_paradas({})


# ---------------------------------------------------------------------------
# 2) Fluxo HTTP Autenticar -> endpoint (verifica params e reuso de cookie)
# ---------------------------------------------------------------------------
def _handler_autenticado(caminho_esperado, params_esperados, payload, registro):
    """Cria um handler MockTransport que autentica e responde o payload.

    - /Login/Autenticar: verifica o token na querystring e devolve o cookie;
    - ``caminho_esperado``: verifica os params e o reuso do cookie da sessao.
    """

    def handler(request: httpx.Request) -> httpx.Response:
        registro.append(request)
        if request.url.path.endswith("/Login/Autenticar"):
            assert request.url.params.get("token") == TOKEN_FAKE
            resposta = httpx.Response(200, json=True)
            resposta.headers["set-cookie"] = "apManager=sessao-fake; Path=/"
            return resposta
        if request.url.path.endswith(caminho_esperado):
            # O cookie estabelecido na autenticacao deve ser reutilizado.
            assert "apManager=sessao-fake" in request.headers.get("cookie", "")
            for chave, valor in params_esperados.items():
                assert request.url.params.get(chave) == valor
            return httpx.Response(200, json=payload)
        raise AssertionError(f"Caminho inesperado: {request.url.path}")

    return handler


def test_buscar_linhas_camada_http(payload_linha_buscar, monkeypatch) -> None:
    monkeypatch.setenv(ENV_TOKEN, TOKEN_FAKE)
    registro: list[httpx.Request] = []
    handler = _handler_autenticado(
        "/Linha/Buscar", {"termosBusca": "8000"}, payload_linha_buscar, registro
    )
    with httpx.Client(transport=httpx.MockTransport(handler)) as mock:
        linhas = sptrans.buscar_linhas("8000", client=mock)

    assert len(registro) == 2
    assert registro[0].url.path.endswith("/Login/Autenticar")
    assert registro[1].url.path.endswith("/Linha/Buscar")
    assert linhas[0].codigo_linha == 1273


def test_buscar_posicoes_linha_camada_http(
    payload_posicao_linha, monkeypatch
) -> None:
    monkeypatch.setenv(ENV_TOKEN, TOKEN_FAKE)
    registro: list[httpx.Request] = []
    handler = _handler_autenticado(
        "/Posicao/Linha", {"codigoLinha": "1273"}, payload_posicao_linha, registro
    )
    with httpx.Client(transport=httpx.MockTransport(handler)) as mock:
        posicao = sptrans.buscar_posicoes_linha(1273, client=mock)

    assert len(registro) == 2
    assert registro[1].url.path.endswith("/Posicao/Linha")
    assert len(posicao.veiculos) == 2


def test_buscar_previsao_linha_camada_http(
    payload_previsao_linha, monkeypatch
) -> None:
    monkeypatch.setenv(ENV_TOKEN, TOKEN_FAKE)
    registro: list[httpx.Request] = []
    handler = _handler_autenticado(
        "/Previsao/Linha", {"codigoLinha": "1273"}, payload_previsao_linha, registro
    )
    with httpx.Client(transport=httpx.MockTransport(handler)) as mock:
        previsao = sptrans.buscar_previsao_linha(1273, client=mock)

    assert len(registro) == 2
    assert registro[1].url.path.endswith("/Previsao/Linha")
    assert len(previsao.paradas) == 2


def test_buscar_paradas_camada_http(payload_parada_buscar, monkeypatch) -> None:
    monkeypatch.setenv(ENV_TOKEN, TOKEN_FAKE)
    registro: list[httpx.Request] = []
    handler = _handler_autenticado(
        "/Parada/Buscar", {"termosBusca": "Se"}, payload_parada_buscar, registro
    )
    with httpx.Client(transport=httpx.MockTransport(handler)) as mock:
        paradas = sptrans.buscar_paradas("Se", client=mock)

    assert len(registro) == 2
    assert registro[1].url.path.endswith("/Parada/Buscar")
    assert paradas[0].codigo == 340015329


# ---------------------------------------------------------------------------
# 3) Fallback sem token NÃO toca a rede e retorna exemplo rotulado
# ---------------------------------------------------------------------------
def _handler_que_falha(request: httpx.Request) -> httpx.Response:  # pragma: no cover
    raise AssertionError("O fallback NAO deve tocar a rede.")


def test_fallback_sem_token_nao_toca_rede(monkeypatch) -> None:
    monkeypatch.delenv(ENV_TOKEN, raising=False)
    with httpx.Client(transport=httpx.MockTransport(_handler_que_falha)) as mock:
        linhas = sptrans.buscar_linhas("8000", client=mock)
        posicao = sptrans.buscar_posicoes_linha(1, client=mock)
        previsao = sptrans.buscar_previsao_linha(1, client=mock)
        paradas = sptrans.buscar_paradas("Se", client=mock)

    # Todos os retornos sao de EXEMPLO (NAO tempo real) e rotulados na fonte.
    assert linhas and all(l.tempo_real is False for l in linhas)
    assert all("EXEMPLO" in l.fonte for l in linhas)
    assert posicao.tempo_real is False and "EXEMPLO" in posicao.fonte
    assert posicao.veiculos
    assert previsao.tempo_real is False and "EXEMPLO" in previsao.fonte
    assert previsao.paradas
    assert paradas and all(p.tempo_real is False for p in paradas)
    assert all("EXEMPLO" in p.fonte for p in paradas)


# ---------------------------------------------------------------------------
# 4) Erro externo -> SPTransError (servico) e HTTP 502 PT-BR (endpoint)
# ---------------------------------------------------------------------------
def test_autenticacao_false_vira_sptrans_error(monkeypatch) -> None:
    monkeypatch.setenv(ENV_TOKEN, TOKEN_FAKE)

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/Login/Autenticar"):
            return httpx.Response(200, json=False)
        raise AssertionError("Nao deve chamar o endpoint sem autenticar.")

    with httpx.Client(transport=httpx.MockTransport(handler)) as mock:
        with pytest.raises(SPTransError):
            sptrans.buscar_linhas("8000", client=mock)


@pytest.mark.parametrize("status_http", [401, 500])
def test_erro_http_vira_sptrans_error(status_http, monkeypatch) -> None:
    monkeypatch.setenv(ENV_TOKEN, TOKEN_FAKE)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_http)

    with httpx.Client(transport=httpx.MockTransport(handler)) as mock:
        with pytest.raises(SPTransError):
            sptrans.buscar_posicoes_linha(1273, client=mock)


# ---------------------------------------------------------------------------
# Endpoints REST (TestClient) - fallback e erro externo -> 502
# ---------------------------------------------------------------------------
def test_endpoint_linhas_buscar_fallback(client, monkeypatch) -> None:
    """Sem token, GET /linhas/buscar retorna exemplo rotulado (nao tempo real)."""
    monkeypatch.delenv(ENV_TOKEN, raising=False)
    resp = client.get("/api/v1/linhas/buscar", params={"termo": "8000"})
    assert resp.status_code == 200
    dados = resp.json()
    assert isinstance(dados, list) and dados
    assert all(item["tempo_real"] is False for item in dados)


def test_endpoint_linhas_buscar_termo_obrigatorio(client) -> None:
    """GET /linhas/buscar sem 'termo' retorna 422 (validacao de Query)."""
    resp = client.get("/api/v1/linhas/buscar")
    assert resp.status_code == 422


def test_endpoint_posicoes_fallback(client, monkeypatch) -> None:
    monkeypatch.delenv(ENV_TOKEN, raising=False)
    resp = client.get("/api/v1/linhas/1273/posicoes")
    assert resp.status_code == 200
    dados = resp.json()
    assert dados["tempo_real"] is False
    assert "veiculos" in dados


def test_endpoint_previsao_fallback(client, monkeypatch) -> None:
    monkeypatch.delenv(ENV_TOKEN, raising=False)
    resp = client.get("/api/v1/linhas/1273/previsao")
    assert resp.status_code == 200
    dados = resp.json()
    assert dados["tempo_real"] is False
    assert "paradas" in dados


def test_endpoint_paradas_buscar_fallback(client, monkeypatch) -> None:
    monkeypatch.delenv(ENV_TOKEN, raising=False)
    resp = client.get("/api/v1/paradas/buscar", params={"termo": "Se"})
    assert resp.status_code == 200
    dados = resp.json()
    assert isinstance(dados, list) and dados
    assert all(item["tempo_real"] is False for item in dados)


def test_endpoint_linhas_buscar_erro_externo_502(client, monkeypatch) -> None:
    """Erro externo (SPTransError) vira HTTP 502 PT-BR (schema ErroResposta)."""
    monkeypatch.setenv(ENV_TOKEN, TOKEN_FAKE)

    def fake_buscar(termo, client=None):
        raise SPTransError("falha simulada")

    monkeypatch.setattr("app.routers.linhas.buscar_linhas", fake_buscar)

    resp = client.get("/api/v1/linhas/buscar", params={"termo": "8000"})
    assert resp.status_code == 502
    corpo = resp.json()
    assert corpo["codigo"] == 502
    assert "linhas" in corpo["mensagem"].lower()


def test_endpoint_posicoes_erro_externo_502(client, monkeypatch) -> None:
    monkeypatch.setenv(ENV_TOKEN, TOKEN_FAKE)

    def fake_buscar(codigo_linha, client=None):
        raise SPTransError("falha simulada")

    monkeypatch.setattr("app.routers.linhas.buscar_posicoes_linha", fake_buscar)

    resp = client.get("/api/v1/linhas/1273/posicoes")
    assert resp.status_code == 502
    assert resp.json()["codigo"] == 502
