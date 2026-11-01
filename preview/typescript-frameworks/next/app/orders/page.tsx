import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { OrderFilters } from './OrderFilters';
import { OrderTableSkeleton } from '@/components/skeletons';

type OrderStatus = 'pending' | 'paid' | 'shipped' | 'cancelled';

interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  totalCents: number;
  placedAt: string | null;
}

type PageProps = {
  searchParams: Promise<{ status?: OrderStatus; page?: string }>;
};

const API_URL = process.env.ORDERS_API_URL ?? 'http://localhost:4000';

async function getOrders(status?: OrderStatus, page = 1): Promise<Order[]> {
  const qs = new URLSearchParams({ page: String(page), ...(status && { status }) });
  const res = await fetch(`${API_URL}/orders?${qs}`, {
    next: { revalidate: 60, tags: ['orders'] },
    headers: { Accept: 'application/json' },
  });

  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`Failed to load orders: ${res.status} ${res.statusText}`);
  return res.json() as Promise<Order[]>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { status } = await searchParams;
  return {
    title: status ? `Orders – ${status}` : 'All orders',
    robots: { index: false, follow: false },
  };
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Server component: streams the table while filters render immediately. */
async function OrderTable({ status, page }: { status?: OrderStatus; page: number }) {
  const orders = await getOrders(status, page);
  // TODO: add cursor-based pagination once the API supports it
  return (
    <table className="orders">
      <tbody>
        {orders.map((o) => (
          <tr key={o.id} data-status={o.status}>
            <td><Link href={`/orders/${o.id}`}>#{o.number}</Link></td>
            <td>{money.format(o.totalCents / 100)}</td>
            <td>{o.placedAt ? new Date(o.placedAt).toLocaleDateString() : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function OrdersPage({ searchParams }: PageProps) {
  const { status, page = '1' } = await searchParams;
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1>Orders</h1>
      <OrderFilters<OrderStatus> options={['pending', 'paid', 'shipped']} value={status ?? null} />
      <Suspense key={`${status}-${page}`} fallback={<OrderTableSkeleton rows={8} />}>
        <OrderTable status={status} page={Number(page)} />
      </Suspense>
    </main>
  );
}
