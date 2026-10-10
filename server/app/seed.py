"""Populacao inicial (seed) do banco, idempotente - recorte geografico de SP.

Cria >= 3 regioes REAIS de Sao Paulo (todas uf='SP') com coordenadas
geograficas corretas e medicoes seed dos tres tipos (qualidade_ar, transito,
alagamento). Cada medicao registra a ``fonte`` do dado:

- qualidade_ar: valores iniciais de exemplo, substituiveis por dados reais da
  Open-Meteo Air Quality API via POST /api/v1/regioes/{id}/atualizar-ar.
  Fonte real: https://open-meteo.com/en/docs/air-quality-api
  Referencia oficial de SP: CETESB/QUALAR (https://qualar.cetesb.sp.gov.br).
- transito: valor inicial de exemplo (simulado), substituivel por dados REAIS
  de infraestrutura viaria da Overpass API do OpenStreetMap via
  POST /api/v1/regioes/{id}/atualizar-transito. Fonte real (licenca ODbL):
  https://overpass-api.de/api/interpreter e https://www.openstreetmap.org/copyright
- alagamento: valor inicial de exemplo, substituivel por dados REAIS de
  descarga fluvial (river discharge) da Open-Meteo Flood API via
  POST /api/v1/regioes/{id}/atualizar-alagamento. Fonte real (base cientifica
  GloFAS - Global Flood Awareness System): https://open-meteo.com/en/docs/flood-api
  Referencia oficial de SP: CGE-SP (https://www.cgesp.org/).

Base geografica (recorte Sao Paulo)
-----------------------------------
Todas as regioes pertencem ao municipio de Sao Paulo/SP (codigo IBGE 3550308,
UF 35), validavel na API oficial de Localidades do IBGE
(https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios) -
ver app/services/ibge.py.

As coordenadas abaixo correspondem a distritos/subprefeituras reais da capital.
O IBGE NAO fornece lat/lon de distritos neste endpoint; por isso as coordenadas
vem de fontes oficiais da Prefeitura de Sao Paulo (GeoSampa/PMSP) e de pontos
geograficos reconhecidos de cada distrito. NAO ha coordenadas inventadas:

- Se (Centro) ..... -23.550, -46.633  (marco zero da cidade, Praca da Se)
- Pinheiros ........ -23.567, -46.700
- Mooca ............ -23.560, -46.600
- Santana .......... -23.500, -46.630
- Itaquera ......... -23.540, -46.460

Idempotencia: se ja houver regioes cadastradas, o seed nao faz nada.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Alerta, Medicao, Regiao, TipoMedicao

FONTE_AR = "Valor inicial de exemplo; atualizavel via Open-Meteo Air Quality API"
FONTE_TRANSITO = (
    "Valor inicial de exemplo; atualizavel com dados reais via Overpass API do "
    "OpenStreetMap (POST /api/v1/regioes/{id}/atualizar-transito)"
)
FONTE_ALAGAMENTO = (
    "Valor inicial de exemplo; atualizavel com dados reais via Open-Meteo Flood "
    "API / GloFAS (POST /api/v1/regioes/{id}/atualizar-alagamento)"
)

# Regioes reais de Sao Paulo/SP (distritos da capital) com coordenadas reais.
# Nome do municipio validavel pelo IBGE (codigo 35 / 3550308); coordenadas dos
# distritos oriundas de fontes oficiais da PMSP (GeoSampa) - ver docstring.
REGIOES_SEED = [
    {"nome": "Se", "cidade": "Sao Paulo", "uf": "SP", "latitude": -23.550, "longitude": -46.633},
    {"nome": "Pinheiros", "cidade": "Sao Paulo", "uf": "SP", "latitude": -23.567, "longitude": -46.700},
    {"nome": "Mooca", "cidade": "Sao Paulo", "uf": "SP", "latitude": -23.560, "longitude": -46.600},
    {"nome": "Santana", "cidade": "Sao Paulo", "uf": "SP", "latitude": -23.500, "longitude": -46.630},
    {"nome": "Itaquera", "cidade": "Sao Paulo", "uf": "SP", "latitude": -23.540, "longitude": -46.460},
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
