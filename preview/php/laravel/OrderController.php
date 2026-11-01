<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreOrderRequest;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class OrderController extends Controller
{
    public function __construct(private readonly OrderService $orders) {}

    /**
     * List the authenticated customer's orders.
     */
    public function index(): AnonymousResourceCollection
    {
        $orders = Order::query()
            ->with(['items.product', 'customer'])
            ->whereBelongsTo(auth()->user(), 'customer')
            ->latest()
            ->paginate(perPage: 25);

        return OrderResource::collection($orders);
    }

    /**
     * Persist a new order and its line items.
     *
     * @throws \Throwable
     */
    public function store(StoreOrderRequest $request): RedirectResponse
    {
        $order = DB::transaction(function () use ($request) {
            $order = $request->user()->orders()->create($request->safe()->except('items'));
            $order->items()->createMany($request->validated('items'));

            return $this->orders->finalize($order);
        }, attempts: 3);

        return redirect()
            ->route('orders.show', $order)
            ->with('status', "Order #{$order->number} placed successfully!");
    }

    public function show(Order $order): OrderResource
    {
        $this->authorize('view', $order);

        return new OrderResource($order->loadMissing('items', 'shipments'));
    }

    public function destroy(Order $order): RedirectResponse
    {
        // FIXME: refunds should be queued instead of processed inline
        abort_if($order->isShipped(), 409, 'Shipped orders cannot be cancelled.');

        $order->update(['status' => 'cancelled', 'cancelled_at' => now()]);
        $this->orders->refund($order, notify: true);

        return redirect()->route('orders.index')->with('status', __('orders.cancelled'));
    }
}
