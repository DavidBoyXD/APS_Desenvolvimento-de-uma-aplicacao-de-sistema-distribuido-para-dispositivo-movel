"""Integracao com a Open-Meteo Air Quality API (fonte operacional de dados).

Recorte: qualidade do ar em Sao Paulo (SP)
------------------------------------------
Esta versao do sistema e focada no territorio de Sao Paulo (SP). Para qualidade
do ar combinamos duas camadas:

1. Fonte OPERACIONAL (dado consumido em runtime):
   - API: Open-Meteo Air Quality API
   - Endpoint: https://air-quality-api.open-meteo.com/v1/air-quality
   - Documentacao: https://open-meteo.com/en/docs/air-quality-api
   - Licenca/uso: gratuita, sem necessidade de chave de API (API key), com
     atribuicao. Dados abertos (CC BY 4.0). Retorna concentracoes horarias de
     poluentes (PM2.5, PM10, monoxido de carbono, dioxido de nitrogenio,
     ozonio) por latitude/longitude. Base cientifica: modelos CAMS/Copernicus.
   - Validada para SP (hourly_units de pm2_5/pm10 em microgramas por metro
     cubico). Escolhida por ser publica, gratuita, sem chave e comprovavel. A
     alternativa OpenAQ v3 exige X-API-Key e por isso NAO foi usada.

2. Autoridade OFICIAL de referencia em SP (citada, nao consumida):
   - CETESB - Companhia Ambiental do Estado de Sao Paulo: https://cetesb.sp.gov.br/ar/
   - QUALAR - Sistema de Informacoes da Qualidade do Ar: https://qualar.cetesb.sp.gov.br
   - A CETESB opera a rede oficial de monitoramento da qualidade do ar no
     Estado de SP (indice de qualidade do ar, IQAr). Nao possui API REST aberta
     e estavel para consumo direto, por isso a usamos como REFERENCIA oficial e
     mantemos a Open-Meteo como fonte operacional dos valores persistidos.

Onde e aplicado: chamado pelo router de medicoes
(``POST /api/v1/regioes/{id}/atualizar-ar``) para buscar as concentracoes mais
recentes de uma regiao de SP (lat/lon do seed) e persisti-las como Medicoes do
tipo ``qualidade_ar``, com a ``fonte`` citando a Open-Meteo (operacional) e a
CETESB/QUALAR (referencia oficial de SP).

Tratamento de erro: qualquer falha de rede/timeout/HTTP e convertida em
``OpenMeteoError`` (nunca estoura um 500 cru); o router traduz isso em uma
resposta de erro padronizada (HTTP 502 em PT-BR).
"""

from dataclasses import dataclass
from typing import Optional

import httpx

# URL base e endpoint da Open-Meteo Air Quality API (ver docstring/fonte acima).
OPEN_METEO_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"

# Poluentes horarios solicitados. A ordem/nomes seguem a doc da Open-Meteo.
HOURLY_PARAMS = "pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,ozone"

# Unidade padrao (fallback) por parametro. A unidade real e lida do bloco
# 'hourly_units' do payload da Open-Meteo (ver mapear_payload); este mapa so e
# usado quando o payload nao traz a unidade do parametro.
UNIDADE_PADRAO = "ug/m3"

UNIDADES = {
    "pm2_5": UNIDADE_PADRAO,
    "pm10": UNIDADE_PADRAO,
    "carbon_monoxide": UNIDADE_PADRAO,
    "nitrogen_dioxide": UNIDADE_PADRAO,
    "ozone": UNIDADE_PADRAO,
}

# FONTE registra a origem OPERACIONAL (Open-Meteo) e a autoridade OFICIAL de
# referencia de qualidade do ar em SP (CETESB/QUALAR). A CETESB nao expoe API
# REST aberta estavel, por isso e citada como referencia e nao consumida.
FONTE = (
    "Open-Meteo Air Quality API (dado operacional, "
    "https://open-meteo.com/en/docs/air-quality-api); referencia oficial de SP: "
    "CETESB/QUALAR (https://qualar.cetesb.sp.gov.br, https://cetesb.sp.gov.br/ar/)"
)

TIMEOUT_SEGUNDOS = 10.0


class OpenMeteoError(Exception):
    """Erro tratado da integracao Open-Meteo (rede, timeout ou payload)."""


@dataclass
class LeituraAr:
    """Uma leitura de poluente pronta para virar uma Medicao."""

    parametro: str
    valor: float
    unidade: str
    timestamp: str  # ISO 8601 retornado pela Open-Meteo (ex.: '2024-01-01T10:00')


def mapear_payload(payload: dict) -> list[LeituraAr]:
    """Mapeia o JSON da Open-Meteo para a medida horaria mais recente.

    A Open-Meteo retorna, em ``hourly``, uma lista ``time`` e uma lista de
    valores por parametro. Selecionamos o indice mais recente cujo valor nao
    seja nulo para cada parametro solicitado.

    Levanta OpenMeteoError se o payload nao tiver a estrutura esperada.
    """
    hourly = payload.get("hourly")
    if not isinstance(hourly, dict):
        raise OpenMeteoError("Resposta da Open-Meteo sem o bloco 'hourly'.")

    tempos = hourly.get("time") or []
    if not tempos:
        raise OpenMeteoError("Resposta da Open-Meteo sem series temporais.")

    # A unidade de cada parametro vem no bloco 'hourly_units' do payload (ex.:
    # microgramas por metro cubico com simbolos Unicode). Lemos de la para nao
    # depender de valores fixos; se o bloco/parametro faltar, usamos o fallback.
    hourly_units = payload.get("hourly_units")
    if not isinstance(hourly_units, dict):
        hourly_units = {}

    leituras: list[LeituraAr] = []
    for parametro in ("pm2_5", "pm10", "carbon_monoxide", "nitrogen_dioxide", "ozone"):
        valores = hourly.get(parametro)
        if not valores:
            continue
        unidade = hourly_units.get(parametro) or UNIDADES.get(parametro, UNIDADE_PADRAO)
        # Percorre de tras para frente ate achar o valor nao-nulo mais recente.
        for indice in range(len(valores) - 1, -1, -1):
            valor = valores[indice]
            if valor is None:
                continue
            leituras.append(
                LeituraAr(
                    parametro=parametro,
                    valor=float(valor),
                    unidade=unidade,
                    timestamp=tempos[indice] if indice < len(tempos) else tempos[-1],
                )
            )
            break

    if not leituras:
        raise OpenMeteoError("Nenhum valor de poluente valido na resposta.")
    return leituras


def buscar_qualidade_ar(
    latitude: float, longitude: float, client: Optional[httpx.Client] = None
) -> list[LeituraAr]:
    """Consulta a Open-Meteo e retorna as leituras de ar mais recentes.

    Recebe opcionalmente um ``httpx.Client`` (facilita testes). Converte
    qualquer erro de rede/HTTP em ``OpenMeteoError`` para o router tratar.
    """
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": HOURLY_PARAMS,
    }
    proprio_client = client is None
    if proprio_client:
        client = httpx.Client(timeout=TIMEOUT_SEGUNDOS)
    try:
        resposta = client.get(OPEN_METEO_URL, params=params)
        resposta.raise_for_status()
        payload = resposta.json()
    except httpx.HTTPError as exc:
        raise OpenMeteoError(
            f"Falha ao consultar a Open-Meteo: {exc}"
        ) from exc
    finally:
        if proprio_client:
            client.close()

    return mapear_payload(payload)
