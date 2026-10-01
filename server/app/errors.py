"""Tratamento de erros global e padronizado (respostas em PT-BR).

Registra tres exception handlers no app FastAPI, todos retornando o schema
``ErroResposta`` (codigo/mensagem/detalhe):

1. HTTPException      -> erros esperados (ex.: 404 regiao inexistente).
2. RequestValidationError -> corpo/parametros invalidos (422).
3. Exception (generico)   -> qualquer falha inesperada vira 500 tratado,
   sem vazar stack trace cru para o cliente.

Isso atende ao requisito de "tratamento de erros robusto" da APS.

Referencia (exception handlers no FastAPI):
https://fastapi.tiangolo.com/tutorial/handling-errors/
"""

from typing import Optional

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .schemas import ErroResposta


def _resposta_erro(codigo: int, mensagem: str, detalhe: Optional[str] = None) -> JSONResponse:
    corpo = ErroResposta(codigo=codigo, mensagem=mensagem, detalhe=detalhe)
    return JSONResponse(status_code=codigo, content=corpo.model_dump())


def registrar_handlers(app: FastAPI) -> None:
    """Registra os handlers de excecao no app."""

    @app.exception_handler(StarletteHTTPException)
    async def _http_exception_handler(request: Request, exc: StarletteHTTPException):
        # ``exc.detail`` costuma ja vir em PT-BR (definido nos routers).
        mensagem = exc.detail if isinstance(exc.detail, str) else "Erro na requisicao."
        return _resposta_erro(exc.status_code, mensagem)

    @app.exception_handler(RequestValidationError)
    async def _validation_exception_handler(request: Request, exc: RequestValidationError):
        return _resposta_erro(
            422,
            "Dados de entrada invalidos.",
            detalhe=str(jsonable_encoder(exc.errors())),
        )

    @app.exception_handler(Exception)
    async def _generic_exception_handler(request: Request, exc: Exception):
        return _resposta_erro(
            500,
            "Ocorreu um erro interno no servidor.",
            detalhe=str(exc),
        )
