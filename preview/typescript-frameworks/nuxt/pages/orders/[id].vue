<script setup lang="ts">
import type { Order } from '~/types/order';

definePageMeta({
  layout: 'account',
  middleware: ['auth'],
  validate: (route) => /^[0-9a-f-]{36}$/i.test(String(route.params.id)),
});

const route = useRoute();
const config = useRuntimeConfig();
const id = computed(() => route.params.id as string);

const { data: order, status, error, refresh } = await useFetch<Order>(
  () => `/api/orders/${id.value}`,
  {
    baseURL: config.public.apiBase,
    key: `order-${id.value}`,
    headers: useRequestHeaders(['cookie']),
    transform: (o) => ({ ...o, placedAt: o.placedAt ? new Date(o.placedAt) : null }),
  },
);

if (error.value?.statusCode === 404) {
  throw createError({ statusCode: 404, statusMessage: 'Order not found', fatal: true });
}

useSeoMeta({
  title: () => (order.value ? `Order #${order.value.number}` : 'Order'),
  robots: 'noindex, nofollow',
});

const isCancellable = computed(() => order.value?.status === 'pending' && !order.value.isGift);

// FIXME: optimistic update leaves stale data if the request fails
async function cancel() {
  await $fetch(`/api/orders/${id.value}/cancel`, { method: 'POST', body: { reason: null } });
  await refresh();
}
</script>

<template>
  <section v-if="status === 'pending'" class="skeleton" aria-busy="true" />
  <article v-else-if="order" class="order">
    <h1>Order #{{ order.number }}</h1>
    <p>Placed {{ order.placedAt?.toLocaleDateString() ?? '—' }} &middot; {{ order.status }}</p>

    <ul>
      <li v-for="line in order.lines" :key="line.sku">
        {{ line.quantity }} &times; <NuxtLink :to="`/products/${line.sku}`">{{ line.name }}</NuxtLink>
      </li>
    </ul>

    <UButton v-if="isCancellable" color="red" variant="soft" @click="cancel">Cancel order</UButton>
  </article>
</template>
