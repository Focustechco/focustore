from fastapi import FastAPI, Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.api.router import api_router
from app.config import get_settings
from app.services.catalog_service import CatalogUnavailable
from app.services.management import DomainError
from app.services.orders import OrdersUnavailable


async def auth_validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    if request.url.path.startswith('/api/v1/auth/'):
        return JSONResponse(status_code=422, content={'detail': 'Dados de autenticacao invalidos.'})
    return await request_validation_exception_handler(request, exc)


async def catalog_unavailable_handler(request: Request, exc: CatalogUnavailable) -> JSONResponse:
    return JSONResponse(status_code=503, content={'detail': 'Catálogo indisponível.'})


async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
    return JSONResponse(status_code=exc.status, content={'detail': exc.detail})


async def database_error_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    return JSONResponse(status_code=503, content={'detail': 'Persistência indisponível.'})


async def orders_error_handler(request: Request, exc: OrdersUnavailable) -> JSONResponse:
    return JSONResponse(status_code=503, content={'detail': 'Pedidos indisponíveis.'})


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(title=settings.app_name, version=settings.app_version, debug=settings.debug)
    if settings.frontend_origin:
        application.add_middleware(
            CORSMiddleware, allow_origins=[settings.frontend_origin],
            allow_credentials=True, allow_methods=['GET', 'POST', 'PATCH', 'DELETE'],
            allow_headers=['Content-Type'],
        )
    application.include_router(api_router)
    application.add_exception_handler(CatalogUnavailable, catalog_unavailable_handler)
    application.add_exception_handler(DomainError, domain_error_handler)
    application.add_exception_handler(SQLAlchemyError, database_error_handler)
    application.add_exception_handler(OrdersUnavailable, orders_error_handler)
    application.add_exception_handler(RequestValidationError, auth_validation_error_handler)

    @application.middleware('http')
    async def private_response_headers(request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith(('/api/v1/users', '/api/v1/orders')):
            response.headers['Cache-Control'] = 'no-store'
            vary = response.headers.get('Vary')
            response.headers['Vary'] = f'{vary}, Cookie' if vary else 'Cookie'
        return response

    return application


app = create_app()
