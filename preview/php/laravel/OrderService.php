<?php

namespace App\Services;

use App\Events\OrderPlaced;
use App\Exceptions\InsufficientStockException;
use App\Models\Order;
use App\Models\OrderItem;
use App\Payments\PaymentGateway;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Support\Collection;
use Psr\Log\LoggerInterface;

final class OrderService
{
    private const float TAX_RATE = 0.075;

    public function __construct(
        private readonly PaymentGateway $gateway,
        private readonly Dispatcher $events,
        private readonly LoggerInterface $logger,
        private bool $dryRun = false,
    ) {}

    /**
     * Compute totals, charge the customer and broadcast the event.
     *
     * @throws InsufficientStockException
     */
    public function finalize(Order $order): Order
    {
        /** @var Collection<int, OrderItem> $items */
        $items = $order->items;

        $outOfStock = $items->filter(fn (OrderItem $i) => $i->quantity > $i->product->stock);
        if ($outOfStock->isNotEmpty()) {
            throw new InsufficientStockException($outOfStock->pluck('product.sku')->all());
        }

        $subtotal = $items
            ->map(fn (OrderItem $i): int => $i->unit_price_minor * $i->quantity)
            ->reject(fn (int $line) => $line <= 0)
            ->sum();

        $tax = (int) round($subtotal * self::TAX_RATE);

        $order->forceFill([
            'number' => sprintf('ORD-%s-%05d', now()->format('Ymd'), $order->id),
            'total_minor' => $subtotal + $tax,
        ])->save();

        if (!$this->dryRun) {
            $this->gateway->charge($order->customer, amount: $order->total_minor, meta: [
                'order_id' => $order->id,
                'tags' => ['web', $order->is_gift ? 'gift' : null],
            ]);
        }

        $this->events->dispatch(new OrderPlaced($order));
        $this->logger->info("Order {$order->number} finalized\t(total={$order->total_minor})");

        return $order;
    }

    public function refund(Order $order, bool $notify = false): void
    {
        // FIXME: partial refunds are silently treated as full refunds
        $this->gateway->refund($order->payment_reference, $order->total_minor);
        $notify && $order->customer->notify(new \App\Notifications\OrderRefunded($order));
    }
}
