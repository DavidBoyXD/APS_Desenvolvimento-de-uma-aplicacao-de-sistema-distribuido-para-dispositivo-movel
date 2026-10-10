"""Integracao com a API SPTrans Olho Vivo (fonte OFICIAL de Sao Paulo).

Fonte de dados (transporte publico / frota de onibus em tempo real)
-------------------------------------------------------------------
- API: SPTrans Olho Vivo (API de Monitoramento da frota de onibus da capital).
- Orgao: SPTrans - Sao Paulo Transporte S/A, empresa da Prefeitura de Sao Paulo
  responsavel pelo transporte publico por onibus na cidade. Portanto esta e a
  fonte OFICIAL de transporte publico de SP.
- Portal do desenvolvedor: https://www.sptrans.com.br/desenvolvedores/
- Endpoint base da API: https://api.olhovivo.sptrans.com.br/v2.1
- Dados tambem disponiveis em formato GTFS estatico (sem token) na mesma secao
  de desenvolvedores do portal da SPTrans.

Autenticacao (TOKEN gratuito, obrigatorio para o tempo real)
------------------------------------------------------------
A API Olho Vivo exige um TOKEN de acesso gratuito. O fluxo e:

1. POST ``/Login/Autenticar?token=SEU_TOKEN`` -> estabelece uma SESSAO. A
   resposta e ``true``/``false`` e, em caso de sucesso, o servidor devolve um
   cookie de sessao (apManager). Esse cookie deve ser reutilizado nas chamadas
   seguintes; por isso usamos o MESMO ``httpx.Client`` para toda a sequencia
   (o httpx.Client preserva os cookies automaticamente).
2. Chamadas de dados reutilizando a sessao, ex.: ``GET /Posicao`` (posicao de
   toda a frota) e ``GET /Linha/Buscar`` (linhas monitoradas).

PASSO A PASSO para gerar o token (resumo; a doc detalhada vai em docs/README):

1. Acesse o portal do desenvolvedor da SPTrans:
   https://www.sptrans.com.br/desenvolvedores/
2. Cadastre-se / faca login e solicite a sua "chave de ativacao" (token) da
   API Olho Vivo. O cadastro e gratuito.
3. Copie o token recebido.
4. Defina a variavel de ambiente ``SPTRANS_TOKEN`` com esse valor ANTES de
   iniciar o servidor, por exemplo:

   ``export SPTRANS_TOKEN="seu_token_aqui"`` (Linux/macOS) ou
   ``set SPTRANS_TOKEN=seu_token_aqui`` (Windows).

O token NUNCA e escrito no codigo (nao ha token literal neste repositorio): ele
e lido exclusivamente de ``os.environ.get("SPTRANS_TOKEN")``.

Comportamento com e sem token
-----------------------------
- COM ``SPTRANS_TOKEN`` definido: a integracao autentica no Olho Vivo e deriva
  metricas REAIS (tempo real) da frota (ex.: numero de veiculos/posicoes e
  numero de linhas monitoradas na cidade). Se a autenticacao falhar (token
  invalido/recusado) ou houver erro de rede/HTTP, isso NAO cai no fallback:
  vira ``SPTransError`` e o router responde HTTP 502 em PT-BR. A falha explicita
  e proposital, para nao mascarar um token invalido como dado de exemplo.
- SEM ``SPTRANS_TOKEN`` (ausencia de token): usamos um FALLBACK FUNCIONAL com um
  pequeno conjunto de linhas de SP de EXEMPLO, claramente ROTULADO como dado
  estatico/GTFS de exemplo (NAO tempo real). O campo ``fonte`` das medicoes de
  fallback deixa isso explicito. Assim o app funciona de ponta a ponta mesmo
  sem o token. Resumindo: SEM token = fallback de exemplo; COM token e falha de
  autenticacao = erro 502 (nao ha fallback nesse caso).

Onde e aplicado: chamado pelo router de medicoes
(``POST /api/v1/regioes/{id}/atualizar-transporte``) para persistir as metricas
derivadas como Medicoes do tipo ``transporte_publico``.

Tratamento de erro: qualquer falha de rede/timeout/HTTP e convertida em
``SPTransError`` (nunca estoura um 500 cru); o router traduz isso em uma
resposta de erro padronizada (HTTP 502 em PT-BR). A ausencia de token NAO e
erro: cai no fallback.
"""

import os
from dataclasses import dataclass
from typing import Optional

import httpx

# Endpoint base da API Olho Vivo (versao 2.1).
OLHOVIVO_BASE_URL = "https://api.olhovivo.sptrans.com.br/v2.1"

# Caminhos usados: autenticacao (estabelece a sessao) e posicao da frota.
CAMINHO_AUTENTICAR = "/Login/Autenticar"
CAMINHO_POSICAO = "/Posicao"

# Nome da variavel de ambiente que guarda o token (NUNCA hardcode o token).
ENV_TOKEN = "SPTRANS_TOKEN"

TIMEOUT_SEGUNDOS = 15.0

# Fonte oficial (tempo real), usada quando ha token e a autenticacao funciona.
FONTE = (
    "SPTrans Olho Vivo - fonte OFICIAL da Prefeitura de Sao Paulo (tempo real "
    "da frota de onibus): https://www.sptrans.com.br/desenvolvedores/"
)

# Fonte do FALLBACK: deixa EXPLICITO que e dado de exemplo/GTFS estatico, NAO
# tempo real. Essencial para nao induzir o usuario a erro.
FONTE_FALLBACK = (
    "SPTrans (dado de EXEMPLO / GTFS estatico - NAO e tempo real; sem token "
    "SPTRANS_TOKEN configurado): https://www.sptrans.com.br/desenvolvedores/"
)

# Conjunto de EXEMPLO (fallback) com algumas linhas reais de onibus de SP.
# Serve apenas para o app funcionar ponta a ponta sem token. NAO representa
# posicoes/estado em tempo real. As metricas derivadas abaixo (numero de linhas
# de exemplo) sao claramente rotuladas como fallback.
LINHAS_EXEMPLO: list[dict] = [
    {"letreiro": "8000-10", "nome": "Term. Lapa - Term. Pinheiros"},
    {"letreiro": "875A-10", "nome": "Metro Santa Cruz - Butanta"},
    {"letreiro": "7411-10", "nome": "Term. Pirituba - Lapa"},
    {"letreiro": "N840-11", "nome": "Term. Bandeira - Jd. Herculano (noturno)"},
    {"letreiro": "917H-10", "nome": "Term. Casa Verde - Lapa"},
]


class SPTransError(Exception):
    """Erro tratado da integracao SPTrans Olho Vivo (rede, timeout ou payload)."""


@dataclass
class LeituraTransporte:
    """Uma metrica derivada de transporte publico, pronta para virar Medicao."""

    parametro: str
    valor: float
    unidade: str
    detalhe: Optional[str] = None


def obter_token() -> Optional[str]:
    """Le o token da variavel de ambiente ``SPTRANS_TOKEN`` (nunca hardcoded).

    Retorna ``None`` quando a variavel nao esta definida (ou esta vazia), o que
    sinaliza ao chamador para usar o fallback.
    """
    token = os.environ.get(ENV_TOKEN)
    if token is None:
        return None
    token = token.strip()
    return token or None


def mapear_payload(payload: dict) -> list[LeituraTransporte]:
    """Deriva metricas reais do payload do endpoint ``/Posicao`` do Olho Vivo.

    O payload do ``/Posicao`` tem o formato (resumido):

    ``{"hr": "HH:MM", "l": [ {"c": "letreiro", "cl": codigo, "vs": [ {..veiculo..}, ... ]}, ... ]}``

    onde ``l`` e a lista de linhas monitoradas e, em cada linha, ``vs`` e a
    lista de veiculos (posicoes). Derivamos:

    - ``linhas_monitoradas``: numero de linhas no bloco ``l``;
    - ``veiculos_em_operacao``: soma dos veiculos (``vs``) de todas as linhas.

    Levanta ``SPTransError`` se o payload nao tiver o bloco ``l`` (lista) ou se
    nenhuma linha valida for encontrada (mesma filosofia dos demais servicos).
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
    """Metricas do FALLBACK (sem token): conjunto de linhas de EXEMPLO.

    NAO toca a rede e NAO representa tempo real. O rotulo de exemplo/fallback
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
    """Autentica na API Olho Vivo estabelecendo a sessao (cookie).

    POST ``/Login/Autenticar?token=TOKEN``. O cookie de sessao retornado fica
    guardado no proprio ``client`` (httpx preserva cookies), sendo reutilizado
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
    """Retorna metricas de transporte publico de SP (tempo real ou fallback).

    - Sem ``SPTRANS_TOKEN`` definido: retorna o FALLBACK de exemplo (claramente
      rotulado) SEM tocar a rede. Assim o app funciona ponta a ponta sem token.
    - Com token: autentica no Olho Vivo (POST /Login/Autenticar), reutiliza a
      MESMA sessao (cookie) para ``GET /Posicao`` e deriva as metricas reais.

    Recebe opcionalmente um ``httpx.Client`` (facilita testes). Converte
    qualquer ``httpx.HTTPError`` em ``SPTransError`` para o router tratar.

    SEMANTICA (metrica por CIDADE, nao por regiao): os parametros
    ``latitude``/``longitude`` sao aceitos APENAS para manter o mesmo contrato
    dos demais servicos (atualizar-* por regiao), mas NAO sao usados aqui: o
    endpoint ``/Posicao`` retorna a frota da cidade de Sao Paulo como um todo e
    nao aceita filtro geografico. Logo ``linhas_monitoradas`` e
    ``veiculos_em_operacao`` sao metricas da CIDADE inteira (frota do Olho Vivo),
    nao geofiltradas por regiao. Em consequencia, chamar atualizar-transporte
    para regioes diferentes no mesmo instante grava os MESMOS valores em todas
    elas. Isso e intencional e esta documentado para quem consome por regiao.
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
