@props(['orders', 'filters' => [], 'highlight' => null])

{{-- Customer order history; rendered inside the account layout --}}
<x-layout title="My orders" :breadcrumbs="['Account' => route('home'), 'Orders' => null]">
    <x-slot:header>
        <h1 class="text-2xl font-semibold">{{ __('Your orders') }} ({{ $orders->total() }})</h1>
    </x-slot:header>

    @if (session('status'))
        <x-alert type="success" dismissible>{{ session('status') }}</x-alert>
    @endif

    <div x-data="{ open: null, compact: false }" class="space-y-4">
        <button type="button" @click="compact = !compact" :class="{ 'btn-active': compact }">
            Toggle compact view
        </button>

        @forelse ($orders as $order)
            <article
                wire:key="order-{{ $order->id }}"
                @class(['card', 'card--highlight' => $order->is($highlight)])
                :class="compact && 'card--compact'"
            >
                <header @click="open = open === {{ $order->id }} ? null : {{ $order->id }}">
                    <strong>#{{ $order->number }}</strong>
                    <span class="badge badge-{{ $order->status->value }}">
                        {{ ucfirst($order->status->value) }}
                    </span>
                    <time datetime="{{ $order->placed_at?->toIso8601String() }}">
                        {{ $order->placed_at?->diffForHumans() ?? 'Draft' }}
                    </time>
                </header>

                <ul x-show="open === {{ $order->id }}" x-transition>
                    @foreach ($order->items as $item)
                        <li>
                            {{ $item->quantity }} &times; {{ $item->product->name }}
                            @if ($loop->last) <hr> @endif
                        </li>
                    @endforeach
                </ul>

                {{-- Notes may contain trusted, pre-sanitised HTML --}}
                {!! $order->notes_html !!}

                <footer>
                    <span>{{ $order->formatted_total }}</span>
                    @can('delete', $order)
                        <form method="POST" action="{{ route('orders.destroy', $order) }}"
                              onsubmit="return confirm('Cancel order #{{ $order->number }}?')">
                            @csrf
                            @method('DELETE')
                            <button type="submit" class="btn-danger">Cancel</button>
                        </form>
                    @endcan
                </footer>
            </article>
        @empty
            <p class="empty">No orders yet. <a href="{{ route('home') }}">Start shopping &rarr;</a></p>
        @endforelse
    </div>

    {{ $orders->withQueryString()->links() }}

    @push('scripts')
        <script>window.ordersMeta = @json(['count' => $orders->count(), 'filters' => $filters]);</script>
    @endpush
</x-layout>
