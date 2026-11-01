'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition, type ChangeEvent } from 'react';

interface OrderFiltersProps<T extends string> {
  options: readonly T[];
  value: T | null;
  label?: string;
  onChange?: (next: T | null) => void;
}

const DEBOUNCE_MS = 300;

/**
 * Status + free-text filters that sync to the URL query string.
 * FIXME: debounce timer is not cleared on unmount.
 */
export function OrderFilters<T extends string>({
  options,
  value,
  label = 'Status',
  onChange,
}: OrderFiltersProps<T>) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState<string>(params.get('q') ?? '');
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const push = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, val] of Object.entries(patch)) {
      val === null || val === '' ? next.delete(key) : next.set(key, val);
    }
    next.delete('page');
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  const handleStatus = (e: ChangeEvent<HTMLSelectElement>) => {
    const selected = (e.target.value || null) as T | null;
    onChange?.(selected);
    push({ status: selected });
  };

  const handleQuery = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\w\s#-]/g, '');
    setQuery(raw);
    if (timer) clearTimeout(timer);
    setTimer(setTimeout(() => push({ q: raw.trim() }), DEBOUNCE_MS));
  };

  return (
    <form role="search" className="filters" aria-busy={isPending} onSubmit={(e) => e.preventDefault()}>
      <label>
        {label}
        <select value={value ?? ''} onChange={handleStatus} disabled={isPending}>
          <option value="">All</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt[0].toUpperCase() + opt.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <input type="search" placeholder="Order # or email" value={query} onChange={handleQuery} />
      {isPending && <span className="spinner" aria-label="Loading" />}
    </form>
  );
}
