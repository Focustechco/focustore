from fastapi import APIRouter, Response
from app.schemas.identity import CurrentUser
from app.security.session import User

router = APIRouter(prefix='/api/v1/users', tags=['Users'])


@router.get('/me', response_model=CurrentUser, responses={401: {'description': 'Valid session required'}, 503: {'description': 'Identity unavailable'}})
def me(user: User, response: Response):
    response.headers['Cache-Control'] = 'no-store'
    return user
