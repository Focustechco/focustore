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
    number: string;
    holder: string;
    expiry: string;
    installments: number;
  };
  idempotencyKey?: string;
}

export class CheckoutService {
  static async processCheckout(input: CheckoutInput) {
    if (!input.items || input.items.length === 0) {
      throw new Error('O carrinho está vazio.');
    }

    if (input.idempotencyKey) {
      const existingOrder = await prisma.order.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { items: true, payments: true },
      });
      if (existingOrder) {
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
        where: { id: { in: variantIds }, isActive: true },
        include: { product: true, inventory: true },
      });

      if (dbVariants.length !== input.items.length) {
        throw new Error('Alguns produtos do carrinho não estão mais disponíveis.');
      }

      // 2. Calcular subtotal com base nos preços reais do banco
      let calculatedSubtotal = 0;
      const orderItemsToCreate = [];

      for (const itemInput of input.items) {
        const variant = dbVariants.find((v) => v.id === itemInput.variantId);
        if (!variant) throw new Error('Variante não encontrada.');

        if (!variant.inventory || variant.inventory.quantityAvailable < itemInput.quantity) {
          throw new Error(
            `Estoque insuficiente para ${variant.name}. Disponível: ${variant.inventory?.quantityAvailable || 0}`
          );
        }

        const realPrice = variant.promotionalPrice || variant.price;
        const itemTotal = realPrice * itemInput.quantity;
        calculatedSubtotal += itemTotal;

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

      // 3. Validar frete
      let shippingCost = input.shippingOption.price;
      const validShippingOptions = ShippingService.calculateShipping(
        input.shippingAddress.postalCode,
        calculatedSubtotal
      );
      const selectedOption = validShippingOptions.find(
        (o) => o.serviceName === input.shippingOption.serviceName
      );
      if (selectedOption) {
        shippingCost = selectedOption.price;
      }

      // 4. Validar cupom no backend
      let discountAmount = 0;
      let appliedCouponId: string | null = null;

      if (input.couponCode) {
        const couponResult = await CouponService.validateCoupon(
          input.couponCode,
          calculatedSubtotal,
          shippingCost
        );
        if (couponResult.valid && couponResult.coupon) {
          discountAmount = couponResult.coupon.discountAmount;
          appliedCouponId = couponResult.coupon.id;

          await tx.coupon.update({
            where: { id: couponResult.coupon.id },
            data: { usageCount: { increment: 1 } },
          });
        }
      }

      // 5. Total final garantido
      const finalTotal = Math.max(0, calculatedSubtotal - discountAmount + shippingCost);

      // 6. Gerar order_number amigável
      const count = await tx.order.count();
      const currentYear = new Date().getFullYear();
      const orderNumber = `FS-${currentYear}-${String(count + 101).padStart(6, '0')}`;

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
              carrier: input.shippingOption.carrier,
              serviceName: input.shippingOption.serviceName,
              cost: Number(shippingCost.toFixed(2)),
              estimatedDays: input.shippingOption.estimatedDays,
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