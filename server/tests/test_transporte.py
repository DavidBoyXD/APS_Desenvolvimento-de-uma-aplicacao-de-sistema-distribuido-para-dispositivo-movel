"""Testes da fonte oficial de transporte publico de SP (SPTrans Olho Vivo).

A REDE e o TOKEN sao SEMPRE mockados: nenhum teste chama a API Olho Vivo real
nem usa um token real. Espelha o padrao de test_transito.py (monkeypatch no
router + httpx.MockTransport na camada HTTP) e adiciona a cobertura do fluxo de
autenticacao (Autenticar -> Posicao) e do fallback sem token.
"""

import httpx
import pytest

from app.services import sptrans
from app.services.sptrans import (
    ENV_TOKEN,
    FONTE_FALLBACK,
    LeituraTransporte,
    SPTransError,
)


def test_mapear_payload_sptrans(payload_sptrans) -> None:
    """Valida as metricas derivadas do payload /Posicao (fixture JSON).

    Fixture com 3 linhas; veiculos: 2 + 3 + 0 = 5.
    """
    leituras = sptrans.mapear_payload(payload_sptrans)
    por_parametro = {l.parametro: l for l in leituras}

    assert por_parametro["linhas_monitoradas"].valor == 3.0
    assert por_parametro["linhas_monitoradas"].unidade == "linhas"

    assert por_parametro["veiculos_em_operacao"].valor == 5.0
    assert por_parametro["veiculos_em_operacao"].unidade == "veiculos"


def test_mapear_payload_sptrans_invalido() -> None:
    """Payload sem o bloco de linhas 'l' levanta SPTransError (tratado)."""
    with pytest.raises(SPTransError):
        sptrans.mapear_payload({})


def test_mapear_payload_sptrans_sem_linhas() -> None:
    """Payload com lista de linhas vazia levanta SPTransError."""
    with pytest.raises(SPTransError):
        sptrans.mapear_payload({"hr": "08:00", "l": []})


def test_atualizar_transporte_mockado(client, monkeypatch) -> None:
    """POST atualizar-transporte persiste as metricas retornadas pelo servico.

    Define SPTRANS_TOKEN (fake) para que o router rotule a fonte como oficial,
    mas mocka a funcao de busca para nao tocar a rede.
    """
    monkeypatch.setenv(ENV_TOKEN, "token-de-teste-fake")

    def fake_buscar(latitude, longitude, client=None):
        return [
            LeituraTransporte("linhas_monitoradas", 42.0, "linhas"),
            LeituraTransporte("veiculos_em_operacao", 318.0, "veiculos"),
        ]

    monkeypatch.setattr(
        "app.routers.medicoes.buscar_transporte_publico", fake_buscar
    )

    regiao_id = client.get("/api/v1/regioes").json()[0]["id"]
    resp = client.post(f"/api/v1/regioes/{regiao_id}/atualizar-transporte")
    assert resp.status_code == 200
    dados = resp.json()
    assert len(dados) == 2
    assert all(d["tipo"] == "transporte_publico" for d in dados)
    assert {d["parametro"] for d in dados} == {
        "linhas_monitoradas",
        "veiculos_em_operacao",
    }
    # Com token, a fonte deve citar o Olho Vivo (tempo real / oficial).
    assert all("Olho Vivo" in d["fonte"] for d in dados)


def test_atualizar_transporte_fallback_sem_token(client, monkeypatch) -> None:
    """Sem SPTRANS_TOKEN, o endpoint persiste o fallback rotulado (nao rede).

    O fallback nao toca a rede; a fonte das medicoes deve indicar que e dado de
    EXEMPLO (nao tempo real).
    """
    monkeypatch.delenv(ENV_TOKEN, raising=False)

    regiao_id = client.get("/api/v1/regioes").json()[0]["id"]
    resp = client.post(f"/api/v1/regioes/{regiao_id}/atualizar-transporte")
    assert resp.status_code == 200
    dados = resp.json()
    assert len(dados) == 1
    assert dados[0]["tipo"] == "transporte_publico"
    assert dados[0]["parametro"] == "linhas_exemplo"
    # O valor e a quantidade de linhas do conjunto de exemplo.
    assert dados[0]["valor"] == float(len(sptrans.LINHAS_EXEMPLO))
    # A fonte do fallback deixa explicito que e EXEMPLO e nao tempo real.
    assert "EXEMPLO" in dados[0]["fonte"]
    assert dados[0]["fonte"] == FONTE_FALLBACK


def test_atualizar_transporte_acumula_historico(client, monkeypatch) -> None:
    """Chamar atualizar-transporte DUAS vezes ACUMULA o historico.

    Cada atualizacao do tipo transporte_publico INSERE novas medicoes em vez de
    substituir as anteriores, de modo que apos a 2a chamada a regiao tenha o
    DOBRO de medicoes (2 leituras por chamada). Isso da ao relatorio amostras >
    1 por parametro (estatistica real), sem a multiplicacao descontrolada
    (limitada pela poda testada em test_atualizar_transporte_limita_historico).
    """
    monkeypatch.setenv(ENV_TOKEN, "token-de-teste-fake")

    def fake_buscar(latitude, longitude, client=None):
        return [
            LeituraTransporte("linhas_monitoradas", 42.0, "linhas"),
            LeituraTransporte("veiculos_em_operacao", 318.0, "veiculos"),
        ]

    monkeypatch.setattr(
        "app.routers.medicoes.buscar_transporte_publico", fake_buscar
    )

    # Usa a ULTIMA regiao, para nao depender do estado deixado por outros testes
    # na primeira regiao (o banco de teste e compartilhado na sessao).
    regiao_id = client.get("/api/v1/regioes").json()[-1]["id"]

    def contar_por_parametro() -> dict:
        medicoes = client.get("/api/v1/regioes/%d/medicoes" % regiao_id).json()
        contagem: dict[str, int] = {}
        for m in medicoes:
            if m["tipo"] == "transporte_publico":
                contagem[m["parametro"]] = contagem.get(m["parametro"], 0) + 1
        return contagem

    antes = contar_por_parametro()

    primeira = client.post(f"/api/v1/regioes/{regiao_id}/atualizar-transporte")
    assert primeira.status_code == 200
    quantidade_primeira = len(primeira.json())
    assert quantidade_primeira == 2

    segunda = client.post(f"/api/v1/regioes/{regiao_id}/atualizar-transporte")
    assert segunda.status_code == 200
    # A resposta de cada chamada traz apenas as medicoes recem-inseridas.
    assert len(segunda.json()) == quantidade_primeira

    # O historico ACUMULA: cada parametro GANHA uma amostra por chamada (duas
    # chamadas => +2 por parametro em relacao ao estado anterior).
    depois = contar_por_parametro()
    for parametro in ("linhas_monitoradas", "veiculos_em_operacao"):
        assert depois.get(parametro, 0) == antes.get(parametro, 0) + 2
        # Apos duas chamadas, ha MAIS de uma amostra por parametro.
        assert depois[parametro] >= 2

    # O relatorio reflete a contagem acumulada (amostras > 1) por parametro.
    relatorio = client.get(f"/api/v1/relatorios/regiao/{regiao_id}").json()
    resumos = {r["parametro"]: r for r in relatorio["resumos"]}
    assert resumos["linhas_monitoradas"]["contagem"] >= 2
    assert resumos["veiculos_em_operacao"]["contagem"] >= 2


def test_atualizar_transporte_limita_historico(client, monkeypatch) -> None:
    """Muitas atualizacoes nao fazem o historico passar do limite (50).

    Apos MUITAS chamadas, a contagem por (regiao, tipo, parametro) estabiliza em
    LIMITE_HISTORICO_POR_PARAMETRO (50), nunca crescendo indefinidamente. A poda
    mantem as medicoes mais recentes.
    """
    from app.routers.medicoes import LIMITE_HISTORICO_POR_PARAMETRO

    monkeypatch.setenv(ENV_TOKEN, "token-de-teste-fake")

    def fake_buscar(latitude, longitude, client=None):
        return [
            LeituraTransporte("linhas_monitoradas", 42.0, "linhas"),
            LeituraTransporte("veiculos_em_operacao", 318.0, "veiculos"),
        ]

    monkeypatch.setattr(
        "app.routers.medicoes.buscar_transporte_publico", fake_buscar
    )

    regiao_id = client.get("/api/v1/regioes").json()[0]["id"]

    # Faz mais chamadas que o limite para garantir que a poda estabiliza a serie.
    total_chamadas = LIMITE_HISTORICO_POR_PARAMETRO + 10
    for _ in range(total_chamadas):
        resp = client.post(f"/api/v1/regioes/{regiao_id}/atualizar-transporte")
        assert resp.status_code == 200

    medicoes = client.get("/api/v1/regioes/%d/medicoes" % regiao_id).json()
    transporte = [m for m in medicoes if m["tipo"] == "transporte_publico"]

    por_parametro: dict[str, int] = {}
    for m in transporte:
        por_parametro[m["parametro"]] = por_parametro.get(m["parametro"], 0) + 1

    # Cada parametro estabiliza exatamente no limite (nunca acima).
    assert por_parametro["linhas_monitoradas"] == LIMITE_HISTORICO_POR_PARAMETRO
    assert por_parametro["veiculos_em_operacao"] == LIMITE_HISTORICO_POR_PARAMETRO

    # O relatorio agregado tambem reflete a contagem limitada por parametro.
    relatorio = client.get(f"/api/v1/relatorios/regiao/{regiao_id}").json()
    resumos = {r["parametro"]: r for r in relatorio["resumos"]}
    assert resumos["linhas_monitoradas"]["contagem"] == (
        LIMITE_HISTORICO_POR_PARAMETRO
    )
    assert resumos["veiculos_em_operacao"]["contagem"] == (
        LIMITE_HISTORICO_POR_PARAMETRO
    )


def test_atualizar_transporte_falha_rede_tratada(client, monkeypatch) -> None:
    """Falha de rede vira 502 padronizado (nunca 500 cru)."""
    monkeypatch.setenv(ENV_TOKEN, "token-de-teste-fake")

    def fake_buscar(latitude, longitude, client=None):
        raise SPTransError("timeout simulado")

    monkeypatch.setattr(
        "app.routers.medicoes.buscar_transporte_publico", fake_buscar
    )

    regiao_id = client.get("/api/v1/regioes").json()[0]["id"]
    resp = client.post(f"/api/v1/regioes/{regiao_id}/atualizar-transporte")
    assert resp.status_code == 502
    corpo = resp.json()
    assert corpo["codigo"] == 502
    assert "transporte" in corpo["mensagem"].lower()


def test_buscar_transporte_fallback_sem_token_nao_toca_rede(monkeypatch) -> None:
    """Sem SPTRANS_TOKEN, buscar_transporte_publico retorna o exemplo rotulado.

    Garante que NENHUMA requisicao HTTP e feita: passamos um MockTransport que
    falha o teste se for acionado.
    """
    monkeypatch.delenv(ENV_TOKEN, raising=False)

    def handler(request: httpx.Request) -> httpx.Response:  # pragma: no cover
        raise AssertionError("O fallback NAO deve tocar a rede.")

    transporte = httpx.MockTransport(handler)
    with httpx.Client(transport=transporte) as cliente_mock:
        leituras = sptrans.buscar_transporte_publico(
            -23.561, -46.656, client=cliente_mock
        )

    assert len(leituras) == 1
    assert leituras[0].parametro == "linhas_exemplo"
    assert leituras[0].valor == float(len(sptrans.LINHAS_EXEMPLO))
    assert "EXEMPLO" in (leituras[0].detalhe or "")


def test_buscar_transporte_camada_http_autenticar_e_posicao(
    payload_sptrans, monkeypatch
) -> None:
    """Testa o fluxo HTTP Autenticar -> Posicao com httpx.MockTransport.

    O handler verifica o token na querystring do /Login/Autenticar (sem token
    real), devolve o cookie de sessao e, no /Posicao, responde o payload de
    exemplo. Valida que:

    - a autenticacao foi chamada com o token lido de SPTRANS_TOKEN;
    - a sessao (cookie) foi estabelecida e a chamada seguinte usou o MESMO
      cliente;
    - a resposta de /Posicao foi mapeada para as LeituraTransporte derivadas.
    """
    token_fake = "token-de-teste-fake"
    monkeypatch.setenv(ENV_TOKEN, token_fake)

    requisicoes: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requisicoes.append(request)
        if request.url.path.endswith("/Login/Autenticar"):
            # Verifica o token na querystring (NAO e um token real).
            assert request.url.params.get("token") == token_fake
            resposta = httpx.Response(200, json=True)
            resposta.headers["set-cookie"] = "apManager=sessao-fake; Path=/"
            return resposta
        if request.url.path.endswith("/Posicao"):
            # A sessao estabelecida deve reutilizar o cookie no mesmo cliente.
            assert "apManager=sessao-fake" in request.headers.get("cookie", "")
            return httpx.Response(200, json=payload_sptrans)
        raise AssertionError(f"Caminho inesperado: {request.url.path}")

    transporte = httpx.MockTransport(handler)
    with httpx.Client(transport=transporte) as cliente_mock:
        leituras = sptrans.buscar_transporte_publico(
            -23.561, -46.656, client=cliente_mock
        )

    # Duas requisicoes: Autenticar e Posicao, nessa ordem.
    assert len(requisicoes) == 2
    assert requisicoes[0].url.path.endswith("/Login/Autenticar")
    assert requisicoes[1].url.path.endswith("/Posicao")

    por_parametro = {l.parametro: l for l in leituras}
    assert por_parametro["linhas_monitoradas"].valor == 3.0
    assert por_parametro["veiculos_em_operacao"].valor == 5.0


def test_buscar_transporte_autenticacao_falha_vira_sptrans_error(
    monkeypatch,
) -> None:
    """Autenticacao que retorna false (token invalido) vira SPTransError."""
    monkeypatch.setenv(ENV_TOKEN, "token-de-teste-fake")

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/Login/Autenticar"):
            return httpx.Response(200, json=False)
        raise AssertionError("Nao deve chamar /Posicao sem autenticar.")

    transporte = httpx.MockTransport(handler)
    with httpx.Client(transport=transporte) as cliente_mock:
        with pytest.raises(SPTransError):
            sptrans.buscar_transporte_publico(
                -23.561, -46.656, client=cliente_mock
            )


@pytest.mark.parametrize("status_http", [401, 500])
def test_buscar_transporte_erro_http_vira_sptrans_error(
    status_http, monkeypatch
) -> None:
    """Erro HTTP na autenticacao e mapeado para SPTransError."""
    monkeypatch.setenv(ENV_TOKEN, "token-de-teste-fake")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_http)

    transporte = httpx.MockTransport(handler)
    with httpx.Client(transport=transporte) as cliente_mock:
        with pytest.raises(SPTransError):
            sptrans.buscar_transporte_publico(
                -23.561, -46.656, client=cliente_mock
            )
