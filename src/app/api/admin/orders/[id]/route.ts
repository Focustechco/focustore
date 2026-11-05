import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/admin';
import { OrderService } from '@/modules/orders/order.service';
import { ORDER_STATUSES } from '@/modules/orders/order-status';
import { sameOrigin } from '@/lib/security/origin';

const updateSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  comment: z.string().trim().max(300).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = await requireAdmin();
  if (!authorization.authorized) return authorization.response;

  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Origem da requisição não autorizada.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados de status inválidos.' },
      { status: 400 },
    );
  }

  try {
    const { id } = await params;
    const order = await OrderService.updateOrderStatus(
      id,
      parsed.data.status,
      parsed.data.comment,
      authorization.userId,
    );

    if (!order) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, status: order.status });
  } catch (error) {
    console.error('Falha ao atualizar status do pedido:', error);
    return NextResponse.json(
      { error: 'Não foi possível atualizar o pedido.' },
      { status: 500 },
    );
  }
}
