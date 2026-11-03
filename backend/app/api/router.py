
from fastapi import APIRouter

from app.api.routes import catalog, categories, health, products, identity, cart, orders


api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(categories.router)
api_router.include_router(products.router)
api_router.include_router(catalog.router)

api_router.include_router(identity.router)
api_router.include_router(cart.router)
api_router.include_router(orders.router)
