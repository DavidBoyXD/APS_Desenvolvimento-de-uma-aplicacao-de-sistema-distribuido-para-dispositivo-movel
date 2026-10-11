"""Endpoints de regiões (pontos do mapa no app móvel).

- GET /api/v1/regioes           -> lista todas as regiões (alimenta o mapa).
- GET /api/v1/regioes/{id}      -> detalha uma região (404 se não existir).

Referência FastAPI (path params/erros): https://fastapi.tiangolo.com/
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Regiao
from ..schemas import RegiaoRead

router = APIRouter(prefix="/api/v1/regioes", tags=["regioes"])


def obter_regiao_ou_404(db: Session, regiao_id: int) -> Regiao:
    """Busca a região ou levanta 404 com mensagem em PT-BR."""
    regiao = db.get(Regiao, regiao_id)
    if regiao is None:
        raise HTTPException(
            status_code=404, detail=f"Regiao {regiao_id} nao encontrada."
        )
    return regiao


@router.get("", response_model=list[RegiaoRead])
def listar_regioes(db: Session = Depends(get_db)) -> list[Regiao]:
    """Lista todas as regiões monitoradas."""
    return list(db.execute(select(Regiao)).scalars().all())


@router.get("/{regiao_id}", response_model=RegiaoRead)
def obter_regiao(regiao_id: int, db: Session = Depends(get_db)) -> Regiao:
    """Retorna uma região pelo id (404 se não existir)."""
    return obter_regiao_ou_404(db, regiao_id)
