import { NextResponse } from 'next/server';
import { CouponService } from '@/modules/promotions/coupon.service';

export async function POST(req: Request) {
  try {
    const { code, subtotal, shippingCost } = await req.json();
    if (!code) {
      return NextResponse.json({ valid: false, error: 'Código de cupom obrigatório' }, { status: 400 });
    }

    const result = await CouponService.validateCoupon(code, Number(subtotal) || 0, Number(shippingCost) || 0);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ valid: false, error: 'Falha ao processar requisição.' }, { status: 500 });
  }
}