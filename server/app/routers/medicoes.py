"""Endpoints de medicoes ambientais.

- GET  /api/v1/medicoes                    -> lista com filtros (regiao_id, tipo).
- GET  /api/v1/regioes/{id}/medicoes       -> medicoes de uma regiao.
- POST /api/v1/regioes/{id}/atualizar-ar   -> busca dados reais na Open-Meteo,
  persiste as medicoes de qualidade do ar e retorna as novas. Falha de rede e
  tratada (retorna 502 padronizado, sem 500 cru).
- POST /api/v1/regioes/{id}/atualizar-transito -> busca vias reais na Overpass
  API do OpenStreetMap (dados ODbL), deriva metricas de infraestrutura viaria
  e persiste as medicoes de transito. Falha de rede tambem vira 502 em PT-BR.
- POST /api/v1/regioes/{id}/atualizar-alagamento -> busca a descarga fluvial
  real na Open-Meteo Flood API (base cientifica GloFAS), deriva metricas de
  alagamento e persiste as medicoes. Falha de rede tambem vira 502 em PT-BR.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Medicao, TipoMedicao
from ..schemas import MedicaoRead
from ..services.openmeteo import FONTE, OpenMeteoError, buscar_qualidade_ar
from ..services.overpass import FONTE as FONTE_TRANSITO
from ..services.overpass import OverpassError, buscar_transito
from ..services.flood import FONTE as FONTE_ALAGAMENTO
from ..services.flood import FloodError, buscar_alagamento
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


@router.post("/regioes/{regiao_id}/atualizar-ar", response_model=list[MedicaoRead])
def atualizar_qualidade_ar(
    regiao_id: int, db: Session = Depends(get_db)
) -> list[Medicao]:
    """Busca a qualidade do ar atual na Open-Meteo e persiste as medicoes.

    Em caso de falha de rede/HTTP, retorna 502 padronizado (nunca 500 cru).
    """
    regiao = obter_regiao_ou_404(db, regiao_id)

    try:
        leituras = buscar_qualidade_ar(regiao.latitude, regiao.longitude)
    except OpenMeteoError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Nao foi possivel obter dados de qualidade do ar: {exc}",
        ) from exc

    novas: list[Medicao] = []
    for leitura in leituras:
        try:
            ts = datetime.fromisoformat(leitura.timestamp)
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
        except ValueError:
            ts = datetime.now(timezone.utc)
        medicao = Medicao(
            regiao_id=regiao.id,
            tipo=TipoMedicao.qualidade_ar,
            parametro=leitura.parametro,
            valor=leitura.valor,
            unidade=leitura.unidade,
            timestamp=ts,
            fonte=FONTE,
        )
        db.add(medicao)
        novas.append(medicao)

    db.commit()
    for medicao in novas:
        db.refresh(medicao)
    return novas


@router.post(
    "/regioes/{regiao_id}/atualizar-alagamento", response_model=list[MedicaoRead]
)
def atualizar_alagamento(
    regiao_id: int, db: Session = Depends(get_db)
) -> list[Medicao]:
    """Busca a descarga fluvial real na Flood API e persiste as medicoes.

    Deriva metricas reais de alagamento (descarga fluvial atual, media e maxima
    do periodo) a partir da serie diaria do GloFAS ao redor da regiao. Em caso
    de falha de rede/HTTP, retorna 502 padronizado (nunca 500 cru).
    """
    regiao = obter_regiao_ou_404(db, regiao_id)

    try:
        leituras = buscar_alagamento(regiao.latitude, regiao.longitude)
    except FloodError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Nao foi possivel obter dados de alagamento: {exc}",
        ) from exc

    novas: list[Medicao] = []
    for leitura in leituras:
        try:
            ts = datetime.fromisoformat(leitura.timestamp)
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
        except (TypeError, ValueError):
            ts = datetime.now(timezone.utc)
        medicao = Medicao(
            regiao_id=regiao.id,
            tipo=TipoMedicao.alagamento,
            parametro=leitura.parametro,
            valor=leitura.valor,
            unidade=leitura.unidade,
            timestamp=ts,
            fonte=FONTE_ALAGAMENTO,
        )
        db.add(medicao)
        novas.append(medicao)

    db.commit()
    for medicao in novas:
        db.refresh(medicao)
    return novas


@router.post(
    "/regioes/{regiao_id}/atualizar-transito", response_model=list[MedicaoRead]
)
def atualizar_transito(
    regiao_id: int, db: Session = Depends(get_db)
) -> list[Medicao]:
    """Busca vias reais na Overpass API e persiste as metricas de transito.

    Deriva metricas reais de infraestrutura viaria (numero de vias principais,
    media de faixas e media de velocidade maxima) a partir das vias do
    OpenStreetMap ao redor da regiao. Em caso de falha de rede/HTTP, retorna
    502 padronizado (nunca 500 cru).
    """
    regiao = obter_regiao_ou_404(db, regiao_id)

    try:
        leituras = buscar_transito(regiao.latitude, regiao.longitude)
    except OverpassError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Nao foi possivel obter dados de transito: {exc}",
        ) from exc

    agora = datetime.now(timezone.utc)
    novas: list[Medicao] = []
    for leitura in leituras:
        medicao = Medicao(
            regiao_id=regiao.id,
            tipo=TipoMedicao.transito,
            parametro=leitura.parametro,
            valor=leitura.valor,
            unidade=leitura.unidade,
            timestamp=agora,
            fonte=FONTE_TRANSITO,
        )
        db.add(medicao)
        novas.append(medicao)

    db.commit()
    for medicao in novas:
        db.refresh(medicao)
    return novas
