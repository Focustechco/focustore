"""Deterministic server-side freight policy used by the opt-in checkout.

The option price is never accepted from the browser.  The table mirrors the
existing Prisma demo policy until a real carrier contract is approved.
"""

from decimal import Decimal

from app.services.management import DomainError


def quote(postal_code: str, subtotal: Decimal) -> list[dict]:
    clean = ''.join(character for character in postal_code if character.isdigit())
    if len(clean) != 8:
        raise DomainError(422, 'CEP inválido.')
    is_sp = clean[:2] in {'01', '02', '03', '04', '05', '08'}
    is_sudeste = clean.startswith(('0', '1', '2', '3'))
    if subtotal >= Decimal('299.00'):
        return [
            {'carrier': 'Focus Express', 'service_name': 'Frete Grátis Especial', 'amount': Decimal('0.00'), 'days': 2 if is_sp else 4 if is_sudeste else 7},
            {'carrier': 'Correios SEDEX', 'service_name': 'SEDEX Turbo', 'amount': Decimal('14.90') if is_sp else Decimal('28.90'), 'days': 1 if is_sp else 2},
        ]
    if is_sp:
        return [
            {'carrier': 'Focus Express', 'service_name': 'Standard SP', 'amount': Decimal('12.90'), 'days': 2},
            {'carrier': 'Correios SEDEX', 'service_name': 'SEDEX Express', 'amount': Decimal('18.50'), 'days': 1},
        ]
    if is_sudeste:
        return [
            {'carrier': 'Focus Express', 'service_name': 'PAC Econômico', 'amount': Decimal('22.90'), 'days': 5},
            {'carrier': 'Correios SEDEX', 'service_name': 'SEDEX Sudeste', 'amount': Decimal('34.90'), 'days': 2},
        ]
    return [
        {'carrier': 'Focus Express', 'service_name': 'PAC Brasil', 'amount': Decimal('29.90'), 'days': 8},
        {'carrier': 'Correios SEDEX', 'service_name': 'SEDEX Nacional', 'amount': Decimal('49.90'), 'days': 3},
    ]


def selected(postal_code: str, subtotal: Decimal, carrier: str, service_name: str) -> dict:
    for option in quote(postal_code, subtotal):
        if option['carrier'] == carrier and option['service_name'] == service_name:
            return option
    raise DomainError(409, 'A opção de frete não está disponível para este pedido.')
