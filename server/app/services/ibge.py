"""Integracao com a API de Localidades do IBGE (fonte oficial de dados).

Fonte de dados (base geografica oficial de Sao Paulo)
-----------------------------------------------------
- API: Servico de Dados do IBGE - Localidades
- Endpoint: https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios
- Documentacao: https://servicodados.ibge.gov.br/api/docs/localidades
- Licenca/uso: oficial, publica, gratuita e SEM necessidade de chave de API.
  O codigo ``35`` e o codigo oficial da Unidade da Federacao Sao Paulo (SP) no
  IBGE; o endpoint retorna todos os municipios de SP.

Escolhemos a API do IBGE por ser a fonte OFICIAL e verificavel dos nomes e
codigos dos municipios brasileiros. Ela e usada aqui para VALIDAR e listar os
municipios de SP (nome/UF), estabelecendo o recorte geografico do sistema.

ATENCAO ao formato: este endpoint retorna uma LISTA JSON (nao um objeto). Cada
item tem ``id`` (codigo IBGE do municipio) e ``nome``, alem de blocos aninhados
(``microrregiao`` -> ``mesorregiao`` -> ``UF`` e ``regiao-imediata`` ->
``regiao-intermediaria`` -> ``UF``) de onde lemos a sigla da UF ("SP").

Onde e aplicado: usado para validar/listar os municipios de SP. O seed
(``app/seed.py``) referencia esta fonte como origem oficial dos nomes/UF das
regioes de SP cadastradas. Opcionalmente exposto via
``GET /api/v1/localidades/sp``.

Observacao: o IBGE NAO fornece latitude/longitude neste endpoint; por isso as
coordenadas das regioes vem de fontes oficiais citadas no seed (GeoSampa/PMSP),
nunca inventadas.

Tratamento de erro: qualquer falha de rede/timeout/HTTP e convertida em
``IbgeError`` (nunca estoura um 500 cru); o router traduz isso em uma resposta
de erro padronizada (HTTP 502 em PT-BR).
"""

from dataclasses import dataclass
from typing import Optional

import httpx

# Endpoint oficial de municipios da UF 35 (Sao Paulo) no IBGE.
IBGE_MUNICIPIOS_SP_URL = (
    "https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios"
)

# Codigo oficial IBGE da Unidade da Federacao Sao Paulo.
UF_SP_CODIGO = 35

TIMEOUT_SEGUNDOS = 10.0

FONTE = (
    "IBGE - API de Localidades (UF 35 = Sao Paulo): "
    "https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios"
)


class IbgeError(Exception):
    """Erro tratado da integracao com o IBGE (rede, timeout ou payload)."""


@dataclass
class MunicipioSP:
    """Um municipio de Sao Paulo lido da API de Localidades do IBGE."""

    id: int
    nome: str
    uf: str


def _extrair_uf(item: dict) -> Optional[str]:
    """Le a sigla da UF dos blocos aninhados do item (microrregiao ou imediata).

    O IBGE expoe a UF em ``microrregiao.mesorregiao.UF.sigla`` e tambem em
    ``regiao-imediata.regiao-intermediaria.UF.sigla``. Tentamos ambos para
    tolerar variacoes do payload.
    """
    micro = item.get("microrregiao")
    if isinstance(micro, dict):
        meso = micro.get("mesorregiao")
        if isinstance(meso, dict):
            uf = meso.get("UF")
            if isinstance(uf, dict) and uf.get("sigla"):
                return str(uf["sigla"])

    imediata = item.get("regiao-imediata")
    if isinstance(imediata, dict):
        intermediaria = imediata.get("regiao-intermediaria")
        if isinstance(intermediaria, dict):
            uf = intermediaria.get("UF")
            if isinstance(uf, dict) and uf.get("sigla"):
                return str(uf["sigla"])

    return None


def mapear_payload(payload: list) -> list[MunicipioSP]:
    """Mapeia a LISTA de municipios do IBGE para objetos ``MunicipioSP``.

    O endpoint retorna uma lista; cada item precisa ter ``id`` (int) e ``nome``
    (str). A sigla da UF e lida dos blocos aninhados (ver ``_extrair_uf``); se
    ausente, assumimos "SP" (o endpoint ja e filtrado pela UF 35).

    Levanta ``IbgeError`` se o payload nao for uma lista ou se nenhum municipio
    valido for encontrado (mesma filosofia dos demais ``mapear_payload``).
    """
    if not isinstance(payload, list):
        raise IbgeError("Resposta do IBGE nao e uma lista de municipios.")

    municipios: list[MunicipioSP] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        identificador = item.get("id")
        nome = item.get("nome")
        if not isinstance(identificador, int) or not isinstance(nome, str) or not nome:
            continue
        uf = _extrair_uf(item) or "SP"
        municipios.append(MunicipioSP(id=identificador, nome=nome, uf=uf))

    if not municipios:
        raise IbgeError("Nenhum municipio valido encontrado na resposta do IBGE.")
    return municipios


def buscar_municipios_sp(
    client: Optional[httpx.Client] = None,
) -> list[MunicipioSP]:
    """Consulta a API de Localidades do IBGE e retorna os municipios de SP.

    Recebe opcionalmente um ``httpx.Client`` (facilita testes). Converte
    qualquer erro de rede/HTTP em ``IbgeError`` para o router tratar.
    """
    proprio_client = client is None
    if proprio_client:
        client = httpx.Client(timeout=TIMEOUT_SEGUNDOS)
    try:
        resposta = client.get(IBGE_MUNICIPIOS_SP_URL)
        resposta.raise_for_status()
        payload = resposta.json()
    except httpx.HTTPError as exc:
        raise IbgeError(f"Falha ao consultar a API do IBGE: {exc}") from exc
    finally:
        if proprio_client:
            client.close()

    return mapear_payload(payload)
