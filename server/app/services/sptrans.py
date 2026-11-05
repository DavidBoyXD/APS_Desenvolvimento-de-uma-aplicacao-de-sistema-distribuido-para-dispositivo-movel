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

# Caminhos de acompanhamento de ônibus e busca (itens B e C).
# - /Linha/Buscar?termosBusca=...   -> busca de linhas por texto;
# - /Posicao/Linha?codigoLinha=...  -> posição dos veículos de uma linha;
# - /Previsao/Linha?codigoLinha=... -> previsão de chegada por parada da linha;
# - /Parada/Buscar?termosBusca=...  -> busca de paradas por texto.
CAMINHO_LINHA_BUSCAR = "/Linha/Buscar"
CAMINHO_POSICAO_LINHA = "/Posicao/Linha"
CAMINHO_PREVISAO_LINHA = "/Previsao/Linha"
CAMINHO_PARADA_BUSCAR = "/Parada/Buscar"

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


# ---------------------------------------------------------------------------
# Dataclasses de acompanhamento de ônibus e busca (itens B e C)
# ---------------------------------------------------------------------------
# Cada dataclass é construída por uma função de mapeamento pura (payload ->
# dataclass) e carrega um indicador ``tempo_real`` e uma ``fonte`` para deixar
# EXPLÍCITO se o dado veio do Olho Vivo (tempo real) ou do fallback de exemplo.


@dataclass
class LinhaOnibus:
    """Uma linha de ônibus retornada por ``/Linha/Buscar`` do Olho Vivo."""

    codigo_linha: int  # cl - código usado nas chamadas de posição/previsão.
    letreiro: str  # lt - letreiro/número da linha (ex.: "8000").
    sentido: int  # sl - sentido (1 = terminal principal->secundário; 2 = volta).
    tipo: int  # tl - código do tipo de linha.
    terminal_principal: str  # tp - terminal principal (origem).
    terminal_secundario: str  # ts - terminal secundário (destino).
    circular: bool  # lc - indica se a linha é circular.
    tempo_real: bool = True
    fonte: str = ""


@dataclass
class VeiculoPosicao:
    """Posição de um veículo (ônibus) em ``/Posicao/Linha`` do Olho Vivo."""

    prefixo: str  # p - prefixo do veículo.
    acessivel: bool  # a - veículo acessível para pessoas com deficiência.
    timestamp: str  # ta - instante da posição (ISO 8601 UTC).
    latitude: float  # py - latitude.
    longitude: float  # px - longitude.


@dataclass
class PosicaoLinha:
    """Conjunto de posições dos veículos de uma linha (``/Posicao/Linha``)."""

    horario_referencia: str  # hr - horário de referência da consulta.
    veiculos: list  # list[VeiculoPosicao]
    tempo_real: bool = True
    fonte: str = ""


@dataclass
class PrevisaoVeiculo:
    """Previsão de chegada de um veículo a uma parada (``/Previsao/Linha``)."""

    prefixo: str  # p - prefixo do veículo.
    horario_previsto: str  # t - horário previsto de chegada (HH:MM).
    acessivel: bool  # a - veículo acessível.
    timestamp: str  # ta - instante da posição do veículo (ISO 8601 UTC).
    latitude: float  # py - latitude do veículo.
    longitude: float  # px - longitude do veículo.


@dataclass
class ParadaPrevisao:
    """Uma parada com as previsões dos veículos de uma linha."""

    codigo_parada: int  # cp - código da parada.
    nome: str  # np - nome da parada.
    latitude: float  # py - latitude da parada.
    longitude: float  # px - longitude da parada.
    veiculos: list  # list[PrevisaoVeiculo]


@dataclass
class PrevisaoLinha:
    """Previsão de chegada por parada de uma linha (``/Previsao/Linha``)."""

    horario_referencia: str  # hr - horário de referência da consulta.
    paradas: list  # list[ParadaPrevisao]
    tempo_real: bool = True
    fonte: str = ""


@dataclass
class Parada:
    """Uma parada de ônibus retornada por ``/Parada/Buscar`` do Olho Vivo."""

    codigo: int  # cp - código da parada.
    nome: str  # np - nome da parada.
    endereco: str  # ed - endereço/descrição da parada.
    latitude: float  # py - latitude.
    longitude: float  # px - longitude.
    tempo_real: bool = True
    fonte: str = ""


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


# ---------------------------------------------------------------------------
# Funções de mapeamento puras (payload -> dataclasses) dos itens B e C
# ---------------------------------------------------------------------------
# Mesma filosofia de ``mapear_payload``: validam o formato e levantam
# ``SPTransError`` para payloads inválidos, sem tocar a rede.


def _como_str(valor) -> str:
    """Normaliza um campo para str (prefixos podem vir como int na API)."""
    if valor is None:
        return ""
    return str(valor)


def mapear_linhas(payload) -> list[LinhaOnibus]:
    """Mapeia a resposta de ``/Linha/Buscar`` para uma lista de ``LinhaOnibus``.

    O endpoint devolve uma LISTA de linhas no formato (resumido):
    ``[{"cl": int, "lt": str, "sl": int, "tl": int, "tp": str, "ts": str,
    "lc": bool}, ...]``. Levanta ``SPTransError`` se não for uma lista.
    """
    if not isinstance(payload, list):
        raise SPTransError(
            "Resposta de /Linha/Buscar da SPTrans nao e uma lista valida."
        )
    linhas: list[LinhaOnibus] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        linhas.append(
            LinhaOnibus(
                codigo_linha=int(item.get("cl", 0)),
                letreiro=_como_str(item.get("lt")),
                sentido=int(item.get("sl", 0)),
                tipo=int(item.get("tl", 0)),
                terminal_principal=_como_str(item.get("tp")),
                terminal_secundario=_como_str(item.get("ts")),
                circular=bool(item.get("lc", False)),
                tempo_real=True,
                fonte=FONTE,
            )
        )
    return linhas


def _mapear_veiculo(item: dict) -> VeiculoPosicao:
    """Mapeia um item de veículo (``vs``) para ``VeiculoPosicao``."""
    return VeiculoPosicao(
        prefixo=_como_str(item.get("p")),
        acessivel=bool(item.get("a", False)),
        timestamp=_como_str(item.get("ta")),
        latitude=float(item.get("py") or 0.0),
        longitude=float(item.get("px") or 0.0),
    )


def mapear_posicao_linha(payload) -> PosicaoLinha:
    """Mapeia a resposta de ``/Posicao/Linha`` para ``PosicaoLinha``.

    Formato (resumido): ``{"hr": str, "vs": [{"p", "a", "ta", "py", "px"}, ...]}``.
    Levanta ``SPTransError`` se faltar o bloco de veículos ``vs`` (lista).
    """
    if not isinstance(payload, dict):
        raise SPTransError(
            "Resposta de /Posicao/Linha da SPTrans nao e um objeto JSON valido."
        )
    veiculos = payload.get("vs")
    if not isinstance(veiculos, list):
        raise SPTransError(
            "Resposta de /Posicao/Linha da SPTrans sem o bloco de veiculos ('vs')."
        )
    return PosicaoLinha(
        horario_referencia=_como_str(payload.get("hr")),
        veiculos=[_mapear_veiculo(v) for v in veiculos if isinstance(v, dict)],
        tempo_real=True,
        fonte=FONTE,
    )


def mapear_previsao_linha(payload) -> PrevisaoLinha:
    """Mapeia a resposta de ``/Previsao/Linha`` para ``PrevisaoLinha``.

    Formato (resumido): ``{"hr": str, "ps": [{"cp", "np", "py", "px",
    "vs": [{"p", "t", "a", "ta", "py", "px"}, ...]}, ...]}``. Levanta
    ``SPTransError`` se faltar o bloco de paradas ``ps`` (lista).
    """
    if not isinstance(payload, dict):
        raise SPTransError(
            "Resposta de /Previsao/Linha da SPTrans nao e um objeto JSON valido."
        )
    paradas_raw = payload.get("ps")
    if not isinstance(paradas_raw, list):
        raise SPTransError(
            "Resposta de /Previsao/Linha da SPTrans sem o bloco de paradas ('ps')."
        )
    paradas: list[ParadaPrevisao] = []
    for parada in paradas_raw:
        if not isinstance(parada, dict):
            continue
        veiculos_raw = parada.get("vs")
        veiculos: list[PrevisaoVeiculo] = []
        if isinstance(veiculos_raw, list):
            for v in veiculos_raw:
                if not isinstance(v, dict):
                    continue
                veiculos.append(
                    PrevisaoVeiculo(
                        prefixo=_como_str(v.get("p")),
                        horario_previsto=_como_str(v.get("t")),
                        acessivel=bool(v.get("a", False)),
                        timestamp=_como_str(v.get("ta")),
                        latitude=float(v.get("py") or 0.0),
                        longitude=float(v.get("px") or 0.0),
                    )
                )
        paradas.append(
            ParadaPrevisao(
                codigo_parada=int(parada.get("cp", 0)),
                nome=_como_str(parada.get("np")),
                latitude=float(parada.get("py") or 0.0),
                longitude=float(parada.get("px") or 0.0),
                veiculos=veiculos,
            )
        )
    return PrevisaoLinha(
        horario_referencia=_como_str(payload.get("hr")),
        paradas=paradas,
        tempo_real=True,
        fonte=FONTE,
    )


def mapear_paradas(payload) -> list[Parada]:
    """Mapeia a resposta de ``/Parada/Buscar`` para uma lista de ``Parada``.

    O endpoint devolve uma LISTA no formato (resumido):
    ``[{"cp": int, "np": str, "ed": str, "py": float, "px": float}, ...]``.
    Levanta ``SPTransError`` se não for uma lista.
    """
    if not isinstance(payload, list):
        raise SPTransError(
            "Resposta de /Parada/Buscar da SPTrans nao e uma lista valida."
        )
    paradas: list[Parada] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        paradas.append(
            Parada(
                codigo=int(item.get("cp", 0)),
                nome=_como_str(item.get("np")),
                endereco=_como_str(item.get("ed")),
                latitude=float(item.get("py") or 0.0),
                longitude=float(item.get("px") or 0.0),
                tempo_real=True,
                fonte=FONTE,
            )
        )
    return paradas


# ---------------------------------------------------------------------------
# Fallbacks de EXEMPLO (sem token) para acompanhamento e busca - NÃO tempo real
# ---------------------------------------------------------------------------
# Reaproveitam LINHAS_EXEMPLO quando faz sentido. Todos marcam tempo_real=False
# e usam FONTE_FALLBACK para deixar explícito que NÃO são dados em tempo real.


def _linhas_fallback() -> list[LinhaOnibus]:
    """Linhas de EXEMPLO (sem token) derivadas de ``LINHAS_EXEMPLO``."""
    linhas: list[LinhaOnibus] = []
    for indice, exemplo in enumerate(LINHAS_EXEMPLO, start=1):
        letreiro = exemplo["letreiro"].split("-")[0]
        nome = exemplo["nome"]
        terminais = nome.split(" - ")
        principal = terminais[0] if terminais else nome
        secundario = terminais[1] if len(terminais) > 1 else nome
        linhas.append(
            LinhaOnibus(
                # codigo_linha de EXEMPLO (indice sequencial 1..N): NAO e o `cl`
                # real do Olho Vivo. Serve apenas para o fallback sem token (que
                # nao consulta a rede); nao use estes valores como codigo real.
                codigo_linha=indice,
                letreiro=letreiro,
                sentido=1,
                tipo=10,
                terminal_principal=principal,
                terminal_secundario=secundario,
                circular=False,
                tempo_real=False,
                fonte=FONTE_FALLBACK,
            )
        )
    return linhas


def _posicao_linha_fallback() -> PosicaoLinha:
    """Posição de EXEMPLO (sem token) com 1-2 veículos NÃO em tempo real."""
    return PosicaoLinha(
        horario_referencia="00:00",
        veiculos=[
            VeiculoPosicao(
                prefixo="00000",
                acessivel=True,
                timestamp="1970-01-01T00:00:00Z",
                latitude=-23.550,
                longitude=-46.633,
            ),
            VeiculoPosicao(
                prefixo="00001",
                acessivel=False,
                timestamp="1970-01-01T00:00:00Z",
                latitude=-23.561,
                longitude=-46.656,
            ),
        ],
        tempo_real=False,
        fonte=FONTE_FALLBACK,
    )


def _previsao_linha_fallback() -> PrevisaoLinha:
    """Previsão de EXEMPLO (sem token) com 1 parada e 1 veículo NÃO tempo real."""
    return PrevisaoLinha(
        horario_referencia="00:00",
        paradas=[
            ParadaPrevisao(
                codigo_parada=1,
                nome="Parada de EXEMPLO (nao tempo real)",
                latitude=-23.550,
                longitude=-46.633,
                veiculos=[
                    PrevisaoVeiculo(
                        prefixo="00000",
                        horario_previsto="00:00",
                        acessivel=True,
                        timestamp="1970-01-01T00:00:00Z",
                        latitude=-23.550,
                        longitude=-46.633,
                    )
                ],
            )
        ],
        tempo_real=False,
        fonte=FONTE_FALLBACK,
    )


def _paradas_fallback() -> list[Parada]:
    """Paradas de EXEMPLO (sem token) NÃO em tempo real."""
    return [
        Parada(
            codigo=1,
            nome="Parada Praca da Se (EXEMPLO)",
            endereco="Praca da Se, Se - exemplo (nao tempo real)",
            latitude=-23.550,
            longitude=-46.633,
            tempo_real=False,
            fonte=FONTE_FALLBACK,
        ),
        Parada(
            codigo=2,
            nome="Parada Largo da Batata (EXEMPLO)",
            endereco="Largo da Batata, Pinheiros - exemplo (nao tempo real)",
            latitude=-23.567,
            longitude=-46.700,
            tempo_real=False,
            fonte=FONTE_FALLBACK,
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


def _consultar_olhovivo(
    caminho: str,
    params: dict,
    client: Optional[httpx.Client],
    token: str,
):
    """Autentica e faz um GET autenticado no Olho Vivo, devolvendo o JSON.

    Centraliza o fluxo comum das buscas (itens B e C): recebe o ``token`` JÁ lido
    pelo chamador (que também tratou o caso ``None`` -> fallback), abre/reutiliza
    o ``httpx.Client``, autentica (``_autenticar``), faz o GET no ``caminho`` com
    os ``params`` informados, aplica ``raise_for_status`` e devolve ``.json()``.
    Converte qualquer ``httpx.HTTPError`` em ``SPTransError`` e fecha o client
    somente se ele foi criado internamente (padrão ``proprio_client``).
    """
    proprio_client = client is None
    if proprio_client:
        client = httpx.Client(timeout=TIMEOUT_SEGUNDOS)
    try:
        _autenticar(client, token)
        url = f"{OLHOVIVO_BASE_URL}{caminho}"
        resposta = client.get(url, params=params)
        resposta.raise_for_status()
        return resposta.json()
    except httpx.HTTPError as exc:
        raise SPTransError(
            f"Falha ao consultar a SPTrans Olho Vivo: {exc}"
        ) from exc
    finally:
        if proprio_client:
            client.close()


def buscar_linhas(
    termo: str, client: Optional[httpx.Client] = None
) -> list[LinhaOnibus]:
    """Busca linhas de ônibus por texto (``GET /Linha/Buscar?termosBusca=...``).

    - Sem ``SPTRANS_TOKEN``: retorna linhas de EXEMPLO claramente rotuladas como
      NÃO tempo real (``tempo_real=False``), SEM tocar a rede.
    - Com token: autentica no Olho Vivo e mapeia a resposta real para
      ``LinhaOnibus``. Erros de rede/HTTP viram ``SPTransError``.
    """
    token = obter_token()
    if token is None:
        return _linhas_fallback()
    payload = _consultar_olhovivo(
        CAMINHO_LINHA_BUSCAR, {"termosBusca": termo}, client, token
    )
    return mapear_linhas(payload)


def buscar_posicoes_linha(
    codigo_linha: int, client: Optional[httpx.Client] = None
) -> PosicaoLinha:
    """Posições dos veículos de uma linha (``GET /Posicao/Linha?codigoLinha=...``).

    - Sem ``SPTRANS_TOKEN``: retorna posição de EXEMPLO rotulada como NÃO tempo
      real, SEM tocar a rede.
    - Com token: autentica e mapeia a resposta real para ``PosicaoLinha``.
    """
    token = obter_token()
    if token is None:
        return _posicao_linha_fallback()
    payload = _consultar_olhovivo(
        CAMINHO_POSICAO_LINHA, {"codigoLinha": codigo_linha}, client, token
    )
    return mapear_posicao_linha(payload)


def buscar_previsao_linha(
    codigo_linha: int, client: Optional[httpx.Client] = None
) -> PrevisaoLinha:
    """Previsão de chegada de uma linha (``GET /Previsao/Linha?codigoLinha=...``).

    - Sem ``SPTRANS_TOKEN``: retorna previsão de EXEMPLO rotulada como NÃO tempo
      real, SEM tocar a rede.
    - Com token: autentica e mapeia a resposta real para ``PrevisaoLinha``.
    """
    token = obter_token()
    if token is None:
        return _previsao_linha_fallback()
    payload = _consultar_olhovivo(
        CAMINHO_PREVISAO_LINHA, {"codigoLinha": codigo_linha}, client, token
    )
    return mapear_previsao_linha(payload)


def buscar_paradas(
    termo: str, client: Optional[httpx.Client] = None
) -> list[Parada]:
    """Busca paradas de ônibus por texto (``GET /Parada/Buscar?termosBusca=...``).

    - Sem ``SPTRANS_TOKEN``: retorna paradas de EXEMPLO rotuladas como NÃO tempo
      real, SEM tocar a rede.
    - Com token: autentica e mapeia a resposta real para ``Parada``.
    """
    token = obter_token()
    if token is None:
        return _paradas_fallback()
    payload = _consultar_olhovivo(
        CAMINHO_PARADA_BUSCAR, {"termosBusca": termo}, client, token
    )
    return mapear_paradas(payload)
