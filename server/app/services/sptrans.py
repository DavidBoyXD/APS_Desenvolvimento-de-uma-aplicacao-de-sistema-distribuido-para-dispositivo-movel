"""Integração com a API SPTrans Olho Vivo (fonte OFICIAL de São Paulo).

Fonte de dados (transporte público / frota de ônibus em tempo real)
-------------------------------------------------------------------
- API: SPTrans Olho Vivo (API de Monitoramento da frota de ônibus da capital).
- Órgão: SPTrans - São Paulo Transporte S/A, empresa da Prefeitura de São Paulo
  responsável pelo transporte público por ônibus na cidade. Portanto esta é a
  fonte OFICIAL de transporte público de SP.
- Portal do desenvolvedor: https://www.sptrans.com.br/desenvolvedores/
- Endpoint base da API: https://api.olhovivo.sptrans.com.br/v2.1
- Dados também disponíveis em formato GTFS estático (sem token) na mesma seção
  de desenvolvedores do portal da SPTrans.

Autenticação (TOKEN gratuito, obrigatório para o tempo real)
------------------------------------------------------------
A API Olho Vivo exige um TOKEN de acesso gratuito. O fluxo é:

1. POST ``/Login/Autenticar?token=SEU_TOKEN`` -> estabelece uma SESSÃO. A
   resposta é ``true``/``false`` e, em caso de sucesso, o servidor devolve um
   cookie de sessão (apManager). Esse cookie deve ser reutilizado nas chamadas
   seguintes; por isso usamos o MESMO ``httpx.Client`` para toda a sequência
   (o httpx.Client preserva os cookies automaticamente).
2. Chamadas de dados reutilizando a sessão, ex.: ``GET /Posicao`` (posição de
   toda a frota) e ``GET /Linha/Buscar`` (linhas monitoradas).

PASSO A PASSO para gerar o token (resumo; a doc detalhada vai em docs/README):

1. Acesse o portal do desenvolvedor da SPTrans:
   https://www.sptrans.com.br/desenvolvedores/
2. Cadastre-se / faça login e solicite a sua "chave de ativação" (token) da
   API Olho Vivo. O cadastro é gratuito.
3. Copie o token recebido.
4. Defina a variável de ambiente ``SPTRANS_TOKEN`` com esse valor ANTES de
   iniciar o servidor, por exemplo:

   ``export SPTRANS_TOKEN="seu_token_aqui"`` (Linux/macOS) ou
   ``set SPTRANS_TOKEN=seu_token_aqui`` (Windows).

O token NUNCA é escrito no código (não há token literal neste repositório): ele
é lido exclusivamente de ``os.environ.get("SPTRANS_TOKEN")``.

Comportamento com e sem token
-----------------------------
- COM ``SPTRANS_TOKEN`` definido: a integração autentica no Olho Vivo e deriva
  métricas REAIS (tempo real) da frota (ex.: número de veículos/posições e
  número de linhas monitoradas na cidade). Se a autenticação falhar (token
  inválido/recusado) ou houver erro de rede/HTTP, isso NÃO cai no fallback:
  vira ``SPTransError`` e o router responde HTTP 502 em PT-BR. A falha explícita
  é proposital, para não mascarar um token inválido como dado de exemplo.
- SEM ``SPTRANS_TOKEN`` (ausência de token): usamos um FALLBACK FUNCIONAL com um
  pequeno conjunto de linhas de SP de EXEMPLO, claramente ROTULADO como dado
  estático/GTFS de exemplo (NÃO tempo real). O campo ``fonte`` das medições de
  fallback deixa isso explícito. Assim o app funciona de ponta a ponta mesmo
  sem o token. Resumindo: SEM token = fallback de exemplo; COM token e falha de
  autenticação = erro 502 (não há fallback nesse caso).

Onde é aplicado: chamado pelo router de medições
(``POST /api/v1/regioes/{id}/atualizar-transporte``) para persistir as métricas
derivadas como Medições do tipo ``transporte_publico``.

Tratamento de erro: qualquer falha de rede/timeout/HTTP é convertida em
``SPTransError`` (nunca estoura um 500 cru); o router traduz isso em uma
resposta de erro padronizada (HTTP 502 em PT-BR). A ausência de token NÃO é
erro: cai no fallback.
"""

import os
from dataclasses import dataclass
from typing import Optional

import httpx

# Endpoint base da API Olho Vivo (versão 2.1).
OLHOVIVO_BASE_URL = "https://api.olhovivo.sptrans.com.br/v2.1"

# Caminhos usados: autenticação (estabelece a sessão) e posição da frota.
CAMINHO_AUTENTICAR = "/Login/Autenticar"
CAMINHO_POSICAO = "/Posicao"

# Nome da variável de ambiente que guarda o token (NUNCA hardcode o token).
ENV_TOKEN = "SPTRANS_TOKEN"

TIMEOUT_SEGUNDOS = 15.0

# Fonte oficial (tempo real), usada quando há token e a autenticação funciona.
FONTE = (
    "SPTrans Olho Vivo - fonte OFICIAL da Prefeitura de Sao Paulo (tempo real "
    "da frota de onibus): https://www.sptrans.com.br/desenvolvedores/"
)

# Fonte do FALLBACK: deixa EXPLÍCITO que é dado de exemplo/GTFS estático, NÃO
# tempo real. Essencial para não induzir o usuário a erro.
FONTE_FALLBACK = (
    "SPTrans (dado de EXEMPLO / GTFS estatico - NAO e tempo real; sem token "
    "SPTRANS_TOKEN configurado): https://www.sptrans.com.br/desenvolvedores/"
)

# Conjunto de EXEMPLO (fallback) com algumas linhas reais de ônibus de SP.
# Serve apenas para o app funcionar ponta a ponta sem token. NÃO representa
# posições/estado em tempo real. As métricas derivadas abaixo (número de linhas
# de exemplo) são claramente rotuladas como fallback.
LINHAS_EXEMPLO: list[dict] = [
    {"letreiro": "8000-10", "nome": "Term. Lapa - Term. Pinheiros"},
    {"letreiro": "875A-10", "nome": "Metro Santa Cruz - Butanta"},
    {"letreiro": "7411-10", "nome": "Term. Pirituba - Lapa"},
    {"letreiro": "N840-11", "nome": "Term. Bandeira - Jd. Herculano (noturno)"},
    {"letreiro": "917H-10", "nome": "Term. Casa Verde - Lapa"},
]


class SPTransError(Exception):
    """Erro tratado da integração SPTrans Olho Vivo (rede, timeout ou payload)."""


@dataclass
class LeituraTransporte:
    """Uma métrica derivada de transporte público, pronta para virar Medição."""

    parametro: str
    valor: float
    unidade: str
    detalhe: Optional[str] = None


def obter_token() -> Optional[str]:
    """Lê o token da variável de ambiente ``SPTRANS_TOKEN`` (nunca hardcoded).

    Retorna ``None`` quando a variável não está definida (ou está vazia), o que
    sinaliza ao chamador para usar o fallback.
    """
    token = os.environ.get(ENV_TOKEN)
    if token is None:
        return None
    token = token.strip()
    return token or None


def mapear_payload(payload: dict) -> list[LeituraTransporte]:
    """Deriva métricas reais do payload do endpoint ``/Posicao`` do Olho Vivo.

    O payload do ``/Posicao`` tem o formato (resumido):

    ``{"hr": "HH:MM", "l": [ {"c": "letreiro", "cl": codigo, "vs": [ {..veiculo..}, ... ]}, ... ]}``

    onde ``l`` é a lista de linhas monitoradas e, em cada linha, ``vs`` é a
    lista de veículos (posições). Derivamos:

    - ``linhas_monitoradas``: número de linhas no bloco ``l``;
    - ``veiculos_em_operacao``: soma dos veículos (``vs``) de todas as linhas.

    Levanta ``SPTransError`` se o payload não tiver o bloco ``l`` (lista) ou se
    nenhuma linha válida for encontrada (mesma filosofia dos demais serviços).
    """
    if not isinstance(payload, dict):
        raise SPTransError("Resposta da SPTrans nao e um objeto JSON valido.")

    linhas = payload.get("l")
    if not isinstance(linhas, list):
        raise SPTransError("Resposta da SPTrans sem o bloco de linhas ('l').")

    total_linhas = 0
    total_veiculos = 0
    for linha in linhas:
        if not isinstance(linha, dict):
            continue
        total_linhas += 1
        veiculos = linha.get("vs")
        if isinstance(veiculos, list):
            total_veiculos += len(veiculos)

    if total_linhas == 0:
        raise SPTransError(
            "Nenhuma linha de onibus valida encontrada na resposta da SPTrans."
        )

    hora = payload.get("hr")
    detalhe_hora = f" (referencia {hora})" if isinstance(hora, str) and hora else ""

    return [
        LeituraTransporte(
            parametro="linhas_monitoradas",
            valor=float(total_linhas),
            unidade="linhas",
            detalhe=f"Linhas de onibus monitoradas pelo Olho Vivo{detalhe_hora}.",
        ),
        LeituraTransporte(
            parametro="veiculos_em_operacao",
            valor=float(total_veiculos),
            unidade="veiculos",
            detalhe=(
                f"Veiculos (onibus) com posicao reportada em tempo real"
                f"{detalhe_hora}."
            ),
        ),
    ]


def _leituras_fallback() -> list[LeituraTransporte]:
    """Métricas do FALLBACK (sem token): conjunto de linhas de EXEMPLO.

    NÃO toca a rede e NÃO representa tempo real. O rótulo de exemplo/fallback
    aparece tanto no ``detalhe`` quanto na ``FONTE_FALLBACK`` usada no router.
    """
    total = len(LINHAS_EXEMPLO)
    return [
        LeituraTransporte(
            parametro="linhas_exemplo",
            valor=float(total),
            unidade="linhas",
            detalhe=(
                "Dado de EXEMPLO (fallback sem token SPTRANS_TOKEN): conjunto "
                "estatico de linhas de SP, NAO e tempo real."
            ),
        )
    ]


def _autenticar(client: httpx.Client, token: str) -> None:
    """Autentica na API Olho Vivo estabelecendo a sessão (cookie).

    POST ``/Login/Autenticar?token=TOKEN``. O cookie de sessão retornado fica
    guardado no próprio ``client`` (httpx preserva cookies), sendo reutilizado
    nas chamadas seguintes. Converte erros HTTP em ``SPTransError``.
    """
    url = f"{OLHOVIVO_BASE_URL}{CAMINHO_AUTENTICAR}"
    resposta = client.post(url, params={"token": token})
    resposta.raise_for_status()
    try:
        autenticado = resposta.json()
    except ValueError as exc:
        raise SPTransError(
            "Resposta de autenticacao da SPTrans em formato inesperado."
        ) from exc
    if autenticado is not True:
        raise SPTransError(
            "Falha ao autenticar na SPTrans Olho Vivo (token invalido ou "
            "sessao nao estabelecida)."
        )


def buscar_transporte_publico(
    latitude: float,
    longitude: float,
    client: Optional[httpx.Client] = None,
) -> list[LeituraTransporte]:
    """Retorna métricas de transporte público de SP (tempo real ou fallback).

    - Sem ``SPTRANS_TOKEN`` definido: retorna o FALLBACK de exemplo (claramente
      rotulado) SEM tocar a rede. Assim o app funciona ponta a ponta sem token.
    - Com token: autentica no Olho Vivo (POST /Login/Autenticar), reutiliza a
      MESMA sessão (cookie) para ``GET /Posicao`` e deriva as métricas reais.

    Recebe opcionalmente um ``httpx.Client`` (facilita testes). Converte
    qualquer ``httpx.HTTPError`` em ``SPTransError`` para o router tratar.

    SEMÂNTICA (métrica por CIDADE, não por região): os parâmetros
    ``latitude``/``longitude`` são aceitos APENAS para manter o mesmo contrato
    dos demais serviços (atualizar-* por região), mas NÃO são usados aqui: o
    endpoint ``/Posicao`` retorna a frota da cidade de São Paulo como um todo e
    não aceita filtro geográfico. Logo ``linhas_monitoradas`` e
    ``veiculos_em_operacao`` são métricas da CIDADE inteira (frota do Olho Vivo),
    não geofiltradas por região. Em consequência, chamar atualizar-transporte
    para regiões diferentes no mesmo instante grava os MESMOS valores em todas
    elas. Isso é intencional e está documentado para quem consome por região.
    """
    token = obter_token()
    if token is None:
        # Sem token: fallback funcional, sem rede.
        return _leituras_fallback()

    proprio_client = client is None
    if proprio_client:
        client = httpx.Client(timeout=TIMEOUT_SEGUNDOS)
    try:
        _autenticar(client, token)
        url_posicao = f"{OLHOVIVO_BASE_URL}{CAMINHO_POSICAO}"
        resposta = client.get(url_posicao)
        resposta.raise_for_status()
        payload = resposta.json()
    except httpx.HTTPError as exc:
        raise SPTransError(
            f"Falha ao consultar a SPTrans Olho Vivo: {exc}"
        ) from exc
    finally:
        if proprio_client:
            client.close()

    return mapear_payload(payload)
