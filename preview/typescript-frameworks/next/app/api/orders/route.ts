import { NextResponse, type NextRequest } from 'next/server';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LineSchema = z.object({
  sku: z.string().regex(/^[A-Z]{3}-\d{4,6}$/, 'Invalid SKU'),
  quantity: z.number().int().min(1).max(99).default(1),
});

const CreateOrderSchema = z.object({
  currency: z.enum(['usd', 'eur', 'bdt']).default('usd'),
  couponCode: z.string().trim().toUpperCase().nullish(),
  isGift: z.boolean().optional().default(false),
  lines: z.array(LineSchema).nonempty({ message: 'Cart is empty' }),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

/** GET /api/orders?status=paid&limit=20 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status') ?? undefined;
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 100);

  const orders = await db.order.findMany({
    where: { customerId: session.user.id, ...(status && { status }) },
    orderBy: { placedAt: 'desc' },
    take: limit,
  });

  return NextResponse.json(
    { data: orders, meta: { count: orders.length, cursor: null } },
    { headers: { 'Cache-Control': 'private, max-age=0, must-revalidate' } },
  );
}

/** POST /api/orders */
export async function POST(request: NextRequest) {
  const session = await auth();
  const body: unknown = await request.json().catch(() => null);
  const parsed = CreateOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  // TODO: reserve stock with a Redis lock before inserting
  const order = await db.order.create({
    data: {
      customerId: session?.user?.id ?? null,
      currency: parsed.data.currency,
      lines: { create: parsed.data.lines },
    },
  });

  revalidateTag('orders');
  return NextResponse.json(order, {
    status: 201,
    headers: { Location: `/api/orders/${order.id}` },
  });
}
