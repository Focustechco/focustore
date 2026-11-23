"""Read-only BRL normalization; never updates persisted Prisma prices."""
from decimal import Decimal, ROUND_HALF_UP

CENT = Decimal('0.01')
MAX_PRICE = Decimal('99999999.99')


def money(value) -> Decimal | None:
    if value is None:
        return None
    amount = Decimal(str(value))
    if not amount.is_finite() or amount < 0 or amount > MAX_PRICE:
        raise ValueError('Invalid source price')
    return amount.quantize(CENT, rounding=ROUND_HALF_UP)


def minor_units(value) -> int:
    amount = money(value)
    if amount is None:
        raise ValueError('Missing source price')
    return int(amount * 100)
