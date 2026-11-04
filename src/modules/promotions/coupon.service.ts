import type { Prisma } from '@prisma/client';
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
  static async validateCoupon(
    code: string,
    subtotal: number,
    shippingCost: number,
    database: Pick<Prisma.TransactionClient, 'coupon'> = prisma,
  ): Promise<CouponValidationResult> {
    if (
      typeof code !== 'string' ||
      !code.trim() ||
      !Number.isFinite(subtotal) ||
      subtotal < 0 ||
      !Number.isFinite(shippingCost) ||
      shippingCost < 0
    ) {
      return { valid: false, error: 'Dados do cupom ou do pedido inválidos.' };
    }

    const coupon = await database.coupon.findUnique({
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

    if (coupon.startsAt && new Date() < coupon.startsAt) {
      return { valid: false, error: 'Este cupom ainda não está disponível.' };
    }

    if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
      return { valid: false, error: 'Este cupom atingiu o limite de utilizações.' };
    }

    if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
      return {
        valid: false,
        error: `Valor mínimo de pedido para este cupom é R$ ${coupon.minOrderAmount.toFixed(2)}.`,
      };
    }

    if (
      !Number.isFinite(coupon.discountValue) ||
      coupon.discountValue < 0 ||
      (coupon.minOrderAmount !== null &&
        (!Number.isFinite(coupon.minOrderAmount) || coupon.minOrderAmount < 0)) ||
      (coupon.discountType === 'PERCENTAGE' && coupon.discountValue > 100) ||
      (coupon.maxDiscount !== null && (!Number.isFinite(coupon.maxDiscount) || coupon.maxDiscount < 0)) ||
      !['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING'].includes(coupon.discountType)
    ) {
      return { valid: false, error: 'A configuração deste cupom é inválida.' };
    }

    let discountAmount = 0;
    let freeShipping = false;

    if (coupon.discountType === 'PERCENTAGE') {
      discountAmount = (subtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscount !== null && discountAmount > coupon.maxDiscount) {
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