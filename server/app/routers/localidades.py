"""Endpoints de localidades (base geográfica oficial de São Paulo via IBGE).

- GET /api/v1/localidades/sp -> lista os municípios de SP a partir da API
  oficial de Localidades do IBGE (código da UF = 35). Falha de rede/HTTP é
  tratada (retorna 502 padronizado em PT-BR, sem 500 cru).

Fonte: ver app/services/ibge.py
(https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios).
"""

from fastapi import APIRouter, HTTPException

from ..schemas import MunicipioSPRead
from ..services.ibge import IbgeError, buscar_municipios_sp

router = APIRouter(prefix="/api/v1/localidades", tags=["localidades"])


@router.get("/sp", response_model=list[MunicipioSPRead])
def listar_municipios_sp() -> list[MunicipioSPRead]:
    """Lista os municípios de São Paulo (UF 35) via API oficial do IBGE.

    Em caso de falha de rede/HTTP, retorna 502 padronizado (nunca 500 cru).
    """
    try:
        municipios = buscar_municipios_sp()
    except IbgeError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Nao foi possivel obter os municipios de SP no IBGE: {exc}",
        ) from exc

    return [
        MunicipioSPRead(id=m.id, nome=m.nome, uf=m.uf) for m in municipios
    ]
