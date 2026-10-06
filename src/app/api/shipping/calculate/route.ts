import { NextResponse } from 'next/server';
import { ShippingService } from '@/modules/shipping/shipping.service';

export async function POST(req: Request) {
  try {
    const { postalCode, subtotal } = await req.json();
    if (!postalCode) {
      return NextResponse.json({ error: 'CEP obrigatório' }, { status: 400 });
    }

    const options = ShippingService.calculateShipping(postalCode, Number(subtotal) || 0);
    return NextResponse.json(options);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}