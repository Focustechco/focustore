import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { InputError } from '@/lib/security/input-error';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { CouponService } from '../promotions/coupon.service';
import { ShippingService } from '../shipping/shipping.service';
import { InventoryService } from '../inventory/inventory.service';

export interface CheckoutInput {
  userId?: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    cpf: string;
  };
  shippingAddress: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    postalCode: string;
  };
  items: {
    variantId: string;
    quantity: number;
  }[];
  couponCode?: string;
  shippingOption: {
    carrier: string;
    serviceName: string;
    price: number;
    estimatedDays: number;
  };
  paymentMethod: 'PIX' | 'CREDIT_CARD';
  cardDetails?: {
    number?: string;
    holder?: string;
    expiry?: string;
    installments: number;
  };
  idempotencyKey?: string;
}


const text = z.string().trim().min(1).max(200);
const checkoutSchema = z.object({
  userId: z.string().min(1).optional(),
  customer: z.object({ name: text, email: z.string().email().max(254), phone: text, cpf: text }),
  shippingAddress: z.object({ street: text, number: text, complement: z.string().max(200).optional(),
    neighborhood: text, city: text, state: z.string().length(2), postalCode: z.string().regex(/^\d{5}-?\d{3}$/) }),
  items: z.array(z.object({ variantId: text, quantity: z.number().int().positive().max(10000) })).min(1).max(100),
  couponCode: z.string().trim().max(100).optional(),
  shippingOption: z.object({ carrier: text, serviceName: text, price: z.number().optional().default(0), estimatedDays: z.number().optional().default(0) }),
  paymentMethod: z.enum(['PIX', 'CREDIT_CARD']),
  cardDetails: z.object({ installments: z.number().int().min(1).max(12) }).optional(),
  idempotencyKey: z.string().min(20).max(200).optional(),
});

export class CheckoutService {
  static async processCheckout(input: CheckoutInput) {
    const validated = checkoutSchema.safeParse(input);
    if (!validated.success) throw new InputError('Dados de checkout invalidos.');
    input = validated.data;
    if (new Set(input.items.map(item => item.variantId)).size !== input.items.length) {
      throw new InputError('Variantes duplicadas no carrinho.');
    }
    if (!input || !Array.isArray(input.items) || input.items.length === 0) {
      throw new InputError('O carrinho está vazio.');
    }

    if (
      input.items.some(
        (item) =>
          !item ||
          typeof item.variantId !== 'string' ||
          !Number.isSafeInteger(item.quantity) ||
          item.quantity <= 0
      )
    ) {
      throw new InputError('Cada produto deve ter uma variante válida e quantidade inteira positiva.');
    }

    if (
      !input.shippingAddress ||
      typeof input.shippingAddress.postalCode !== 'string' ||
      !input.shippingOption ||
      typeof input.shippingOption.carrier !== 'string' ||
      typeof input.shippingOption.serviceName !== 'string'
    ) {
      throw new InputError('Endereço ou opção de frete inválida.');
    }

    if (input.idempotencyKey) {
      const existingOrder = await prisma.order.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { items: true, payments: true },
      });
      if (existingOrder) {
        if (existingOrder.userId !== (input.userId ?? null) ||
            (!input.userId && existingOrder.guestEmail !== input.customer.email) ||
            existingOrder.items.length !== input.items.length ||
            existingOrder.items.some(item => !input.items.some(candidate => candidate.variantId === item.variantId && candidate.quantity === item.quantity))) {
          throw new InputError('Chave de idempotencia ja utilizada.', 409);
        }
        return {
          order: existingOrder,
          payment: existingOrder.payments[0] || null,
          isDuplicate: true,
        };
      }
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Obter e validar variantes reais do banco
      const variantIds = input.items.map((i) => i.variantId);
      const dbVariants = await tx.productVariant.findMany({
        where: { id: { in: variantIds }, isActive: true, product: { status: 'ACTIVE' } },
        include: { product: true, inventory: true },
      });

      if (dbVariants.length !== input.items.length) {
        throw new InputError('Alguns produtos do carrinho não estão mais disponíveis.');
      }

      // 2. Calcular subtotal com base nos preços reais do banco
      let subtotalCents = 0;
      const orderItemsToCreate = [];

      for (const itemInput of input.items) {
        const variant = dbVariants.find((v) => v.id === itemInput.variantId);
        if (!variant) throw new InputError('Variante não encontrada.');

        if (!variant.inventory || variant.inventory.quantityAvailable < itemInput.quantity) {
          throw new InputError(
            `Estoque insuficiente para ${variant.name}. Disponível: ${variant.inventory?.quantityAvailable || 0}`
          );
        }

        if (!Number.isFinite(variant.price) || variant.price <= 0 ||
            (variant.promotionalPrice !== null && (!Number.isFinite(variant.promotionalPrice) || variant.promotionalPrice <= 0 || variant.promotionalPrice >= variant.price))) {
          throw new InputError('Preco do produto invalido.');
        }
        const cents = new Prisma.Decimal(variant.promotionalPrice ?? variant.price).mul(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();
        const itemCents = cents * itemInput.quantity;
        subtotalCents += itemCents;
        if (!Number.isSafeInteger(subtotalCents)) throw new InputError('Total fora do limite.');
        const realPrice = cents / 100;
        const itemTotal = itemCents / 100;

        orderItemsToCreate.push({
          variantId: variant.id,
          productName: variant.product.name,
          variantName: variant.name,
          sku: variant.sku,
          unitPrice: realPrice,
          quantity: itemInput.quantity,
          totalPrice: itemTotal,
          imageUrl: variant.imageUrl || null,
        });
      }

      const calculatedSubtotal = subtotalCents / 100;

      // 3. Validar frete
      const validShippingOptions = ShippingService.calculateShipping(
        input.shippingAddress.postalCode,
        calculatedSubtotal
      );
      const selectedOption = validShippingOptions.find(
        (option) =>
          option.serviceName === input.shippingOption.serviceName &&
          option.carrier === input.shippingOption.carrier
      );
      if (!selectedOption) {
        throw new InputError('A opção de frete selecionada não está disponível para este endereço.');
      }
      const shippingCost = selectedOption.price;

      // 4. Validar cupom no backend
      let discountAmount = 0;
      let appliedCouponId: string | null = null;

      if (input.couponCode) {
        const couponResult = await CouponService.validateCoupon(
          input.couponCode,
          calculatedSubtotal,
          shippingCost,
          tx
        );
        if (!couponResult.valid || !couponResult.coupon) throw new InputError(couponResult.error ?? 'Cupom invalido.');
        if (couponResult.coupon) {
          discountAmount = couponResult.coupon.discountAmount;
          appliedCouponId = couponResult.coupon.id;

          const coupon = await tx.coupon.findUniqueOrThrow({ where: { id: couponResult.coupon.id } });
          const consumed = await tx.coupon.updateMany({
            where: { id: coupon.id, usageCount: coupon.usageCount },
            data: { usageCount: { increment: 1 } },
          });
          if (consumed.count !== 1) throw new InputError('Cupom alterado. Tente novamente.', 409);
        }
      }

      // 5. Total final garantido
      const finalTotal = Math.max(0, subtotalCents - Math.round(discountAmount * 100) + Math.round(shippingCost * 100)) / 100;

      // 6. Gerar order_number amigável
      const currentYear = new Date().getFullYear();
      const orderNumber = `FS-${currentYear}-${randomUUID().toUpperCase()}`;

      // 7. Criar pedido
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: input.userId || null,
          guestEmail: !input.userId ? input.customer.email : null,
          guestName: !input.userId ? input.customer.name : null,
          guestPhone: !input.userId ? input.customer.phone : null,
          guestCpf: !input.userId ? input.customer.cpf : null,
          subtotal: Number(calculatedSubtotal.toFixed(2)),
          discountAmount: Number(discountAmount.toFixed(2)),
          shippingAmount: Number(shippingCost.toFixed(2)),
          total: Number(finalTotal.toFixed(2)),
          status: 'PAYMENT_PENDING',
          idempotencyKey: input.idempotencyKey || null,
          shippingStreet: input.shippingAddress.street,
          shippingNumber: input.shippingAddress.number,
          shippingComplement: input.shippingAddress.complement || null,
          shippingNeighborhood: input.shippingAddress.neighborhood,
          shippingCity: input.shippingAddress.city,
          shippingState: input.shippingAddress.state,
          shippingPostalCode: input.shippingAddress.postalCode,
          items: {
            create: orderItemsToCreate,
          },
          statusHistory: {
            create: {
              status: 'PAYMENT_PENDING',
              comment: 'Pedido gerado no checkout, aguardando pagamento.',
            },
          },
          shipments: {
            create: {
              carrier: selectedOption.carrier,
              serviceName: selectedOption.serviceName,
              cost: Number(shippingCost.toFixed(2)),
              estimatedDays: selectedOption.estimatedDays,
            },
          },
        },
        include: {
          items: true,
        },
      });

      // 8. Se cupom foi usado, registrar CouponUsage
      if (appliedCouponId) {
        await tx.couponUsage.create({
          data: {
            couponId: appliedCouponId,
            orderId: order.id,
            userId: input.userId || null,
            discountApplied: discountAmount,
          },
        });
      }

      // 9. Reservar estoque atomicamente
      await InventoryService.reserveStock(
        tx,
        input.items,
        order.id
      );

      // 10. Gerar intenção de pagamento
      let pixQrCode: string | null = null;
      let pixQrCodeBase64: string | null = null;

      if (input.paymentMethod === 'PIX') {
        pixQrCode = `00020126580014br.gov.bcb.pix0136focus-store-${order.id}520400005303986540${finalTotal.toFixed(2)}5802BR5911FOCUS STORE6009SAO PAULO62070503***6304E8A2`;
        pixQrCodeBase64 = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxODAiIGhlaWdodD0iMTgwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmZmZmZmIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNGRjY1MDAiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIj5QSVggRk9DVVMgU1RPUkU8L3RleHQ+PC9zdmc+';
      }

      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          provider: input.paymentMethod === 'PIX' ? 'focus_pix' : 'focus_card',
          method: input.paymentMethod,
          status: 'PENDING',
          amount: Number(finalTotal.toFixed(2)),
          installments: input.cardDetails?.installments || 1,
          pixQrCode,
          pixQrCodeBase64,
        },
      });

      return {
        order,
        payment,
        isDuplicate: false,
      };
    });
  }
}