<script setup lang="ts" generic="T extends { id: string; number: string; total: number }">
import { computed, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    rows: T[];
    currency?: string;
    pageSize?: number;
    loading?: boolean;
  }>(),
  { currency: 'USD', pageSize: 10, loading: false },
);

const emit = defineEmits<{
  select: [row: T];
  'update:page': [page: number];
}>();

defineSlots<{
  actions?: (props: { row: T }) => unknown;
  empty?: () => unknown;
}>();

const search = ref('');
const page = ref(1);
const sortDesc = ref(true);

// TODO: move formatting into a shared composable (useMoney)
const fmt = computed(() => new Intl.NumberFormat('en', { style: 'currency', currency: props.currency }));

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase();
  return props.rows
    .filter((r) => r.number.toLowerCase().includes(term))
    .toSorted((a, b) => (sortDesc.value ? b.total - a.total : a.total - b.total));
});

const paged = computed(() =>
  filtered.value.slice((page.value - 1) * props.pageSize, page.value * props.pageSize),
);

watch(search, () => (page.value = 1));
watch(page, (p) => emit('update:page', p), { immediate: false });
</script>

<template>
  <div class="order-table" :class="{ 'is-loading': loading }">
    <input v-model.trim="search" type="search" placeholder="Filter by order #" />
    <button type="button" @click="sortDesc = !sortDesc">Total {{ sortDesc ? '↓' : '↑' }}</button>

    <table v-if="paged.length">
      <tr v-for="(row, i) in paged" :key="row.id" :data-index="i" @click="emit('select', row)">
        <td>#{{ row.number }}</td>
        <td class="num">{{ fmt.format(row.total) }}</td>
        <td><slot name="actions" :row="row" /></td>
      </tr>
    </table>
    <slot v-else name="empty"><p class="muted">No orders found.</p></slot>

    <nav v-show="filtered.length > pageSize">
      <button :disabled="page === 1" @click.prevent="page--">Prev</button>
      <span>{{ page }} / {{ Math.ceil(filtered.length / pageSize) }}</span>
      <button :disabled="page * pageSize >= filtered.length" @click.prevent="page++">Next</button>
    </nav>
  </div>
</template>

<style scoped lang="scss">
$accent: #d97706;

.order-table {
  display: grid;
  gap: 0.75rem;

  &.is-loading { opacity: 0.6; pointer-events: none; }

  tr:hover td { background: rgba($accent, 0.08); }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
}
</style>
