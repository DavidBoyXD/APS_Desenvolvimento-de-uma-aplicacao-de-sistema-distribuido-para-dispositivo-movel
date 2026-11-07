"""Endpoints de medições de transporte público.

- GET  /api/v1/medicoes                    -> lista com filtros (regiao_id, tipo).
- GET  /api/v1/regioes/{id}/medicoes       -> medições de uma região.
- POST /api/v1/regioes/{id}/atualizar-transporte -> busca a frota de ônibus na
  SPTrans Olho Vivo (fonte OFICIAL da Prefeitura de SP, tempo real) quando o
  token SPTRANS_TOKEN está definido; sem o token, usa um fallback de exemplo
  claramente rotulado (não tempo real). Persiste medições do tipo
  transporte_publico. Falha de rede também vira 502 em PT-BR.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Medicao, TipoMedicao

# Quantidade MÁXIMA de medições mantidas por (regiao_id, tipo, parametro). Ao
# atualizar, as leituras são ACUMULADAS (histórico), mas a série de cada
# parâmetro é limitada às N mais recentes. Assim o relatório tem estatística
# real (amostras > 1, média/mínimo/máximo variando) sem crescer indefinidamente.
LIMITE_HISTORICO_POR_PARAMETRO = 50
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


def podar_historico(
    db: Session,
    regiao_id: int,
    tipo: TipoMedicao,
    parametro: str,
    limite: int = LIMITE_HISTORICO_POR_PARAMETRO,
) -> int:
    """Mantém apenas as ``limite`` medições mais recentes de uma série.

    Uma "série" é o conjunto de medições de um mesmo (regiao_id, tipo,
    parametro). As medições são ordenadas por timestamp (desc) e, como
    critério de desempate estável, por id (desc); as que excederem o limite são
    removidas. Retorna a quantidade de medições removidas.

    É chamada após cada inserção de ``atualizar-transporte`` para que o
    histórico acumule, porém permaneça limitado (sem crescer indefinidamente).
    """
    ids = list(
        db.execute(
            select(Medicao.id)
            .where(Medicao.regiao_id == regiao_id)
            .where(Medicao.tipo == tipo)
            .where(Medicao.parametro == parametro)
            .order_by(Medicao.timestamp.desc(), Medicao.id.desc())
        )
        .scalars()
        .all()
    )
    excedentes = ids[limite:]
    if not excedentes:
        return 0
    db.execute(delete(Medicao).where(Medicao.id.in_(excedentes)))
    return len(excedentes)


@router.get("/medicoes", response_model=list[MedicaoRead])
def listar_medicoes(
    regiao_id: Optional[int] = Query(default=None),
    tipo: Optional[TipoMedicao] = Query(default=None),
    db: Session = Depends(get_db),
) -> list[Medicao]:
    """Lista medições, com filtros opcionais por região e por tipo."""
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
    """Lista as medições de uma região específica (404 se não existir)."""
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
    """Busca a frota de ônibus na SPTrans Olho Vivo e persiste as métricas.

    Com o token ``SPTRANS_TOKEN`` definido, deriva métricas REAIS (tempo real)
    da frota (linhas monitoradas e veículos em operação). Sem o token, usa um
    fallback de EXEMPLO claramente rotulado (não tempo real), de modo que o app
    funcione de ponta a ponta sem token. Em caso de falha de rede/HTTP com
    token, retorna 502 padronizado (nunca 500 cru).

    SEMÂNTICA (métrica por CIDADE, não por região): o endpoint recebe
    ``regiao_id`` por uniformidade com os demais atualizar-*, mas o /Posicao da
    SPTrans retorna a frota de São Paulo como um todo e ignora o lat/lon da
    região. Portanto as métricas (linhas monitoradas / veículos em operação) são
    da cidade inteira e, chamadas no mesmo instante, serão idênticas para todas
    as regiões de SP. Não são dados geofiltrados por região.

    ATUALIZAÇÃO COM ACÚMULO LIMITADO: cada chamada INSERE as novas leituras,
    acumulando o HISTÓRICO de ``transporte_publico`` da região em vez de
    substituí-lo. Após inserir, a série de cada parâmetro é PODADA para manter
    apenas as ``LIMITE_HISTORICO_POR_PARAMETRO`` (50) medições mais recentes por
    (regiao_id, tipo, parametro). Assim os relatórios passam a ter amostras > 1
    e média/mínimo/máximo que variam ao longo do tempo, sem que a tabela cresça
    indefinidamente. A resposta traz apenas as medições recém-inseridas nesta
    chamada.
    """
    regiao = obter_regiao_ou_404(db, regiao_id)

    # A fonte reflete a origem: oficial/tempo real (com token) ou exemplo
    # (fallback sem token). Decidida pela presença de SPTRANS_TOKEN.
    fonte = FONTE_TRANSPORTE if obter_token() is not None else FONTE_TRANSPORTE_FALLBACK

    try:
        leituras = buscar_transporte_publico(regiao.latitude, regiao.longitude)
    except SPTransError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Nao foi possivel obter dados de transporte publico: {exc}",
        ) from exc

    # Insere as novas leituras ACUMULANDO o historico (sem apagar as anteriores).
    # So inserimos apos a busca ser bem-sucedida (acima), de modo que uma falha
    # da fonte (502) nao altere o historico ja existente.
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

    # Garante que as novas medicoes tenham id/timestamp antes de podar o
    # historico (a poda ordena por timestamp e id).
    db.flush()

    # Poda cada serie (regiao, tipo, parametro) afetada para manter apenas as
    # ultimas LIMITE_HISTORICO_POR_PARAMETRO medicoes, evitando crescimento
    # indefinido sem perder a estatistica (amostras > 1).
    parametros_afetados = {leitura.parametro for leitura in leituras}
    for parametro in parametros_afetados:
        podar_historico(
            db,
            regiao.id,
            TipoMedicao.transporte_publico,
            parametro,
        )

    db.commit()
    for medicao in novas:
        db.refresh(medicao)
    return novas
