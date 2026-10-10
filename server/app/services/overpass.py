"""Integracao com a Overpass API do OpenStreetMap (fonte real de dados).

Fonte de dados (transito / infraestrutura viaria)
--------------------------------------------------
- API: Overpass API do OpenStreetMap
- Endpoint: https://overpass-api.de/api/interpreter
- Documentacao: https://wiki.openstreetmap.org/wiki/Overpass_API
- Licenca/uso: gratuita, sem necessidade de chave de API (API key). Os dados
  do OpenStreetMap sao publicados sob a licenca ODbL (Open Database License):
  https://www.openstreetmap.org/copyright

Escolhemos a Overpass API por ser publica, gratuita, sem chave e comprovavel.
Ela permite consultar as vias (ways) reais ao redor de uma coordenada e ler
tags de infraestrutura (name, highway, lanes, maxspeed, oneway). A partir
dessas vias derivamos metricas REAIS de infraestrutura viaria (numero de vias
principais, media de faixas e media de velocidade maxima), que substituem os
dados de transito simulados usados ate entao.

Onde e aplicado: chamado pelo router de medicoes
(``POST /api/v1/regioes/{id}/atualizar-transito``) para buscar as vias reais ao
redor de uma regiao (usando o lat/lon ja armazenados no modelo ``Regiao``) e
persistir as metricas derivadas como Medicoes do tipo ``transito``.

Tratamento de erro: qualquer falha de rede/timeout/HTTP e convertida em
``OverpassError`` (nunca estoura um 500 cru); o router traduz isso em uma
resposta de erro padronizada (HTTP 502 em PT-BR).

IMPORTANTE: a chamada HTTP a Overpass DEVE enviar o header ``User-Agent``.
Sem ele a Overpass responde HTTP 406 (Not Acceptable). Por isso definimos e
enviamos ``USER_AGENT`` em toda requisicao.
"""

from dataclasses import dataclass
from typing import Optional

import httpx

# URL do endpoint de interpretacao (execucao de queries) da Overpass API.
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Identificacao da aplicacao. OBRIGATORIO: sem User-Agent a Overpass retorna
# HTTP 406 (Not Acceptable). Ver docstring do modulo.
USER_AGENT = "APS-UNIP-SD/1.0"

# Raio (em metros) ao redor da coordenada da regiao para buscar vias.
RAIO_METROS = 1500

# Limite de vias (ways) retornadas pela query (out tags N;).
LIMITE_VIAS = 200

# Tipos de via principais consideradas (filtro highway~"...").
TIPOS_VIA_PRINCIPAL = "primary|secondary|trunk|motorway"

# Timeout (segundos) do cliente httpx. Deve ser >= ao timeout embutido na
# query Overpass QL ([out:json][timeout:25]) para dar folga a resposta.
TIMEOUT_SEGUNDOS = 30.0

FONTE = (
    "OpenStreetMap via Overpass API (dados sob licenca ODbL - "
    "https://www.openstreetmap.org/copyright)"
)


class OverpassError(Exception):
    """Erro tratado da integracao Overpass (rede, timeout ou payload)."""


@dataclass
class LeituraTransito:
    """Uma metrica derivada de infraestrutura viaria, pronta para virar Medicao."""

    parametro: str
    valor: float
    unidade: str
    detalhe: Optional[str] = None


def _montar_query(latitude: float, longitude: float) -> str:
    """Monta a query Overpass QL validada em runtime para uma coordenada.

    Retorna vias principais (com nome) ao redor da coordenada, com suas tags.
    """
    return (
        "[out:json][timeout:25];"
        f'way(around:{RAIO_METROS},{latitude},{longitude})'
        f'[highway~"{TIPOS_VIA_PRINCIPAL}"][name];'
        f"out tags {LIMITE_VIAS};"
    )


def _parse_lanes(valor: object) -> Optional[float]:
    """Converte a tag ``lanes`` (ex.: '2', '3') em float; ignora invalidos.

    A tag pode vir com listas separadas por ';' (ex.: '2;3'); nesse caso
    consideramos o maior valor numerico valido encontrado.
    """
    if valor is None:
        return None
    candidatos = str(valor).replace("|", ";").split(";")
    numeros = []
    for parte in candidatos:
        parte = parte.strip()
        try:
            numeros.append(float(parte))
        except ValueError:
            continue
    if not numeros:
        return None
    return max(numeros)


def _parse_maxspeed(valor: object) -> Optional[float]:
    """Converte a tag ``maxspeed`` para km/h (float); ignora invalidos.

    A tag costuma vir como '50' (km/h implicito) ou '30 mph'. Convertemos mph
    para km/h quando indicado; valores nao numericos (ex.: 'signals') sao
    ignorados.
    """
    if valor is None:
        return None
    texto = str(valor).strip().lower()
    if not texto:
        return None
    partes = texto.split()
    try:
        numero = float(partes[0])
    except ValueError:
        return None
    if len(partes) > 1 and partes[1] == "mph":
        numero *= 1.609344
    return numero


def mapear_payload(payload: dict) -> list[LeituraTransito]:
    """Deriva metricas reais de infraestrutura viaria do payload da Overpass.

    Itera os ``elements`` do tipo ``way``, lendo suas ``tags``, e deriva:

    - ``vias_principais``: contagem de vias com nome (infraestrutura mapeada);
    - ``faixas_media``: media da tag ``lanes`` (numero de faixas) das vias que
      a informam;
    - ``velocidade_maxima_media``: media da tag ``maxspeed`` (em km/h) das vias
      que a informam.

    Levanta ``OverpassError`` se o payload nao tiver ``elements`` ou se nenhuma
    via valida (com nome) for encontrada (mesma filosofia do mapear_payload da
    Open-Meteo).
    """
    elements = payload.get("elements")
    if not isinstance(elements, list):
        raise OverpassError("Resposta da Overpass sem o bloco 'elements'.")

    total_vias = 0
    lanes_valores: list[float] = []
    maxspeed_valores: list[float] = []

    for elemento in elements:
        if not isinstance(elemento, dict) or elemento.get("type") != "way":
            continue
        tags = elemento.get("tags")
        if not isinstance(tags, dict) or not tags.get("name"):
            continue
        total_vias += 1

        faixas = _parse_lanes(tags.get("lanes"))
        if faixas is not None:
            lanes_valores.append(faixas)

        velocidade = _parse_maxspeed(tags.get("maxspeed"))
        if velocidade is not None:
            maxspeed_valores.append(velocidade)

    if total_vias == 0:
        raise OverpassError(
            "Nenhuma via principal valida encontrada na resposta da Overpass."
        )

    leituras: list[LeituraTransito] = [
        LeituraTransito(
            parametro="vias_principais",
            valor=float(total_vias),
            unidade="vias",
            detalhe=(
                f"Vias principais nomeadas em um raio de {RAIO_METROS} m "
                f"(tipos: {TIPOS_VIA_PRINCIPAL})."
            ),
        )
    ]

    if lanes_valores:
        media_faixas = sum(lanes_valores) / len(lanes_valores)
        leituras.append(
            LeituraTransito(
                parametro="faixas_media",
                valor=round(media_faixas, 2),
                unidade="faixas",
                detalhe=f"Media de faixas (lanes) em {len(lanes_valores)} vias.",
            )
        )

    if maxspeed_valores:
        media_velocidade = sum(maxspeed_valores) / len(maxspeed_valores)
        leituras.append(
            LeituraTransito(
                parametro="velocidade_maxima_media",
                valor=round(media_velocidade, 2),
                unidade="km/h",
                detalhe=(
                    f"Media da velocidade maxima (maxspeed) em "
                    f"{len(maxspeed_valores)} vias."
                ),
            )
        )

    return leituras


def buscar_transito(
    latitude: float, longitude: float, client: Optional[httpx.Client] = None
) -> list[LeituraTransito]:
    """Consulta a Overpass API e retorna as metricas de transito derivadas.

    Recebe opcionalmente um ``httpx.Client`` (facilita testes). Envia a query
    Overpass QL no corpo via ``data={'data': query}`` e o header ``User-Agent``
    obrigatorio. Converte qualquer erro de rede/HTTP em ``OverpassError`` para
    o router tratar.
    """
    query = _montar_query(latitude, longitude)
    headers = {"User-Agent": USER_AGENT}
    proprio_client = client is None
    if proprio_client:
        client = httpx.Client(timeout=TIMEOUT_SEGUNDOS)
    try:
        resposta = client.post(OVERPASS_URL, data={"data": query}, headers=headers)
        resposta.raise_for_status()
        payload = resposta.json()
    except httpx.HTTPError as exc:
        raise OverpassError(
            f"Falha ao consultar a Overpass API: {exc}"
        ) from exc
    finally:
        if proprio_client:
            client.close()

    return mapear_payload(payload)
