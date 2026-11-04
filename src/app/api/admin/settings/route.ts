import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';

const DEFAULT_SETTINGS = {
  storeName: 'FOCUS STORE®',
  tagline: 'TECHWEAR & LIFESTYLE',
  supportEmail: 'contato@focus.store',
  supportPhone: '+55 (11) 99999-9999',
  instagramHandle: '@focus.store',
  freeShippingThreshold: '299.00',
  pixDiscountPercent: '10',
  maxInstallments: '12',
} as const;

const settingsSchema = z.object({
  storeName: z.string().trim().min(1).max(80),
  tagline: z.string().trim().max(120),
  supportEmail: z.string().trim().email().max(254),
  supportPhone: z.string().trim().min(1).max(40),
  instagramHandle: z.string().trim().max(60),
  freeShippingThreshold: z
    .string()
    .regex(/^\d{1,6}(\.\d{1,2})?$/)
    .refine((value) => Number(value) <= 100000),
  pixDiscountPercent: z
    .string()
    .regex(/^\d{1,3}$/)
    .refine((value) => Number(value) <= 100),
  maxInstallments: z
    .string()
    .regex(/^\d{1,2}$/)
    .refine((value) => Number(value) >= 1 && Number(value) <= 24),
});

export async function GET() {
  const authorization = await requireAdmin();
  if (!authorization.authorized) return authorization.response;

  try {
    const storedSettings = await prisma.setting.findMany({
      where: { key: { in: Object.keys(DEFAULT_SETTINGS) } },
      select: { key: true, value: true },
    });
    const settings = { ...DEFAULT_SETTINGS };

    for (const setting of storedSettings) {
      if (setting.key in settings) {
        Object.assign(settings, { [setting.key]: setting.value });
      }
    }

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('Error fetching admin settings:', error);
    return NextResponse.json(
      { success: false, error: 'Não foi possível carregar as configurações.' },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const authorization = await requireAdmin();
  if (!authorization.authorized) return authorization.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Requisição inválida.' },
      { status: 400 },
    );
  }

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Confira os dados informados.',
      },
      { status: 400 },
    );
  }

  try {
    await prisma.$transaction(
      Object.entries(parsed.data).map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        }),
      ),
    );

    return NextResponse.json({ success: true, settings: parsed.data });
  } catch (error) {
    console.error('Error saving admin settings:', error);
    return NextResponse.json(
      { success: false, error: 'Não foi possível salvar as configurações.' },
      { status: 500 },
    );
  }
}
