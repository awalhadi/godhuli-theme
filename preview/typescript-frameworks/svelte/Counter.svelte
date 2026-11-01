<script lang="ts">
  import { fade } from 'svelte/transition';

  interface Props {
    sku: string;
    stock?: number;
    min?: number;
    onchange?: (qty: number) => void;
  }

  let { sku, stock = 10, min = 1, onchange }: Props = $props();

  let quantity = $state(min);
  let history = $state<number[]>([]);

  const remaining = $derived(stock - quantity);
  const lowStock = $derived(remaining > 0 && remaining <= 3);
  const label = $derived.by(() => (quantity === 1 ? '1 item' : `${quantity} items`));

  // TODO: debounce this once the cart API supports PATCH
  $effect(() => {
    onchange?.(quantity);
    console.debug(`[qty] ${sku} -> ${quantity}`);
  });

  function step(delta: number) {
    const next = Math.min(Math.max(quantity + delta, min), stock);
    if (next !== quantity) {
      history = [...history.slice(-4), quantity];
      quantity = next;
    }
  }
</script>

<div class="counter" class:low={lowStock} data-sku={sku}>
  <button onclick={() => step(-1)} disabled={quantity <= min} aria-label="Decrease">&minus;</button>
  <output aria-live="polite">{label}</output>
  <button onclick={() => step(+1)} disabled={quantity >= stock} aria-label="Increase">+</button>

  {#if remaining === 0}
    <p class="note" transition:fade>That&rsquo;s all we have!</p>
  {:else if lowStock}
    <p class="note">Only {remaining} left in stock</p>
  {/if}

  {#each history as prev, i (i)}
    <span class="chip">{prev}</span>
  {:else}
    <small>No changes yet</small>
  {/each}
</div>

<style>
  .counter {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    --accent: oklch(70% 0.15 60);
  }

  .counter.low output {
    color: var(--accent);
    font-weight: 600;
  }

  button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
