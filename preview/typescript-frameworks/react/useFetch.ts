import { useCallback, useEffect, useReducer, useRef } from 'react';

export type FetchState<T, E = Error> =
  | { status: 'idle'; data: null; error: null }
  | { status: 'loading'; data: T | null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: T | null; error: E };

type Action<T> =
  | { type: 'start' }
  | { type: 'resolve'; payload: T }
  | { type: 'reject'; error: Error };

interface UseFetchOptions<T> extends Omit<RequestInit, 'signal'> {
  enabled?: boolean;
  parse?: (res: Response) => Promise<T>;
}

function reducer<T>(state: FetchState<T>, action: Action<T>): FetchState<T> {
  switch (action.type) {
    case 'start':
      return { status: 'loading', data: state.data, error: null };
    case 'resolve':
      return { status: 'success', data: action.payload, error: null };
    case 'reject':
      return { status: 'error', data: state.data, error: action.error };
    default: {
      const _exhaustive: never = action;
      return state;
    }
  }
}

const initial: FetchState<never> = { status: 'idle', data: null, error: null };

/**
 * Fetches JSON and cancels in-flight requests when the URL changes.
 *
 * @example const { data, status } = useFetch<Order[]>(`/api/orders?page=${page}`);
 */
export function useFetch<T = unknown>(url: string | null, options: UseFetchOptions<T> = {}) {
  const { enabled = true, parse = (r) => r.json() as Promise<T>, ...init } = options;
  const [state, dispatch] = useReducer(reducer<T>, initial as FetchState<T>);
  const controllerRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    if (!url) return;
    controllerRef.current?.abort();
    const controller = (controllerRef.current = new AbortController());

    dispatch({ type: 'start' });
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      dispatch({ type: 'resolve', payload: await parse(res) });
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return;
      dispatch({ type: 'reject', error: err instanceof Error ? err : new Error(String(err)) });
    }
    // FIXME: `init` is a new object every render; memoise or serialise it
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (enabled) void run();
    return () => controllerRef.current?.abort();
  }, [enabled, run]);

  return { ...state, refetch: run, isLoading: state.status === 'loading' } as const;
}
