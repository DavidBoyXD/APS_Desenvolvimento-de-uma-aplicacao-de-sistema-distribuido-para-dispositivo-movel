"""Modelos ORM (SQLAlchemy 2.x) do domínio de transporte público urbano de SP.

O modelo é genérico e centrado no conceito de "medição por tipo", permitindo
representar as métricas exigidas pela APS com o mesmo esquema. O tipo suportado
usa fonte real e verificável, com o campo ``fonte`` indicando a origem:
transporte público (SPTrans Olho Vivo, frota de ônibus de São Paulo em tempo
real). A base geográfica (município/UF) é validável pela API de Localidades do
IBGE.

Entidades
---------
- Regiao: local monitorado, com latitude/longitude para posicionar no mapa
  do app móvel.
- Medicao: um valor observado (ex.: veiculos_em_operacao = 318 veículos) de um
  ``tipo`` e ``parametro``, ligado a uma região, com data/hora e a fonte do dado.
- Alerta: regra de limiar (ex.: veiculos_em_operacao > 300) que, quando violada
  por uma medição recente, dispara um alerta com mensagem em PT-BR.

Referência SQLAlchemy 2.0 (Mapped/mapped_column): 
https://docs.sqlalchemy.org/en/20/orm/quickstart.html
"""

import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class TipoMedicao(str, enum.Enum):
    """Tipos de informação urbana suportados pelo sistema."""

    # Transporte público oficial de São Paulo (SPTrans Olho Vivo, tempo real da
    # frota de ônibus; com fallback de exemplo/GTFS estático quando sem token).
    transporte_publico = "transporte_publico"


def _agora_utc() -> datetime:
    """Retorna o instante atual em UTC (timezone-aware)."""
    return datetime.now(timezone.utc)


class Regiao(Base):
    """Região/local monitorado (aparece como ponto no mapa do app móvel)."""

    __tablename__ = "regioes"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(120), nullable=False)
    cidade: Mapped[str] = mapped_column(String(120), nullable=False)
    uf: Mapped[str] = mapped_column(String(2), nullable=False)
    # Coordenadas geográficas usadas pelo mapa (react-native-maps no cliente).
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)

    medicoes: Mapped[list["Medicao"]] = relationship(
        back_populates="regiao", cascade="all, delete-orphan"
    )
    alertas: Mapped[list["Alerta"]] = relationship(
        back_populates="regiao", cascade="all, delete-orphan"
    )


class Medicao(Base):
    """Valor observado de um parâmetro ambiental em uma região."""

    __tablename__ = "medicoes"

    id: Mapped[int] = mapped_column(primary_key=True)
    regiao_id: Mapped[int] = mapped_column(
        ForeignKey("regioes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tipo: Mapped[TipoMedicao] = mapped_column(
        Enum(TipoMedicao, native_enum=False), nullable=False, index=True
    )
    # Parâmetro observado, ex.: 'linhas_monitoradas', 'veiculos_em_operacao'.
    # Mantido como string para o modelo permanecer genérico.
    parametro: Mapped[str] = mapped_column(String(60), nullable=False)
    valor: Mapped[float] = mapped_column(Float, nullable=False)
    unidade: Mapped[str] = mapped_column(String(30), nullable=False, default="")
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_agora_utc
    )
    # Origem do dado (link/descrição). Ex.: 'SPTrans Olho Vivo'.
    fonte: Mapped[str] = mapped_column(String(255), nullable=False, default="")

    regiao: Mapped["Regiao"] = relationship(back_populates="medicoes")


class Alerta(Base):
    """Regra de limiar que dispara um alerta quando violada.

    Ex.: parametro='veiculos_em_operacao', limiar=300, condicao='>'.
    """

    __tablename__ = "alertas"

    id: Mapped[int] = mapped_column(primary_key=True)
    regiao_id: Mapped[int] = mapped_column(
        ForeignKey("regioes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tipo: Mapped[TipoMedicao] = mapped_column(
        Enum(TipoMedicao, native_enum=False), nullable=False
    )
    parametro: Mapped[str] = mapped_column(String(60), nullable=False)
    limiar: Mapped[float] = mapped_column(Float, nullable=False)
    # Condição de comparação: '>' dispara quando valor > limiar; '<' quando
    # valor < limiar.
    condicao: Mapped[str] = mapped_column(String(1), nullable=False, default=">")
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    mensagem: Mapped[str] = mapped_column(String(255), nullable=False, default="")

    regiao: Mapped["Regiao"] = relationship(back_populates="alertas")
