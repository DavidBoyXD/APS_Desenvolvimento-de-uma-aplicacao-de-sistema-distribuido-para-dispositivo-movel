"""Populacao inicial (seed) do banco, idempotente - recorte geografico de SP.

Cria as 5 regioes REAIS de Sao Paulo (todas uf='SP') com coordenadas
geograficas corretas e, para cada uma, uma medicao-semente de transporte
publico claramente rotulada como EXEMPLO (o valor real vem via
POST /api/v1/regioes/{id}/atualizar-transporte, que consulta a SPTrans).

Transporte publico (unico tipo de medicao)
-------------------------------------------
A fonte oficial e a SPTrans Olho Vivo (frota de onibus de Sao Paulo em tempo
real). A medicao-semente abaixo e um valor inicial de EXEMPLO (nao tempo real),
substituivel por dados reais via POST /api/v1/regioes/{id}/atualizar-transporte.
Fonte real: https://www.sptrans.com.br/desenvolvedores/ - ver app/services/sptrans.py.
Semear ao menos uma medicao e um alerta de transporte_publico garante dado
inicial para os relatorios e para a UI do app movel.

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

# Fonte da medicao-semente de transporte publico: valor inicial de EXEMPLO (nao
# tempo real), substituivel por dados reais da SPTrans Olho Vivo via
# POST /api/v1/regioes/{id}/atualizar-transporte.
FONTE_TRANSPORTE_EXEMPLO = (
    "Valor inicial de EXEMPLO (nao tempo real); atualizavel com dados reais da "
    "SPTrans Olho Vivo via POST /api/v1/regioes/{id}/atualizar-transporte "
    "(https://www.sptrans.com.br/desenvolvedores/)"
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
    """Gera a medicao-semente de transporte publico (EXEMPLO) para uma regiao."""
    return [
        Medicao(
            regiao=regiao,
            tipo=TipoMedicao.transporte_publico,
            parametro="veiculos_em_operacao",
            valor=250.0,
            unidade="veiculos",
            fonte=FONTE_TRANSPORTE_EXEMPLO,
        ),
    ]


def _alertas_para_regiao(regiao: Regiao) -> list[Alerta]:
    """Gera a regra de alerta-semente de transporte publico para uma regiao."""
    return [
        Alerta(
            regiao=regiao,
            tipo=TipoMedicao.transporte_publico,
            parametro="veiculos_em_operacao",
            limiar=300.0,
            condicao=">",
            ativo=True,
            mensagem="Frota de onibus em operacao acima do nivel de referencia.",
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
