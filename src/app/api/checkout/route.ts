import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/session';
import {
  assertGuestOrderSecret,
  GUEST_ORDER_MAX_AGE_SECONDS,
  guestPaymentCookieName,
  guestOrderCookieName,
  grantGuestOrder,
} from '@/lib/auth/guest-order';
import { CheckoutService } from '@/modules/checkout/checkout.service';
import { CheckoutError } from '@/modules/checkout/checkout-errors';
import { InventoryError } from '@/modules/inventory/inventory-error';
import { rateLimit } from '@/lib/security/rate-limit';

const checkoutSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().min(8).max(20),
    cpf: z.string().trim().min(11).max(14),
  }),
  shippingAddress: z.object({
    street: z.string().trim().min(1).max(150),
    number: z.string().trim().min(1).max(30),
    complement: z.string().trim().max(100).optional(),
    neighborhood: z.string().trim().min(1).max(100),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().length(2),
    postalCode: z.string().trim().min(8).max(10),
  }),
  items: z.array(z.object({
    variantId: z.string().uuid({ message: 'Esta variante não pertence ao catálogo Prisma compatível com checkout.' }),
    quantity: z.number().int().positive().max(100),
  })).min(1).max(100),
  couponCode: z.string().trim().max(100).optional(),
  shippingOption: z.object({
    carrier: z.string().trim().min(1).max(100),
    serviceName: z.string().trim().min(1).max(100),
    price: z.number().finite().nonnegative(),
    estimatedDays: z.number().int().nonnegative().max(365),
  }),
  paymentMethod: z.enum(['PIX', 'CREDIT_CARD']),
  cardDetails: z.object({
    number: z.string().min(1).max(4),
    holder: z.string().min(1).max(100),
    expiry: z.string().min(1).max(10),
    installments: z.number().int().positive().max(12),
  }).optional(),
  idempotencyKey: z.string().trim().min(1).max(100).optional(),
});

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Checkout demonstrativo indisponível em produção.' },
      { status: 503 },
    );
  }

  try {
    const origin = req.headers.get('origin');
    if (origin && new URL(origin).origin !== new URL(req.url).origin) {
      return NextResponse.json({ error: 'Origem da requisição não autorizada.' }, { status: 403 });
    }

    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const limitResult = rateLimit(`checkout_${ip}`, 10, 60 * 1000);
    if (!limitResult.success) {
      return NextResponse.json({ error: 'Muitas tentativas de checkout. Aguarde 1 minuto.' }, { status: 429 });
    }

    const body: unknown = await req.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Confira os dados do pedido.' },
        { status: 400 },
      );
    }

    const user = await getAuthenticatedUser();
    if (!user) assertGuestOrderSecret();
    const result = await CheckoutService.processCheckout({
      ...parsed.data,
      userId: user?.id,
    });

    const response = NextResponse.json(result, { status: 201 });
    if (!result.order.userId) {
      const token = grantGuestOrder(result.order.id);
      const cookieOptions = {
        httpOnly: true,
        secure: false,
        sameSite: 'strict' as const,
        maxAge: GUEST_ORDER_MAX_AGE_SECONDS,
      };
      response.cookies.set(guestOrderCookieName(result.order.id), token, {
        ...cookieOptions,
        path: `/checkout/confirmacao/${result.order.id}`,
      });
      response.cookies.set(guestPaymentCookieName(result.order.id), token, {
        ...cookieOptions,
        path: '/api/payments/webhook',
      });
    }

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Confira os dados do pedido.' },
        { status: 400 },
      );
    }

    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof InventoryError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error('Erro no checkout:', error);
    return NextResponse.json(
      { error: 'Não foi possível processar o pedido.' },
      { status: 500 },
    );
  }
}
