"""Integracao com a Open-Meteo Flood API / GloFAS (fonte operacional de dados).

Recorte: alagamento / inundacao em Sao Paulo (SP)
-------------------------------------------------
Esta versao do sistema e focada no territorio de Sao Paulo (SP). Para
alagamento combinamos duas camadas:

1. Fonte OPERACIONAL (dado consumido em runtime):
   - API: Open-Meteo Flood API
   - Endpoint: https://flood-api.open-meteo.com/v1/flood
   - Documentacao: https://open-meteo.com/en/docs/flood-api
   - Base cientifica: GloFAS (Global Flood Awareness System), sistema global de
     alerta de inundacoes do programa Copernicus.
   - Licenca/uso: gratuita, sem necessidade de chave de API (API key). Retorna
     a descarga fluvial diaria (river discharge, em m3/s) simulada/prevista por
     latitude/longitude a partir dos modelos hidrologicos do GloFAS. Validada
     para SP (daily_units de river_discharge em m3/s).
   - A descarga fluvial e um indicador reconhecido de risco de cheia: quanto
     maior a vazao do rio, maior o potencial de transbordamento e alagamento. A
     partir dessa serie diaria derivamos metricas REAIS (descarga atual, media e
     maxima do periodo). Escolhida por ser publica, gratuita, sem chave e
     comprovavel (mesma familia da Air Quality API ja usada).

2. Autoridade OFICIAL de referencia em SP (citada, nao consumida):
   - CGE-SP - Centro de Gerenciamento de Emergencias Climaticas da Prefeitura
     de Sao Paulo: https://www.cgesp.org/
   - O CGE-SP e o orgao OFICIAL que monitora e divulga pontos de alagamento na
     cidade de Sao Paulo. Nao expomos um endpoint JSON estavel e sem chave do
     CGE-SP, por isso o citamos como REFERENCIA oficial e mantemos a Open-Meteo
     Flood/GloFAS como fonte operacional dos valores persistidos.

Onde e aplicado: chamado pelo router de medicoes
(``POST /api/v1/regioes/{id}/atualizar-alagamento``) para buscar a descarga
fluvial de uma regiao de SP (usando o lat/lon ja armazenados no modelo
``Regiao``) e persistir as metricas derivadas como Medicoes do tipo
``alagamento``, com a ``fonte`` citando a Open-Meteo Flood/GloFAS (operacional)
e o CGE-SP (referencia oficial de SP).

Tratamento de erro: qualquer falha de rede/timeout/HTTP e convertida em
``FloodError`` (nunca estoura um 500 cru); o router traduz isso em uma
resposta de erro padronizada (HTTP 502 em PT-BR).
"""

from dataclasses import dataclass
from typing import Optional

import httpx

# URL do endpoint da Open-Meteo Flood API (ver docstring/fonte acima).
FLOOD_API_URL = "https://flood-api.open-meteo.com/v1/flood"

# Parametros diarios solicitados. A ordem/nomes seguem a doc da Flood API.
DAILY_PARAMS = "river_discharge,river_discharge_mean,river_discharge_max"

# Numero de dias de previsao/serie solicitados a API.
FORECAST_DAYS = 7

# Timeout (segundos) do cliente httpx.
TIMEOUT_SEGUNDOS = 10.0

# Unidade padrao (fallback). A unidade real e lida do bloco 'daily_units' do
# payload (ver mapear_payload); esta constante so e usada quando o payload nao
# traz a unidade do parametro.
UNIDADE_PADRAO = "m3/s"

# FONTE registra a origem OPERACIONAL (Open-Meteo Flood / GloFAS) e a autoridade
# OFICIAL de referencia de alagamentos em SP (CGE-SP). O CGE-SP nao expoe
# endpoint JSON estavel e sem chave, por isso e citado como referencia e nao
# consumido. Mantem as palavras 'Flood' e 'GloFAS' usadas pelos testes.
FONTE = (
    "Open-Meteo Flood API / GloFAS (dado operacional, "
    "https://open-meteo.com/en/docs/flood-api); referencia oficial de SP: "
    "CGE-SP (https://www.cgesp.org/)"
)


class FloodError(Exception):
    """Erro tratado da integracao Flood API (rede, timeout ou payload)."""


@dataclass
class LeituraAlagamento:
    """Uma metrica derivada de descarga fluvial, pronta para virar Medicao."""

    parametro: str
    valor: float
    unidade: str
    timestamp: Optional[str] = None  # ISO 8601 de daily.time (ex.: '2026-09-30')
    detalhe: Optional[str] = None


def mapear_payload(payload: dict) -> list[LeituraAlagamento]:
    """Mapeia o JSON da Flood API para as metricas de descarga fluvial.

    A Flood API retorna, em ``daily``, uma lista ``time`` e listas de valores
    por parametro (``river_discharge`` e, opcionalmente, ``river_discharge_mean``
    e ``river_discharge_max``). Derivamos:

    - ``river_discharge``: valor NAO-NULO mais recente da serie (descarga atual),
      com o timestamp correspondente de ``daily.time``;
    - ``river_discharge_media``: media das medias diarias do periodo, a partir
      da serie ``river_discharge_mean`` (que ja e a media diaria calculada pelo
      GloFAS) quando presente, senao a media aritmetica dos valores nao-nulos de
      ``river_discharge``;
    - ``river_discharge_maxima``: maxima do periodo, a partir de
      ``river_discharge_max`` quando presente, senao o maximo dos valores.

    Os dois agregados (``river_discharge_media`` e ``river_discharge_maxima``)
    resumem TODO o periodo consultado; por isso o ``timestamp`` deles fica
    ``None`` (o campo e ``Optional``), evitando carimba-los com um dia especifico
    como se fossem a leitura daquela data. Apenas ``river_discharge`` (a descarga
    atual) carrega o timestamp do dia correspondente.

    A unidade e lida do bloco ``daily_units`` (com fallback ``UNIDADE_PADRAO``),
    NUNCA hardcodada (issue de review anterior da Open-Meteo).

    Levanta ``FloodError`` se o payload sinalizar erro (``error: true``), nao
    tiver a estrutura esperada ou se nenhuma leitura valida for encontrada.
    """
    # A API sinaliza erro de parametro com {"error": true, "reason": "..."}.
    if payload.get("error"):
        raise FloodError(
            f"Erro retornado pela Open-Meteo Flood API: {payload.get('reason')}"
        )

    daily = payload.get("daily")
    if not isinstance(daily, dict):
        raise FloodError("Resposta da Flood API sem o bloco 'daily'.")

    tempos = daily.get("time") or []
    if not tempos:
        raise FloodError("Resposta da Flood API sem series temporais.")

    daily_units = payload.get("daily_units")
    if not isinstance(daily_units, dict):
        daily_units = {}

    leituras: list[LeituraAlagamento] = []

    descarga = daily.get("river_discharge") or []
    unidade_descarga = daily_units.get("river_discharge") or UNIDADE_PADRAO

    # Valor nao-nulo mais recente (percorre de tras para frente).
    valores_validos: list[float] = []
    descarga_atual: Optional[float] = None
    timestamp_atual: Optional[str] = None
    for indice in range(len(descarga) - 1, -1, -1):
        valor = descarga[indice]
        if valor is None:
            continue
        if descarga_atual is None:
            descarga_atual = float(valor)
            timestamp_atual = (
                tempos[indice] if indice < len(tempos) else tempos[-1]
            )
        valores_validos.append(float(valor))

    if descarga_atual is not None:
        leituras.append(
            LeituraAlagamento(
                parametro="river_discharge",
                valor=descarga_atual,
                unidade=unidade_descarga,
                timestamp=timestamp_atual,
                detalhe="Descarga fluvial mais recente (nao-nula) da serie GloFAS.",
            )
        )

    # Media do periodo: preferir river_discharge_mean; senao media dos validos.
    media_serie = daily.get("river_discharge_mean") or []
    media_validos = [float(v) for v in media_serie if v is not None]
    if media_validos:
        media_valor = sum(media_validos) / len(media_validos)
    elif valores_validos:
        media_valor = sum(valores_validos) / len(valores_validos)
    else:
        media_valor = None
    if media_valor is not None:
        unidade_media = (
            daily_units.get("river_discharge_mean")
            or unidade_descarga
        )
        leituras.append(
            LeituraAlagamento(
                parametro="river_discharge_media",
                valor=round(media_valor, 2),
                unidade=unidade_media,
                timestamp=None,  # agregado do periodo: sem dia especifico
                detalhe=(
                    "Media das medias diarias de descarga fluvial no periodo "
                    "consultado (serie river_discharge_mean do GloFAS)."
                ),
            )
        )

    # Maxima do periodo: preferir river_discharge_max; senao max dos validos.
    max_serie = daily.get("river_discharge_max") or []
    max_validos = [float(v) for v in max_serie if v is not None]
    if max_validos:
        max_valor = max(max_validos)
    elif valores_validos:
        max_valor = max(valores_validos)
    else:
        max_valor = None
    if max_valor is not None:
        unidade_max = daily_units.get("river_discharge_max") or unidade_descarga
        leituras.append(
            LeituraAlagamento(
                parametro="river_discharge_maxima",
                valor=round(max_valor, 2),
                unidade=unidade_max,
                timestamp=None,  # agregado do periodo: sem dia especifico
                detalhe="Maxima da descarga fluvial no periodo consultado.",
            )
        )

    if not leituras:
        raise FloodError("Nenhum valor de descarga fluvial valido na resposta.")
    return leituras


def buscar_alagamento(
    latitude: float, longitude: float, client: Optional[httpx.Client] = None
) -> list[LeituraAlagamento]:
    """Consulta a Open-Meteo Flood API e retorna as metricas de alagamento.

    Recebe opcionalmente um ``httpx.Client`` (facilita testes). Converte
    qualquer erro de rede/HTTP em ``FloodError`` para o router tratar.
    """
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "daily": DAILY_PARAMS,
        "forecast_days": FORECAST_DAYS,
    }
    proprio_client = client is None
    if proprio_client:
        client = httpx.Client(timeout=TIMEOUT_SEGUNDOS)
    try:
        resposta = client.get(FLOOD_API_URL, params=params)
        resposta.raise_for_status()
        payload = resposta.json()
    except httpx.HTTPError as exc:
        raise FloodError(
            f"Falha ao consultar a Open-Meteo Flood API: {exc}"
        ) from exc
    finally:
        if proprio_client:
            client.close()

    return mapear_payload(payload)
