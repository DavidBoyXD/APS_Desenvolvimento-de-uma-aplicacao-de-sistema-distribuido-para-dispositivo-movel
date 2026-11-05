"""Schemas Pydantic v2 (validação e serialização da API).

Separam o contrato HTTP (entrada/saída JSON) dos modelos ORM. Os schemas de
leitura usam ``from_attributes=True`` para serem construídos diretamente a
partir dos objetos SQLAlchemy.

Inclui o schema de erro padronizado ``ErroResposta``, usado por TODOS os
handlers de exceção (ver errors.py) para dar respostas consistentes em PT-BR.

Referência Pydantic v2: https://docs.pydantic.dev/latest/
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from .models import TipoMedicao


# ---------------------------------------------------------------------------
# Erro padronizado
# ---------------------------------------------------------------------------
class ErroResposta(BaseModel):
    """Formato único de erro retornado pela API (mensagens em PT-BR)."""

    codigo: int = Field(..., description="Codigo HTTP do erro.")
    mensagem: str = Field(..., description="Mensagem legivel em portugues.")
    detalhe: Optional[str] = Field(
        default=None, description="Detalhe tecnico opcional do erro."
    )


# ---------------------------------------------------------------------------
# Região
# ---------------------------------------------------------------------------
class RegiaoBase(BaseModel):
    nome: str = Field(..., min_length=1, max_length=120)
    cidade: str = Field(..., min_length=1, max_length=120)
    uf: str = Field(..., min_length=2, max_length=2)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class RegiaoCreate(RegiaoBase):
    pass


class RegiaoRead(RegiaoBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


# ---------------------------------------------------------------------------
# Localidade (IBGE)
# ---------------------------------------------------------------------------
class MunicipioSPRead(BaseModel):
    """Município de São Paulo lido da API oficial de Localidades do IBGE."""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="Codigo IBGE do municipio.")
    nome: str = Field(..., description="Nome do municipio.")
    uf: str = Field(..., description="Sigla da UF (sempre 'SP').")


# ---------------------------------------------------------------------------
# Medição
# ---------------------------------------------------------------------------
class MedicaoBase(BaseModel):
    tipo: TipoMedicao
    parametro: str = Field(..., min_length=1, max_length=60)
    valor: float
    unidade: str = Field(default="", max_length=30)
    fonte: str = Field(default="", max_length=255)


class MedicaoCreate(MedicaoBase):
    timestamp: Optional[datetime] = None


class MedicaoRead(MedicaoBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    regiao_id: int
    timestamp: datetime


# ---------------------------------------------------------------------------
# Alerta
# ---------------------------------------------------------------------------
class AlertaBase(BaseModel):
    regiao_id: int
    tipo: TipoMedicao
    parametro: str = Field(..., min_length=1, max_length=60)
    limiar: float
    condicao: str = Field(default=">", pattern=r"^[<>]$")
    ativo: bool = True
    mensagem: str = Field(default="", max_length=255)


class AlertaCreate(AlertaBase):
    pass


class AlertaRead(AlertaBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class AlertaDisparado(BaseModel):
    """Resultado da avaliação de um alerta contra uma medição recente."""

    alerta_id: int
    regiao_id: int
    tipo: TipoMedicao
    parametro: str
    limiar: float
    condicao: str
    valor_observado: float
    mensagem: str


# ---------------------------------------------------------------------------
# Relatório
# ---------------------------------------------------------------------------
class ResumoParametro(BaseModel):
    """Agregações de um parâmetro dentro de um tipo."""

    tipo: TipoMedicao
    parametro: str
    unidade: str
    contagem: int
    media: float
    minimo: float
    maximo: float
    ultimo_valor: float
    ultimo_timestamp: datetime


class RelatorioRegiao(BaseModel):
    """Relatório agregado de uma região (cobre 'relatórios adicionais')."""

    regiao: RegiaoRead
    total_medicoes: int
    resumos: list[ResumoParametro]


# ---------------------------------------------------------------------------
# Acompanhamento de ônibus e busca (SPTrans Olho Vivo - itens B e C)
# ---------------------------------------------------------------------------
# Todos os schemas de saída abaixo são construídos a partir das dataclasses do
# serviço ``app.services.sptrans`` (ConfigDict(from_attributes=True)). O campo
# ``tempo_real`` indica se o dado veio do Olho Vivo em tempo real (True) ou do
# fallback de EXEMPLO quando não há token SPTRANS_TOKEN (False); ``fonte``
# descreve a origem (oficial vs. exemplo não tempo real).
class LinhaRead(BaseModel):
    """Linha de ônibus (``/Linha/Buscar``)."""

    model_config = ConfigDict(from_attributes=True)

    codigo_linha: int = Field(
        ..., description="Codigo da linha (cl), usado em posicoes/previsao."
    )
    letreiro: str = Field(..., description="Letreiro/numero da linha (lt).")
    sentido: int = Field(
        ..., description="Sentido da linha (sl): 1 = ida; 2 = volta."
    )
    tipo: int = Field(..., description="Codigo do tipo de linha (tl).")
    terminal_principal: str = Field(
        ..., description="Terminal principal/origem (tp)."
    )
    terminal_secundario: str = Field(
        ..., description="Terminal secundario/destino (ts)."
    )
    circular: bool = Field(..., description="Indica se a linha e circular (lc).")
    tempo_real: bool = Field(
        ..., description="True se tempo real (Olho Vivo); False se EXEMPLO."
    )
    fonte: str = Field(..., description="Origem do dado (oficial ou exemplo).")


class VeiculoPosicaoRead(BaseModel):
    """Posição de um veículo (ônibus) de uma linha."""

    model_config = ConfigDict(from_attributes=True)

    prefixo: str = Field(..., description="Prefixo do veiculo (p).")
    acessivel: bool = Field(
        ..., description="Veiculo acessivel para pessoas com deficiencia (a)."
    )
    timestamp: str = Field(
        ..., description="Instante da posicao em ISO 8601 UTC (ta)."
    )
    latitude: float = Field(..., description="Latitude do veiculo (py).")
    longitude: float = Field(..., description="Longitude do veiculo (px).")


class PosicaoLinhaRead(BaseModel):
    """Posições dos veículos de uma linha (``/Posicao/Linha``)."""

    model_config = ConfigDict(from_attributes=True)

    horario_referencia: str = Field(
        ..., description="Horario de referencia da consulta (hr)."
    )
    veiculos: list[VeiculoPosicaoRead] = Field(
        ..., description="Lista de veiculos com posicao reportada."
    )
    tempo_real: bool = Field(
        ..., description="True se tempo real (Olho Vivo); False se EXEMPLO."
    )
    fonte: str = Field(..., description="Origem do dado (oficial ou exemplo).")


class PrevisaoVeiculoRead(BaseModel):
    """Previsão de chegada de um veículo a uma parada."""

    model_config = ConfigDict(from_attributes=True)

    prefixo: str = Field(..., description="Prefixo do veiculo (p).")
    horario_previsto: str = Field(
        ..., description="Horario previsto de chegada HH:MM (t)."
    )
    acessivel: bool = Field(..., description="Veiculo acessivel (a).")
    timestamp: str = Field(
        ..., description="Instante da posicao do veiculo em ISO 8601 UTC (ta)."
    )
    latitude: float = Field(..., description="Latitude do veiculo (py).")
    longitude: float = Field(..., description="Longitude do veiculo (px).")


class ParadaPrevisaoRead(BaseModel):
    """Parada com as previsões dos veículos de uma linha."""

    model_config = ConfigDict(from_attributes=True)

    codigo_parada: int = Field(..., description="Codigo da parada (cp).")
    nome: str = Field(..., description="Nome da parada (np).")
    latitude: float = Field(..., description="Latitude da parada (py).")
    longitude: float = Field(..., description="Longitude da parada (px).")
    veiculos: list[PrevisaoVeiculoRead] = Field(
        ..., description="Veiculos com previsao de chegada nesta parada."
    )


class PrevisaoLinhaRead(BaseModel):
    """Previsão de chegada por parada de uma linha (``/Previsao/Linha``)."""

    model_config = ConfigDict(from_attributes=True)

    horario_referencia: str = Field(
        ..., description="Horario de referencia da consulta (hr)."
    )
    paradas: list[ParadaPrevisaoRead] = Field(
        ..., description="Paradas com previsoes de chegada."
    )
    tempo_real: bool = Field(
        ..., description="True se tempo real (Olho Vivo); False se EXEMPLO."
    )
    fonte: str = Field(..., description="Origem do dado (oficial ou exemplo).")


class ParadaRead(BaseModel):
    """Parada de ônibus (``/Parada/Buscar``)."""

    model_config = ConfigDict(from_attributes=True)

    codigo: int = Field(..., description="Codigo da parada (cp).")
    nome: str = Field(..., description="Nome da parada (np).")
    endereco: str = Field(..., description="Endereco/descricao da parada (ed).")
    latitude: float = Field(..., description="Latitude da parada (py).")
    longitude: float = Field(..., description="Longitude da parada (px).")
    tempo_real: bool = Field(
        ..., description="True se tempo real (Olho Vivo); False se EXEMPLO."
    )
    fonte: str = Field(..., description="Origem do dado (oficial ou exemplo).")
