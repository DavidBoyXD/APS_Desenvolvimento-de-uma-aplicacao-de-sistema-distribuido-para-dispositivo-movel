"""Endpoints de medicoes de transporte publico.

- GET  /api/v1/medicoes                    -> lista com filtros (regiao_id, tipo).
- GET  /api/v1/regioes/{id}/medicoes       -> medicoes de uma regiao.
- POST /api/v1/regioes/{id}/atualizar-transporte -> busca a frota de onibus na
  SPTrans Olho Vivo (fonte OFICIAL da Prefeitura de SP, tempo real) quando o
  token SPTRANS_TOKEN esta definido; sem o token, usa um fallback de exemplo
  claramente rotulado (nao tempo real). Persiste medicoes do tipo
  transporte_publico. Falha de rede tambem vira 502 em PT-BR.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Medicao, TipoMedicao
from ..schemas import MedicaoRead
from ..services.sptrans import FONTE as FONTE_TRANSPORTE
from ..services.sptrans import FONTE_FALLBACK as FONTE_TRANSPORTE_FALLBACK
from ..services.sptrans import (
    SPTransError,
    buscar_transporte_publico,
    obter_token,
)
from .regioes import obter_regiao_ou_404

router = APIRouter(prefix="/api/v1", tags=["medicoes"])


@router.get("/medicoes", response_model=list[MedicaoRead])
def listar_medicoes(
    regiao_id: Optional[int] = Query(default=None),
    tipo: Optional[TipoMedicao] = Query(default=None),
    db: Session = Depends(get_db),
) -> list[Medicao]:
    """Lista medicoes, com filtros opcionais por regiao e por tipo."""
    stmt = select(Medicao)
    if regiao_id is not None:
        stmt = stmt.where(Medicao.regiao_id == regiao_id)
    if tipo is not None:
        stmt = stmt.where(Medicao.tipo == tipo)
    stmt = stmt.order_by(Medicao.timestamp.desc())
    return list(db.execute(stmt).scalars().all())


@router.get("/regioes/{regiao_id}/medicoes", response_model=list[MedicaoRead])
def listar_medicoes_da_regiao(
    regiao_id: int, db: Session = Depends(get_db)
) -> list[Medicao]:
    """Lista as medicoes de uma regiao especifica (404 se nao existir)."""
    obter_regiao_ou_404(db, regiao_id)
    stmt = (
        select(Medicao)
        .where(Medicao.regiao_id == regiao_id)
        .order_by(Medicao.timestamp.desc())
    )
    return list(db.execute(stmt).scalars().all())


@router.post(
    "/regioes/{regiao_id}/atualizar-transporte", response_model=list[MedicaoRead]
)
def atualizar_transporte(
    regiao_id: int, db: Session = Depends(get_db)
) -> list[Medicao]:
    """Busca a frota de onibus na SPTrans Olho Vivo e persiste as metricas.

    Com o token ``SPTRANS_TOKEN`` definido, deriva metricas REAIS (tempo real)
    da frota (linhas monitoradas e veiculos em operacao). Sem o token, usa um
    fallback de EXEMPLO claramente rotulado (nao tempo real), de modo que o app
    funcione de ponta a ponta sem token. Em caso de falha de rede/HTTP com
    token, retorna 502 padronizado (nunca 500 cru).

    SEMANTICA (metrica por CIDADE, nao por regiao): o endpoint recebe
    ``regiao_id`` por uniformidade com os demais atualizar-*, mas o /Posicao da
    SPTrans retorna a frota de Sao Paulo como um todo e ignora o lat/lon da
    regiao. Portanto as metricas (linhas monitoradas / veiculos em operacao) sao
    da cidade inteira e, chamadas no mesmo instante, serao identicas para todas
    as regioes de SP. Nao sao dados geofiltrados por regiao.
    """
    regiao = obter_regiao_ou_404(db, regiao_id)

    # A fonte reflete a origem: oficial/tempo real (com token) ou exemplo
    # (fallback sem token). Decidida pela presenca de SPTRANS_TOKEN.
    fonte = FONTE_TRANSPORTE if obter_token() is not None else FONTE_TRANSPORTE_FALLBACK

    try:
        leituras = buscar_transporte_publico(regiao.latitude, regiao.longitude)
    except SPTransError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Nao foi possivel obter dados de transporte publico: {exc}",
        ) from exc

    agora = datetime.now(timezone.utc)
    novas: list[Medicao] = []
    for leitura in leituras:
        medicao = Medicao(
            regiao_id=regiao.id,
            tipo=TipoMedicao.transporte_publico,
            parametro=leitura.parametro,
            valor=leitura.valor,
            unidade=leitura.unidade,
            timestamp=agora,
            fonte=fonte,
        )
        db.add(medicao)
        novas.append(medicao)

    db.commit()
    for medicao in novas:
        db.refresh(medicao)
    return novas
