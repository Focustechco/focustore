import { prisma } from '@/lib/db/prisma';

export interface CouponValidationResult {
  valid: boolean;
  coupon?: {
    id: string;
    code: string;
    discountType: string;
    discountValue: number;
    discountAmount: number;
    freeShipping: boolean;
  };
  error?: string;
}

export class CouponService {
  static async validateCoupon(code: string, subtotal: number, shippingCost: number): Promise<CouponValidationResult> {
    const coupon = await prisma.coupon.findUnique({
      where: { code: code.toUpperCase().trim() },
    });

    if (!coupon) {
      return { valid: false, error: 'Cupom de desconto não encontrado.' };
    }

    if (!coupon.isActive) {
      return { valid: false, error: 'Este cupom não está mais ativo.' };
    }

    if (coupon.expiresAt && new Date() > coupon.expiresAt) {
      return { valid: false, error: 'Este cupom está expirado.' };
    }

    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return { valid: false, error: 'Este cupom atingiu o limite de utilizações.' };
    }

    if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
      return {
        valid: false,
        error: `Valor mínimo de pedido para este cupom é R$ ${coupon.minOrderAmount.toFixed(2)}.`,
      };
    }

    let discountAmount = 0;
    let freeShipping = false;

    if (coupon.discountType === 'PERCENTAGE') {
      discountAmount = (subtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    } else if (coupon.discountType === 'FIXED_AMOUNT') {
      discountAmount = Math.min(coupon.discountValue, subtotal);
    } else if (coupon.discountType === 'FREE_SHIPPING') {
      discountAmount = shippingCost;
      freeShipping = true;
    }

    return {
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: Number(discountAmount.toFixed(2)),
        freeShipping,
      },
    };
  }
}