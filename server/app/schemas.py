"""Schemas Pydantic v2 (validacao e serializacao da API).

Separam o contrato HTTP (entrada/saida JSON) dos modelos ORM. Os schemas de
leitura usam ``from_attributes=True`` para serem construidos diretamente a
partir dos objetos SQLAlchemy.

Inclui o schema de erro padronizado ``ErroResposta``, usado por TODOS os
handlers de excecao (ver errors.py) para dar respostas consistentes em PT-BR.

Referencia Pydantic v2: https://docs.pydantic.dev/latest/
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from .models import TipoMedicao


# ---------------------------------------------------------------------------
# Erro padronizado
# ---------------------------------------------------------------------------
class ErroResposta(BaseModel):
    """Formato unico de erro retornado pela API (mensagens em PT-BR)."""

    codigo: int = Field(..., description="Codigo HTTP do erro.")
    mensagem: str = Field(..., description="Mensagem legivel em portugues.")
    detalhe: Optional[str] = Field(
        default=None, description="Detalhe tecnico opcional do erro."
    )


# ---------------------------------------------------------------------------
# Regiao
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
# Medicao
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
    """Resultado da avaliacao de um alerta contra uma medicao recente."""

    alerta_id: int
    regiao_id: int
    tipo: TipoMedicao
    parametro: str
    limiar: float
    condicao: str
    valor_observado: float
    mensagem: str


# ---------------------------------------------------------------------------
# Relatorio
# ---------------------------------------------------------------------------
class ResumoParametro(BaseModel):
    """Agregacoes de um parametro dentro de um tipo."""

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
    """Relatorio agregado de uma regiao (cobre 'relatorios adicionais')."""

    regiao: RegiaoRead
    total_medicoes: int
    resumos: list[ResumoParametro]
