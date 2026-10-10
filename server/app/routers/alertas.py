"""Endpoints de alertas por limiar.

- GET  /api/v1/alertas                    -> lista as regras de alerta.
- POST /api/v1/alertas                    -> cria uma regra de limiar.
- GET  /api/v1/alertas/avaliar/{regiao_id} -> compara as medicoes mais recentes
  de cada parametro com as regras ativas e retorna os alertas disparados, com
  mensagem em PT-BR.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Alerta, Medicao
from ..schemas import AlertaCreate, AlertaDisparado, AlertaRead
from .regioes import obter_regiao_ou_404

router = APIRouter(prefix="/api/v1/alertas", tags=["alertas"])


@router.get("", response_model=list[AlertaRead])
def listar_alertas(db: Session = Depends(get_db)) -> list[Alerta]:
    """Lista todas as regras de alerta cadastradas."""
    return list(db.execute(select(Alerta)).scalars().all())


@router.post("", response_model=AlertaRead, status_code=201)
def criar_alerta(dados: AlertaCreate, db: Session = Depends(get_db)) -> Alerta:
    """Cria uma regra de alerta de limiar (404 se a regiao nao existir)."""
    obter_regiao_ou_404(db, dados.regiao_id)
    alerta = Alerta(**dados.model_dump())
    db.add(alerta)
    db.commit()
    db.refresh(alerta)
    return alerta


def _viola_limiar(valor: float, condicao: str, limiar: float) -> bool:
    """Retorna True quando o valor viola o limiar segundo a condicao."""
    if condicao == ">":
        return valor > limiar
    if condicao == "<":
        return valor < limiar
    return False


@router.get("/avaliar/{regiao_id}", response_model=list[AlertaDisparado])
def avaliar_alertas(
    regiao_id: int, db: Session = Depends(get_db)
) -> list[AlertaDisparado]:
    """Avalia as regras ativas da regiao contra as medicoes mais recentes."""
    obter_regiao_ou_404(db, regiao_id)

    regras = list(
        db.execute(
            select(Alerta).where(Alerta.regiao_id == regiao_id, Alerta.ativo.is_(True))
        )
        .scalars()
        .all()
    )
    if not regras:
        return []

    disparados: list[AlertaDisparado] = []
    for regra in regras:
        # Medicao mais recente do mesmo tipo/parametro da regra.
        stmt = (
            select(Medicao)
            .where(
                Medicao.regiao_id == regiao_id,
                Medicao.tipo == regra.tipo,
                Medicao.parametro == regra.parametro,
            )
            .order_by(Medicao.timestamp.desc())
            .limit(1)
        )
        medicao = db.execute(stmt).scalars().first()
        if medicao is None:
            continue
        if _viola_limiar(medicao.valor, regra.condicao, regra.limiar):
            disparados.append(
                AlertaDisparado(
                    alerta_id=regra.id,
                    regiao_id=regiao_id,
                    tipo=regra.tipo,
                    parametro=regra.parametro,
                    limiar=regra.limiar,
                    condicao=regra.condicao,
                    valor_observado=medicao.valor,
                    mensagem=regra.mensagem
                    or (
                        f"Alerta: {regra.parametro} {regra.condicao} {regra.limiar} "
                        f"(valor atual {medicao.valor})."
                    ),
                )
            )

    return disparados
