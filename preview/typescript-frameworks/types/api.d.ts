/**
 * Ambient types for the Orders REST API.
 * TODO: generate this file from the OpenAPI spec instead of maintaining it by hand.
 */

declare const enum OrderStatus {
  Pending = 'pending',
  Paid = 'paid',
  Shipped = 'shipped',
  Cancelled = 'cancelled',
}

declare enum HttpCode {
  Ok = 200,
  Created = 201,
  NotFound = 404,
  Unprocessable = 0x1a6,
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
type Endpoint = `/${'orders' | 'products' | 'customers'}${'' | `/${string}`}`;
type EventName<T extends string> = `${T}:${'created' | 'updated' | 'deleted'}`;

/** Unwraps Promise<T> and arrays recursively. */
type Awaited2<T> = T extends PromiseLike<infer U> ? Awaited2<U> : T;
type ElementOf<T> = T extends readonly (infer E)[] ? E : never;
type Params<P extends string> = P extends `${string}:${infer K}/${infer Rest}`
  ? { [key in K | keyof Params<Rest>]: string }
  : P extends `${string}:${infer K}`
    ? Record<K, string>
    : {};

type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};
type Mutable<T> = { -readonly [K in keyof T]-?: T[K] };
type Getters<T> = { [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K] };

declare namespace Api {
  interface Money {
    readonly amount: number;
    readonly currency: 'usd' | 'eur' | 'bdt';
  }

  interface Order {
    id: string;
    number: `ORD-${number}`;
    status: OrderStatus;
    total: Money;
    lines: ReadonlyArray<{ sku: string; quantity: number }>;
    placedAt: string | null;
    meta?: Record<string, unknown>;
  }

  namespace Responses {
    type Page<T> = { data: T[]; meta: { total: number; cursor: string | null } };
    type Error = { error: string; code: HttpCode; fields?: Partial<Record<string, string[]>> };
  }
}

declare abstract class Resource<T extends { id: string }> {
  protected constructor(baseUrl: Endpoint);
  abstract readonly name: string;
  list(query?: Partial<T>): Promise<Api.Responses.Page<T>>;
  get(id: T['id']): Promise<T>;
  get(ids: T['id'][]): Promise<T[]>;
  on<E extends EventName<this['name']>>(event: E, cb: (payload: T) => void): () => void;
}

declare function request<M extends HttpMethod, P extends Endpoint>(
  method: M,
  path: P,
  body?: M extends 'GET' | 'DELETE' ? never : unknown,
): Promise<Api.Responses.Page<Api.Order> | Api.Responses.Error>;

declare module '@shop/sdk' {
  export const VERSION: string;
  export function createClient(opts: { token: string; retries?: number }): {
    orders: Resource<Api.Order>;
  };
  export type { Getters, DeepReadonly, Params };
}

declare global {
  interface Window {
    __SHOP_STATE__?: DeepReadonly<{ cart: Api.Order['lines']; user: null | { id: string } }>;
  }
}

export {};
