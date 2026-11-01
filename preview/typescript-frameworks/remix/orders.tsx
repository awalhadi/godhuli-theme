import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { Form, Link, useLoaderData, useNavigation, useSearchParams } from '@remix-run/react';
import { requireUserId } from '~/session.server';
import { cancelOrder, listOrders, type OrderSummary } from '~/models/order.server';

const PAGE_SIZE = 20;

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const status = url.searchParams.get('status') as OrderSummary['status'] | null;

  const { orders, total } = await listOrders({ userId, status, page, take: PAGE_SIZE });

  return json(
    { orders, total, page, hasMore: page * PAGE_SIZE < total },
    { headers: { 'Cache-Control': 'private, max-age=30' } },
  );
}

/**
 * Handles the inline "cancel" form for each row.
 * FIXME: return field errors instead of throwing a 400 response.
 */
export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const form = await request.formData();
  const intent = form.get('intent');
  const orderId = String(form.get('orderId') ?? '');

  if (intent !== 'cancel' || !/^c[a-z0-9]{24}$/.test(orderId)) {
    throw json({ message: `Unsupported intent: ${intent}` }, { status: 400 });
  }

  await cancelOrder({ userId, orderId });
  return redirect(`/orders?cancelled=${encodeURIComponent(orderId)}`);
}

export default function OrdersRoute() {
  const { orders, page, hasMore } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [params] = useSearchParams();
  const cancelledId = params.get('cancelled');

  return (
    <main>
      <h1>Your orders</h1>
      {cancelledId && <p role="alert">Order {cancelledId} was cancelled.</p>}

      <ul className={navigation.state === 'loading' ? 'opacity-50' : undefined}>
        {orders.map((order) => (
          <li key={order.id}>
            <Link to={order.id} prefetch="intent">#{order.number}</Link> — {order.status}
            {order.status === 'pending' && (
              <Form method="post" replace>
                <input type="hidden" name="orderId" value={order.id} />
                <button name="intent" value="cancel" disabled={navigation.state !== 'idle'}>
                  Cancel
                </button>
              </Form>
            )}
          </li>
        ))}
      </ul>

      {/* TODO: switch to infinite scroll with useFetcher */}
      {hasMore ? <Link to={`?page=${page + 1}`}>Load more &rarr;</Link> : null}
    </main>
  );
}
