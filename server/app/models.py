"""Modelos ORM (SQLAlchemy 2.x) do dominio ambiental urbano.

O modelo e generico e centrado no conceito de "medicao ambiental por tipo",
permitindo representar os varios assuntos exigidos pela APS com o mesmo
esquema: qualidade do ar (nucleo, com dados reais da Open-Meteo), transito e
alagamento (dados simulados com o campo ``fonte`` indicando a origem).

Entidades
---------
- Regiao: local monitorado, com latitude/longitude para posicionar no mapa
  do app movel.
- Medicao: um valor observado (ex.: PM2.5 = 12.3 ug/m3) de um ``tipo`` e
  ``parametro``, ligado a uma regiao, com data/hora e a fonte do dado.
- Alerta: regra de limiar (ex.: PM2.5 > 25) que, quando violada por uma
  medicao recente, dispara um alerta com mensagem em PT-BR.

Referencia SQLAlchemy 2.0 (Mapped/mapped_column): 
https://docs.sqlalchemy.org/en/20/orm/quickstart.html
"""

import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class TipoMedicao(str, enum.Enum):
    """Tipos de informacao ambiental urbana suportados pelo sistema."""

    qualidade_ar = "qualidade_ar"
    transito = "transito"
    alagamento = "alagamento"


def _agora_utc() -> datetime:
    """Retorna o instante atual em UTC (timezone-aware)."""
    return datetime.now(timezone.utc)


class Regiao(Base):
    """Regiao/local monitorado (aparece como ponto no mapa do app movel)."""

    __tablename__ = "regioes"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(120), nullable=False)
    cidade: Mapped[str] = mapped_column(String(120), nullable=False)
    uf: Mapped[str] = mapped_column(String(2), nullable=False)
    # Coordenadas geograficas usadas pelo mapa (react-native-maps no cliente).
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)

    medicoes: Mapped[list["Medicao"]] = relationship(
        back_populates="regiao", cascade="all, delete-orphan"
    )
    alertas: Mapped[list["Alerta"]] = relationship(
        back_populates="regiao", cascade="all, delete-orphan"
    )


class Medicao(Base):
    """Valor observado de um parametro ambiental em uma regiao."""

    __tablename__ = "medicoes"

    id: Mapped[int] = mapped_column(primary_key=True)
    regiao_id: Mapped[int] = mapped_column(
        ForeignKey("regioes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tipo: Mapped[TipoMedicao] = mapped_column(
        Enum(TipoMedicao, native_enum=False), nullable=False, index=True
    )
    # Parametro observado, ex.: 'pm2_5', 'pm10', 'nivel_congestionamento',
    # 'nivel_agua'. Mantido como string para o modelo permanecer generico.
    parametro: Mapped[str] = mapped_column(String(60), nullable=False)
    valor: Mapped[float] = mapped_column(Float, nullable=False)
    unidade: Mapped[str] = mapped_column(String(30), nullable=False, default="")
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_agora_utc
    )
    # Origem do dado (link/descricao). Ex.: 'Open-Meteo Air Quality API'.
    fonte: Mapped[str] = mapped_column(String(255), nullable=False, default="")

    regiao: Mapped["Regiao"] = relationship(back_populates="medicoes")


class Alerta(Base):
    """Regra de limiar que dispara um alerta quando violada."""

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
    # Condicao de comparacao: '>' dispara quando valor > limiar; '<' quando
    # valor < limiar.
    condicao: Mapped[str] = mapped_column(String(1), nullable=False, default=">")
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    mensagem: Mapped[str] = mapped_column(String(255), nullable=False, default="")

    regiao: Mapped["Regiao"] = relationship(back_populates="alertas")
