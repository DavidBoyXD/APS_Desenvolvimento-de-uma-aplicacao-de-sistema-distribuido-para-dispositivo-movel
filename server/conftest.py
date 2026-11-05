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
def payload_sptrans() -> dict:
    """Carrega o fixture JSON de resposta do endpoint /Posicao do Olho Vivo."""
    caminho = os.path.join(FIXTURES_DIR, "sptrans_posicao_sample.json")
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture()
def payload_linha_buscar() -> list:
    """Fixture JSON da resposta de /Linha/Buscar do Olho Vivo (lista de linhas)."""
    caminho = os.path.join(FIXTURES_DIR, "sptrans_linha_buscar_sample.json")
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture()
def payload_posicao_linha() -> dict:
    """Fixture JSON da resposta de /Posicao/Linha do Olho Vivo."""
    caminho = os.path.join(FIXTURES_DIR, "sptrans_posicao_linha_sample.json")
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture()
def payload_previsao_linha() -> dict:
    """Fixture JSON da resposta de /Previsao/Linha do Olho Vivo."""
    caminho = os.path.join(FIXTURES_DIR, "sptrans_previsao_linha_sample.json")
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture()
def payload_parada_buscar() -> list:
    """Fixture JSON da resposta de /Parada/Buscar do Olho Vivo (lista de paradas)."""
    caminho = os.path.join(FIXTURES_DIR, "sptrans_parada_buscar_sample.json")
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture()
def payload_ibge() -> list:
    """Carrega o fixture JSON de resposta da API de Localidades do IBGE (SP).

    Atencao: o endpoint do IBGE retorna uma LISTA de municipios (nao um dict).
    """
    caminho = os.path.join(FIXTURES_DIR, "ibge_municipios_sample.json")
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)
