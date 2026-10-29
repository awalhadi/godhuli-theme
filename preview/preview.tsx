/**
 * Godhuli stress sample — TSX.
 * Check: types ≠ functions ≠ variables ≠ strings at a glance; JSX component vs HTML tag vs string;
 * interpolation pops out of the string body; regex has internal hierarchy; control flow outranks `const`.
 *
 * @param props - the order panel props
 * @returns {JSX.Element} rendered panel
 * @deprecated use <OrderPanelV2 /> — strikethrough via semantic `*.deprecated`
 */
import { useMemo, useState, type ReactNode } from 'react';
import * as api from './api';

// TODO: move to shared/types  — accent italic bold, not a shout
export interface Order<TItem extends { sku: string } = LineItem> {
  readonly id: `ord_${string}`;
  items: ReadonlyArray<TItem>;
  status: OrderStatus;
  placedAt?: Date | null;
}

type LineItem = { sku: string; qty: number; price: number };

export enum OrderStatus {
  Pending = 'pending',
  Shipped = 'shipped',
  Refunded = 0x1f,
}

const SKU_PATTERN = /^(?<prefix>[A-Z]{2,3})-(\d{4,})(?:\.v\d+)?$/giu;
const MAX_RETRIES = 3;
const TAX_RATE = 0.0825;

@sealed
class OrderService<T extends Order> {
  static #instances = 0;
  private cache = new Map<string, T>();

  constructor(private readonly client: typeof api, public label = 'orders') {
    OrderService.#instances++;
  }

  async fetch(id: T['id'], signal?: AbortSignal): Promise<T | undefined> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        if (this.cache.has(id)) return this.cache.get(id);
        const order = (await this.client.get(`/orders/${id}?attempt=${attempt + 1}`, { signal })) as T;
        this.cache.set(id, order);
        return order;
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        console.warn(`retry ${attempt}/${MAX_RETRIES}:`, (error as Error).message);
      }
    }
    return undefined;
  }
}

function sealed(constructor: Function): void {
  Object.seal(constructor);
  Object.seal(constructor.prototype);
}

export const total = (items: readonly LineItem[]): number =>
  items.reduce((sum, { qty, price }) => sum + qty * price, 0) * (1 + TAX_RATE);

function* paginate<T>(rows: T[], size = 20): Generator<T[], void, unknown> {
  for (let i = 0; i < rows.length; i += size) yield rows.slice(i, i + size);
}

interface PanelProps {
  order: Order;
  onRefund?: (id: string, reason: string) => Promise<void>;
  children?: ReactNode;
}

export function OrderPanel({ order, onRefund, children }: PanelProps) {
  const [open, setOpen] = useState<boolean>(false);
  const amount = useMemo(() => total(order.items as LineItem[]), [order.items]);
  const valid = order.items.every((item) => SKU_PATTERN.test(item.sku));

  if (!valid) return <ErrorBanner message="Invalid SKU" code={422} />;

  return (
    <section className="order-panel" data-status={order.status} aria-expanded={open}>
      <header onClick={() => setOpen((v) => !v)}>
        <h2>Order {order.id}</h2>
        <Badge tone={order.status === OrderStatus.Shipped ? 'ok' : 'pending'}>
          {order.status.toUpperCase()}
        </Badge>
      </header>
      {open && (
        <ul>
          {order.items.map(({ sku, qty }) => (
            <li key={sku}>
              {sku} &times; {qty}
            </li>
          ))}
        </ul>
      )}
      <p>
        Total: <strong>{amount.toFixed(2)}</strong> &mdash; placed {order.placedAt?.toLocaleDateString() ?? 'n/a'}
      </p>
      <button disabled={!onRefund} onClick={() => void onRefund?.(order.id, 'customer request')}>
        Refund
      </button>
      {children}
    </section>
  );
}

declare function Badge(props: { tone: 'ok' | 'pending'; children: ReactNode }): JSX.Element;
declare function ErrorBanner(props: { message: string; code: number }): JSX.Element;

// Deliberate errors for diagnostics colors (squiggle + undercurl), unexpected bracket:
const broken: number = 'not a number';
const unmatched = [1, 2, 3)];
