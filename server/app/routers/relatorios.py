"""Endpoint de relatórios agregados por região.

- GET /api/v1/relatorios/regiao/{id} -> agrega as medições por (tipo,
  parametro): contagem, média, mínimo, máximo e a última leitura. Cobre o
  requisito de "relatórios adicionais" da APS.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Medicao
from ..schemas import RelatorioRegiao, ResumoParametro
from .regioes import obter_regiao_ou_404

router = APIRouter(prefix="/api/v1/relatorios", tags=["relatorios"])


@router.get("/regiao/{regiao_id}", response_model=RelatorioRegiao)
def relatorio_regiao(regiao_id: int, db: Session = Depends(get_db)) -> RelatorioRegiao:
    """Gera o relatório agregado de uma região (404 se não existir)."""
    regiao = obter_regiao_ou_404(db, regiao_id)

    stmt = (
        select(Medicao)
        .where(Medicao.regiao_id == regiao_id)
        .order_by(Medicao.timestamp.asc())
    )
    medicoes = list(db.execute(stmt).scalars().all())

    # Agrupa por (tipo, parametro) preservando a ordem cronológica.
    grupos: dict[tuple, list[Medicao]] = {}
    for m in medicoes:
        grupos.setdefault((m.tipo, m.parametro), []).append(m)

    resumos: list[ResumoParametro] = []
    for (tipo, parametro), itens in grupos.items():
        valores = [i.valor for i in itens]
        ultimo = itens[-1]  # mais recente por causa da ordenação asc
        resumos.append(
            ResumoParametro(
                tipo=tipo,
                parametro=parametro,
                unidade=ultimo.unidade,
                contagem=len(valores),
                media=sum(valores) / len(valores),
                minimo=min(valores),
                maximo=max(valores),
                ultimo_valor=ultimo.valor,
                ultimo_timestamp=ultimo.timestamp,
            )
        )

    return RelatorioRegiao(
        regiao=regiao,
        total_medicoes=len(medicoes),
        resumos=resumos,
    )
