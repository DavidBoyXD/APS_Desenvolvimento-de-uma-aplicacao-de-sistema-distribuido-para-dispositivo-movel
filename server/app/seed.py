"""Populacao inicial (seed) do banco, idempotente.

Cria >= 3 regioes brasileiras reais com coordenadas geograficas corretas e
medicoes seed dos tres tipos (qualidade_ar, transito, alagamento). Cada
medicao registra a ``fonte`` do dado:

- qualidade_ar: valores iniciais de exemplo, substituiveis por dados reais da
  Open-Meteo Air Quality API via POST /api/v1/regioes/{id}/atualizar-ar.
  Fonte real: https://open-meteo.com/en/docs/air-quality-api
- transito e alagamento: DADOS SIMULADOS para fins academicos (a APS pede o
  tema, mas nao ha API publica gratuita e sem chave unificada para esses
  dados). A fonte deixa isso explicito.

Coordenadas (fonte: IBGE / Wikipedia dos municipios):
- Sao Paulo/SP: -23.55, -46.63
- Rio de Janeiro/RJ: -22.91, -43.17
- Curitiba/PR: -25.43, -49.27

Idempotencia: se ja houver regioes cadastradas, o seed nao faz nada.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Alerta, Medicao, Regiao, TipoMedicao

FONTE_AR = "Valor inicial de exemplo; atualizavel via Open-Meteo Air Quality API"
FONTE_TRANSITO = "Dado simulado (academico) - nao ha API publica gratuita sem chave"
FONTE_ALAGAMENTO = "Dado simulado (academico) - nao ha API publica gratuita sem chave"

# Regioes brasileiras reais com coordenadas para o mapa.
REGIOES_SEED = [
    {"nome": "Centro", "cidade": "Sao Paulo", "uf": "SP", "latitude": -23.55, "longitude": -46.63},
    {"nome": "Centro", "cidade": "Rio de Janeiro", "uf": "RJ", "latitude": -22.91, "longitude": -43.17},
    {"nome": "Centro", "cidade": "Curitiba", "uf": "PR", "latitude": -25.43, "longitude": -49.27},
]


def _medicoes_para_regiao(regiao: Regiao) -> list[Medicao]:
    """Gera medicoes seed dos tres tipos para uma regiao."""
    return [
        Medicao(
            regiao=regiao,
            tipo=TipoMedicao.qualidade_ar,
            parametro="pm2_5",
            valor=12.5,
            unidade="ug/m3",
            fonte=FONTE_AR,
        ),
        Medicao(
            regiao=regiao,
            tipo=TipoMedicao.qualidade_ar,
            parametro="pm10",
            valor=28.0,
            unidade="ug/m3",
            fonte=FONTE_AR,
        ),
        Medicao(
            regiao=regiao,
            tipo=TipoMedicao.transito,
            parametro="nivel_congestionamento",
            valor=45.0,
            unidade="%",
            fonte=FONTE_TRANSITO,
        ),
        Medicao(
            regiao=regiao,
            tipo=TipoMedicao.alagamento,
            parametro="nivel_agua",
            valor=0.3,
            unidade="m",
            fonte=FONTE_ALAGAMENTO,
        ),
    ]


def _alertas_para_regiao(regiao: Regiao) -> list[Alerta]:
    """Gera regras de alerta seed para uma regiao."""
    return [
        Alerta(
            regiao=regiao,
            tipo=TipoMedicao.qualidade_ar,
            parametro="pm2_5",
            limiar=25.0,
            condicao=">",
            ativo=True,
            mensagem="Qualidade do ar ruim: PM2.5 acima do limite recomendado.",
        ),
        Alerta(
            regiao=regiao,
            tipo=TipoMedicao.alagamento,
            parametro="nivel_agua",
            limiar=0.5,
            condicao=">",
            ativo=True,
            mensagem="Risco de alagamento: nivel da agua elevado.",
        ),
    ]


def executar_seed(db: Session) -> None:
    """Popula o banco se ainda estiver vazio (idempotente)."""
    existe = db.execute(select(Regiao.id).limit(1)).first()
    if existe is not None:
        return

    for dados in REGIOES_SEED:
        regiao = Regiao(**dados)
        db.add(regiao)
        for medicao in _medicoes_para_regiao(regiao):
            db.add(medicao)
        for alerta in _alertas_para_regiao(regiao):
            db.add(alerta)

    db.commit()
