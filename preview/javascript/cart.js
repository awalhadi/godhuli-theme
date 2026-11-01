// @ts-check
import { formatMoney } from './money.js';

const SKU_PATTERN = /^(?<vendor>[A-Z]{3})-(?<code>\d{4,6})(?:-(?<variant>[a-z]+))?$/u;
const MAX_QTY = 99;

/** Tagged template that escapes interpolated values for safe HTML output. */
const html = (strings, ...values) =>
  strings.reduce((out, str, i) => {
    const v = String(values[i - 1] ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    return out + v + str;
  });

/**
 * A shopping cart keyed by SKU.
 * @template {{ sku: string, price: number, qty: number }} T
 */
export class Cart {
  static #instances = 0;
  static TAX_RATE;

  static {
    Cart.TAX_RATE = Number(globalThis.process?.env?.TAX_RATE ?? 0.075);
  }

  /** @type {Map<string, T>} */
  #lines = new Map();
  #currency;

  constructor({ currency = 'USD', lines = [] } = {}) {
    this.#currency = currency;
    lines.forEach((line) => this.add(line));
    Cart.#instances += 1;
  }

  /** @param {T} line */
  add({ sku, qty = 1, ...rest }) {
    const match = SKU_PATTERN.exec(sku);
    if (!match?.groups) throw new TypeError(`Invalid SKU: "${sku}"\n`);

    const { vendor, variant = null } = match.groups;
    const prev = this.#lines.get(sku)?.qty ?? 0;
    this.#lines.set(sku, { ...rest, sku, vendor, variant, qty: Math.min(prev + qty, MAX_QTY) });
    return this;
  }

  get subtotal() {
    return [...this.#lines.values()].reduce((sum, { price, qty }) => sum + price * qty, 0);
  }

  get isEmpty() {
    return this.#lines.size === 0;
  }

  *[Symbol.iterator]() {
    yield* this.#lines.values();
  }

  // TODO: batch stock lookups instead of one request per line
  async *checkStock(fetchStock) {
    for (const line of this) {
      const { available = 0 } = (await fetchStock(line.sku)) ?? {};
      yield { ...line, ok: available >= line.qty };
    }
  }

  toHTML() {
    const total = formatMoney(this.subtotal * (1 + Cart.TAX_RATE), this.#currency);
    return html`<p class="cart-total" data-items="${this.#lines.size}">Total: ${total}</p>`;
  }
}

const cart = new Cart({ lines: [{ sku: 'ACM-10423-red', price: 19.99, qty: 2 }] });
for await (const { sku, ok } of cart.checkStock(async () => ({ available: 1e3 }))) {
  console.info(`${sku}: ${ok ? 'in stock' : 'backordered'}`);
}
