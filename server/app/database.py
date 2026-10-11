"""Camada de acesso a dados (SQLAlchemy 2.x + SQLite).

Este módulo configura o engine, a sessão (SessionLocal) e a Base declarativa
usados por todo o back-end. O banco padrão é um arquivo SQLite em
``server/data/app.db`` (criado em runtime; o diretório ``data/`` é criado
automaticamente com ``os.makedirs``).

Migração para PostgreSQL
------------------------
O sistema distribuído pode escalar do SQLite (dev/local) para um banco
cliente-servidor como o PostgreSQL sem mudar o restante do código: basta
trocar a URL do engine. Exemplo:

    # SQLite (padrão, arquivo local):
    DATABASE_URL = "sqlite:///.../server/data/app.db"

    # PostgreSQL (produção), usando o driver psycopg:
    DATABASE_URL = "postgresql+psycopg://usuario:senha@host:5432/ambiental"

Ao migrar para PostgreSQL: (1) adicionar o driver ao requirements.txt
(ex.: ``psycopg[binary]``); (2) remover o argumento ``connect_args`` de
``check_same_thread`` (específico do SQLite); (3) definir DATABASE_URL via
variável de ambiente. O ORM (models.py) e as sessões permanecem iguais.

Referências:
- SQLAlchemy 2.0 (engine/sessão): https://docs.sqlalchemy.org/en/20/orm/quickstart.html
- SQLite com FastAPI: https://fastapi.tiangolo.com/tutorial/sql-databases/
"""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# Diretório server/ (dois níveis acima deste arquivo: app/ -> server/).
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")

# Garante que server/data/ exista antes de o SQLite criar o arquivo do banco.
os.makedirs(DATA_DIR, exist_ok=True)

DB_PATH = os.path.join(DATA_DIR, "app.db")

# URL do banco. Trocar por uma URL PostgreSQL para migrar (ver docstring acima).
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}")

# check_same_thread=False é necessário para o SQLite ser usado por múltiplas
# threads (o servidor ASGI/TestClient acessa a conexão de threads diferentes).
# Esse connect_args é específico do SQLite e deve ser removido no PostgreSQL.
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=_connect_args, future=True)

# Fábrica de sessões. Cada requisição usa uma sessão própria (ver get_db).
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    """Base declarativa para os modelos ORM (estilo SQLAlchemy 2.x)."""


def get_db():
    """Dependência FastAPI que fornece uma sessão por requisição.

    Uso nos routers: ``db: Session = Depends(get_db)``. A sessão é sempre
    fechada ao final, mesmo em caso de erro.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
