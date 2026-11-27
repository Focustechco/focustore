import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

let token: string | undefined;
const syntheticHash = 'synthetic-password-hash';
const customer = {
  id: 'customer-1', name: 'Cliente', email: 'customer@example.test', emailVerified: null,
  image: null, role: 'CUSTOMER', phone: null, cpf: null,
  createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:00Z'),
  passwordHash: syntheticHash,
};

mock.module('next/headers', {
  namedExports: { cookies: async () => ({ get: () => token ? { value: token } : undefined }) },
});

const syntheticPrisma = {
  session: {
    findUnique: async ({ where }: { where: { sessionToken: string } }) => {
      if (where.sessionToken === 'admin-token') return { expires: new Date('2099-01-01'), user: { id: 'admin', role: 'ADMIN' } };
      if (where.sessionToken === 'manager-token') return { expires: new Date('2099-01-01'), user: { id: 'manager', role: 'MANAGER' } };
      if (where.sessionToken === 'customer-token') return { expires: new Date('2099-01-01'), user: { id: 'customer-1', role: 'CUSTOMER' } };
      return null;
    },
  },
  user: {
    update: async ({ where, data, select }: { where: { id: string }; data: { name?: string }; select: Record<string, boolean> }) => {
      if (where.id !== customer.id) throw new Error(`synthetic-internal-secret ${syntheticHash}`);
      Object.assign(customer, data);
      return Object.fromEntries(Object.keys(select).map(key => [key, customer[key as keyof typeof customer]]));
    },
    findUnique: async ({ where, select }: { where: { id: string }; select: Record<string, unknown> }) => {
      if (where.id !== customer.id) return null;
      const data = { ...customer, addresses: [], orders: [{ total: 10, status: 'PAID', idempotencyKey: 'synthetic-checkout-key' }], reviews: [], couponUsages: [] };
      return Object.fromEntries(Object.keys(select).map(key => [key, data[key as keyof typeof data]]));
    },
    findMany: async () => [{ ...customer, addresses: [], orders: [], _count: { orders: 0, reviews: 0, couponUsages: 0 } }],
  },
};

(globalThis as unknown as { prisma: unknown }).prisma = syntheticPrisma;

test('customer PUT exposes only public fields and sanitizes errors', async () => {
  const { PUT } = await import('../src/app/api/admin/customers/[id]/route');
  const request = () => new Request('http://localhost/api/admin/customers/customer-1', {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Atualizado' }),
  });
  const context = (id: string) => ({ params: Promise.resolve({ id }) });

  token = undefined;
  const anonymous = await PUT(request(), context(customer.id));
  assert.equal(anonymous.status, 401);
  token = 'customer-token';
  const forbidden = await PUT(request(), context(customer.id));
  assert.equal(forbidden.status, 403);
  token = 'admin-token';
  const response = await PUT(request(), context(customer.id));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(Object.keys(result.customer).sort(), [
    'id', 'name', 'email', 'emailVerified', 'image', 'role', 'phone', 'cpf', 'createdAt', 'updatedAt',
  ].sort());
  assert.equal(result.customer.name, 'Atualizado');
  assert.equal(result.customer.email, customer.email);
  token = 'manager-token';
  const managerRoleChange = await PUT(new Request(request().url, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role: 'ADMIN' }),
  }), context(customer.id));
  assert.equal(managerRoleChange.status, 403);
  token = 'admin-token';
  const missing = await PUT(request(), context('missing'));
  assert.equal(missing.status, 500);
  for (const text of [JSON.stringify(result), await anonymous.text(), await forbidden.text(), await managerRoleChange.text(), await missing.text()]) {
    for (const sensitive of [syntheticHash, 'synthetic-internal-secret', 'passwordHash', 'sessionToken', 'admin-token', 'customer-token']) {
      assert.equal(text.includes(sensitive), false);
    }
  }
});

test('customer GET and listing omit credentials and checkout keys', async () => {
  const { GET } = await import('../src/app/api/admin/customers/[id]/route');
  const { GET: listCustomers } = await import('../src/app/api/admin/customers/route');
  const request = new Request('http://localhost/api/admin/customers/customer-1');
  const context = (id: string) => ({ params: Promise.resolve({ id }) });
  token = undefined;
  assert.equal((await GET(request, context(customer.id))).status, 401);
  token = 'customer-token';
  assert.equal((await GET(request, context(customer.id))).status, 403);
  token = 'admin-token';
  const detail = await GET(request, context(customer.id));
  assert.equal(detail.status, 200);
  const detailBody = await detail.json();
  assert.equal(detailBody.customer.id, customer.id);
  assert.equal(detailBody.customer.totalSpent, 10);
  assert.equal(detailBody.customer.orders.length, 1);
  assert.equal((await GET(request, context('missing'))).status, 404);
  const list = await listCustomers(new Request('http://localhost/api/admin/customers'));
  assert.equal(list.status, 200);
  for (const text of [JSON.stringify(detailBody), await list.text()]) {
    for (const sensitive of [syntheticHash, 'passwordHash', 'sessionToken', 'synthetic-checkout-key', 'idempotencyKey']) {
      assert.equal(text.includes(sensitive), false);
    }
  }
});
