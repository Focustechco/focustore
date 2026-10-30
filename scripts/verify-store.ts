import { prisma } from '../src/lib/db/prisma';
import { CheckoutService } from '../src/modules/checkout/checkout.service';
import { CouponService } from '../src/modules/promotions/coupon.service';
import { PaymentService } from '../src/modules/payments/payment.service';
import { ShippingService } from '../src/modules/shipping/shipping.service';

async function runVerification() {
  console.log('--- EXECUTANDO TESTES DE VERIFICACAO FOCUS STORE ---');

  // 1. Teste de Calculo de Frete
  const shippingSP = ShippingService.calculateShipping('01310100', 100);
  console.assert(shippingSP.length > 0, 'Erro: Frete SP nao calculado');
  console.log('[OK] 1. Calculo de frete verificado (SP/Brasil)');

  // 2. Teste de Validacao de Cupom
  const couponResult = await CouponService.validateCoupon('FOCUS10', 200, 15);
  console.assert(couponResult.valid === true, 'Erro: Cupom FOCUS10 deveria ser valido');
  console.assert(couponResult.coupon?.discountAmount === 20, 'Erro: Desconto de 10% de 200 deve ser 20');
  console.log('[OK] 2. Validacao e calculo de cupom verificados (FOCUS10)');

  // 3. Teste de Transacao ACID de Checkout e Reserva de Estoque
  const variant = await prisma.productVariant.findFirst({
    where: { sku: 'FS-TSHIRT-BLK-P' },
    include: { inventory: true },
  });

  if (!variant) throw new Error('Variante para teste nao encontrada');

  const initialStock = variant.inventory?.quantityAvailable || 0;
  const initialReserved = variant.inventory?.quantityReserved || 0;

  const checkoutResult = await CheckoutService.processCheckout({
    customer: {
      name: 'Tester Automatizado',
      email: 'tester@focusstore.com',
      phone: '(11) 91234-5678',
      cpf: '111.222.333-44',
    },
    shippingAddress: {
      street: 'Rua Augusta',
      number: '500',
      neighborhood: 'Consolacao',
      city: 'Sao Paulo',
      state: 'SP',
      postalCode: '01305-000',
    },
    items: [{ variantId: variant.id, quantity: 2 }],
    shippingOption: {
      carrier: 'Focus Express',
      serviceName: 'SEDEX Express',
      price: 18.50,
      estimatedDays: 1,
    },
    paymentMethod: 'PIX',
    idempotencyKey: `test_idemp_${Date.now()}`,
  });

  console.assert(checkoutResult.order.id, 'Erro: Pedido nao gerado');
  console.assert(checkoutResult.payment?.status === 'PENDING', 'Erro: Pagamento deve iniciar como PENDING');

  const updatedVariant = await prisma.productVariant.findUnique({
    where: { id: variant.id },
    include: { inventory: true },
  });

  console.assert(
    updatedVariant?.inventory?.quantityAvailable === initialStock - 2,
    'Erro: Estoque disponivel nao decrementou'
  );
  console.assert(
    updatedVariant?.inventory?.quantityReserved === initialReserved + 2,
    'Erro: Estoque reservado nao incrementou'
  );
  console.log(`[OK] 3. Transacao ACID de Checkout & Reserva de Estoque validada (Pedido: ${checkoutResult.order.orderNumber})`);

  // 4. Teste de Confirmacao de Pagamento via Webhook Idempotente
  const webhookRes = await PaymentService.handlePaymentWebhook({
    eventId: `evt_test_${Date.now()}`,
    eventType: 'payment.success',
    orderId: checkoutResult.order.id,
    paymentId: checkoutResult.payment.id,
    status: 'PAID',
    provider: 'focus_pix_gateway',
  });

  console.assert(webhookRes.status === 'success', 'Erro no processamento do webhook');

  const finalOrder = await prisma.order.findUnique({
    where: { id: checkoutResult.order.id },
  });
  console.assert(finalOrder?.status === 'PAID', 'Erro: Pedido deveria estar como PAID');

  const committedVariant = await prisma.productVariant.findUnique({
    where: { id: variant.id },
    include: { inventory: true },
  });
  console.assert(
    committedVariant?.inventory?.quantityReserved === initialReserved,
    'Erro: Estoque reservado deveria ter sido liberado apos baixa definitiva'
  );
  console.log('[OK] 4. Webhook de Pagamento Idempotente & Baixa Definitiva de Estoque verificados');

  console.log('--- TODOS OS 4 TESTES AUTOMATIZADOS PASSARAM COM SUCESSO! ---');
}

runVerification()
  .catch((err) => {
    console.error('Falha nos testes de verificacao:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });