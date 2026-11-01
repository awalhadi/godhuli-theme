import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

export interface CartLine {
  sku: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

interface CartContextValue<L extends CartLine = CartLine> {
  lines: readonly L[];
  itemCount: number;
  subtotal: number;
  add: (line: L) => void;
  remove: (sku: L['sku']) => void;
  clear: () => void;
}

const SHIPPING = {
  freeThreshold: 75,
  flatRate: 6.5,
  regions: ['US', 'CA', 'BD'],
} satisfies { freeThreshold: number; flatRate: number; regions: string[] };

const CartContext = createContext<CartContextValue | null>(null);

/** Provides cart state to the storefront. TODO: persist to localStorage. */
export function CartProvider({ children, initial = [] }: PropsWithChildren<{ initial?: CartLine[] }>) {
  const [lines, setLines] = useState<CartLine[]>(initial);

  const add = useCallback((line: CartLine) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.sku === line.sku);
      return existing
        ? prev.map((l) => (l.sku === line.sku ? { ...l, quantity: l.quantity + line.quantity } : l))
        : [...prev, line];
    });
  }, []);

  const remove = useCallback((sku: string) => {
    setLines((prev) => prev.filter((l) => l.sku !== sku));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo(() => {
    const subtotal = lines.reduce((sum, { unitPrice, quantity }) => sum + unitPrice * quantity, 0);
    return {
      lines,
      subtotal: subtotal >= SHIPPING.freeThreshold ? subtotal : subtotal + SHIPPING.flatRate,
      itemCount: lines.reduce((n, l) => n + l.quantity, 0),
      add,
      remove,
      clear,
    } satisfies CartContextValue;
  }, [lines, add, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart<L extends CartLine = CartLine>(): CartContextValue<L> {
  const ctx = useContext(CartContext);
  if (ctx === null) {
    throw new Error('useCart() must be used inside <CartProvider>');
  }
  return ctx as unknown as CartContextValue<L>;
}
