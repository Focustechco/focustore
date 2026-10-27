from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.config import get_settings
from app.services.catalog_service import CatalogUnavailable


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
)

app.include_router(api_router)


@app.exception_handler(CatalogUnavailable)
async def catalog_unavailable_handler(request: Request, exc: CatalogUnavailable) -> JSONResponse:
    return JSONResponse(status_code=503, content={'detail': 'Catálogo indisponível.'})
