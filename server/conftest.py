"""Configuracao de testes (pytest).

Fornece um cliente de teste (TestClient) com um banco SQLite ISOLADO em
memoria por sessao de teste, evitando tocar o banco de desenvolvimento
(server/data/app.db). O banco de teste e populado com o mesmo seed idempotente
usado em producao.

O sobrescreve a dependencia ``get_db`` do app para usar a sessao de teste.

Referencia (override de dependencias/testes no FastAPI):
https://fastapi.tiangolo.com/advanced/testing-dependencies/
"""

import json
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.seed import executar_seed

# Engine SQLite em memoria compartilhado entre threads (StaticPool).
_engine_teste = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    future=True,
)
_SessionTeste = sessionmaker(
    bind=_engine_teste, autoflush=False, autocommit=False, future=True
)

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "tests", "fixtures")


@pytest.fixture(scope="session", autouse=True)
def _preparar_banco():
    """Cria as tabelas e roda o seed uma vez por sessao de teste."""
    Base.metadata.create_all(bind=_engine_teste)
    db = _SessionTeste()
    try:
        executar_seed(db)
    finally:
        db.close()
    yield
    Base.metadata.drop_all(bind=_engine_teste)


def _get_db_teste():
    db = _SessionTeste()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def client():
    """TestClient com a dependencia de banco sobrescrita para o banco de teste."""
    app.dependency_overrides[get_db] = _get_db_teste
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def payload_openmeteo() -> dict:
    """Carrega o fixture JSON de resposta da Open-Meteo."""
    caminho = os.path.join(FIXTURES_DIR, "openmeteo_sample.json")
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture()
def payload_overpass() -> dict:
    """Carrega o fixture JSON de resposta da Overpass API do OpenStreetMap."""
    caminho = os.path.join(FIXTURES_DIR, "overpass_sample.json")
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture()
def payload_flood() -> dict:
    """Carrega o fixture JSON de resposta da Open-Meteo Flood API (GloFAS)."""
    caminho = os.path.join(FIXTURES_DIR, "flood_sample.json")
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)
