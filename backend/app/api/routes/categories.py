from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.dependencies import get_db
from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryResponse, CategoryUpdate
from app.security.session import Admin
from app.services import management

router = APIRouter(prefix='/categories', tags=['Categories'])
DbSession = Annotated[Session, Depends(get_db)]
ADMIN_RESPONSES = {
    401: {'description': 'Valid focus_session required'},
    403: {'description': 'ADMIN/MANAGER and trusted Origin required'},
    404: {'description': 'Resource not found'},
    409: {'description': 'Integrity or stock conflict'},
    503: {'description': 'Identity or persistence unavailable'},
}


@router.post('', response_model=CategoryResponse, status_code=201, responses=ADMIN_RESPONSES)
def create_category(data: CategoryCreate, db: DbSession, admin: Admin):
    return management.save(db, Category(**data.model_dump()))


@router.get('', response_model=list[CategoryResponse])
def list_categories(db: DbSession, skip: Annotated[int, Query(ge=0)] = 0,
                    limit: Annotated[int, Query(ge=1, le=100)] = 20):
    return db.scalars(select(Category).order_by(Category.id).offset(skip).limit(limit)).all()


@router.get('/{category_id}', response_model=CategoryResponse)
def get_category(category_id: int, db: DbSession):
    return management.required(db, Category, category_id)


@router.patch('/{category_id}', response_model=CategoryResponse, responses=ADMIN_RESPONSES)
def update_category(category_id: int, data: CategoryUpdate, db: DbSession, admin: Admin):
    return management.update_category(db, category_id, data.model_dump(exclude_unset=True))


@router.delete('/{category_id}', status_code=204, responses=ADMIN_RESPONSES)
def delete_category(category_id: int, db: DbSession, admin: Admin):
    management.delete_resource(db, Category, category_id)
    return Response(status_code=204)
