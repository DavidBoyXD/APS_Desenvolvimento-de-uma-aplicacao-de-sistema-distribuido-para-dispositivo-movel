"""Endpoints de acompanhamento de ônibus e busca (SPTrans Olho Vivo).

Expõe a busca de linhas/paradas e o acompanhamento de uma linha (posição dos
veículos e previsão de chegada), consumindo a API oficial SPTrans Olho Vivo
quando o token ``SPTRANS_TOKEN`` está definido. Sem o token, cada rota devolve
um conjunto de EXEMPLO claramente rotulado como NÃO tempo real
(``tempo_real=false``), de modo que o app funcione de ponta a ponta sem token.

Rotas (todas sob o prefixo /api/v1):
- GET /linhas/buscar?termo=...                -> busca de linhas (/Linha/Buscar).
- GET /linhas/{codigo_linha}/posicoes         -> posições (/Posicao/Linha).
- GET /linhas/{codigo_linha}/previsao         -> previsão (/Previsao/Linha).
- GET /paradas/buscar?termo=...               -> busca de paradas (/Parada/Buscar).

Tratamento de erro: qualquer ``SPTransError`` (rede/HTTP/autenticação) é
traduzida para HTTP 502 em PT-BR (schema ErroResposta), seguindo o mesmo padrão
de ``atualizar_transporte`` em medicoes.py. Nunca estoura um 500 cru.
"""

from fastapi import APIRouter, HTTPException, Query

from ..schemas import (
    LinhaRead,
    ParadaRead,
    PosicaoLinhaRead,
    PrevisaoLinhaRead,
)
from ..services.sptrans import (
    SPTransError,
    buscar_linhas,
    buscar_paradas,
    buscar_posicoes_linha,
    buscar_previsao_linha,
)

router = APIRouter(prefix="/api/v1", tags=["linhas"])


@router.get("/linhas/buscar", response_model=list[LinhaRead])
def buscar_linhas_endpoint(
    termo: str = Query(
        ..., min_length=1, description="Texto de busca da linha (letreiro/nome)."
    )
) -> list[LinhaRead]:
    """Busca linhas de ônibus de SP por texto (Olho Vivo ``/Linha/Buscar``).

    Com ``SPTRANS_TOKEN`` definido, consulta o Olho Vivo em tempo real. Sem o
    token, devolve linhas de EXEMPLO rotuladas como NÃO tempo real. Falha
    externa vira HTTP 502 em PT-BR.
    """
    try:
        return buscar_linhas(termo)
    except SPTransError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Nao foi possivel buscar linhas de onibus: {exc}",
        ) from exc


@router.get("/linhas/{codigo_linha}/posicoes", response_model=PosicaoLinhaRead)
def posicoes_linha_endpoint(codigo_linha: int) -> PosicaoLinhaRead:
    """Posições dos veículos de uma linha (Olho Vivo ``/Posicao/Linha``).

    Recebe o código da linha (``cl``, obtido em /linhas/buscar). Com token,
    retorna as posições em tempo real; sem token, um conjunto de EXEMPLO
    rotulado como NÃO tempo real. Falha externa vira HTTP 502 em PT-BR.
    """
    try:
        return buscar_posicoes_linha(codigo_linha)
    except SPTransError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Nao foi possivel obter as posicoes da linha: {exc}",
        ) from exc


@router.get("/linhas/{codigo_linha}/previsao", response_model=PrevisaoLinhaRead)
def previsao_linha_endpoint(codigo_linha: int) -> PrevisaoLinhaRead:
    """Previsão de chegada por parada de uma linha (Olho Vivo ``/Previsao/Linha``).

    Recebe o código da linha (``cl``). Com token, retorna a previsão em tempo
    real; sem token, um conjunto de EXEMPLO rotulado como NÃO tempo real. Falha
    externa vira HTTP 502 em PT-BR.
    """
    try:
        return buscar_previsao_linha(codigo_linha)
    except SPTransError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Nao foi possivel obter a previsao da linha: {exc}",
        ) from exc


@router.get("/paradas/buscar", response_model=list[ParadaRead])
def buscar_paradas_endpoint(
    termo: str = Query(
        ..., min_length=1, description="Texto de busca da parada (nome/endereco)."
    )
) -> list[ParadaRead]:
    """Busca paradas de ônibus de SP por texto (Olho Vivo ``/Parada/Buscar``).

    Com ``SPTRANS_TOKEN`` definido, consulta o Olho Vivo em tempo real. Sem o
    token, devolve paradas de EXEMPLO rotuladas como NÃO tempo real. Falha
    externa vira HTTP 502 em PT-BR.
    """
    try:
        return buscar_paradas(termo)
    except SPTransError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Nao foi possivel buscar paradas de onibus: {exc}",
        ) from exc
