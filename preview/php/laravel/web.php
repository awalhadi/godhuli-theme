<?php

use App\Http\Controllers\CheckoutController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\Webhooks\StripeWebhookController;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

Route::view('/', 'welcome')->name('home');

Route::get('/health', fn () => response()->json(['ok' => true, 'version' => '2.4.1']));

Route::middleware(['auth', 'verified'])->group(function () {
    Route::resource('orders', OrderController::class)->only(['index', 'store', 'show', 'destroy']);

    Route::get('/orders/{order:number}/invoice', function (Order $order) {
        abort_unless(request()->user()->is($order->customer), 403);

        return response()->streamDownload(
            fn () => print(view('orders.invoice', compact('order'))->render()),
            "invoice-{$order->number}.html",
        );
    })->name('orders.invoice')->where('order', 'ORD-\d{8}-\d{5}');

    Route::prefix('checkout')->name('checkout.')->controller(CheckoutController::class)
        ->group(function () {
            Route::get('/', 'create')->name('create');
            Route::post('/', 'store')->name('store')->middleware('throttle:6,1');
            Route::get('/thanks/{order}', 'thanks')->name('thanks');
        });
});

// FIXME: move webhook routes to routes/api.php once CSRF exclusions are sorted
Route::post('/webhooks/stripe', StripeWebhookController::class)
    ->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class])
    ->name('webhooks.stripe');

Route::fallback(function (Request $request) {
    return $request->expectsJson()
        ? response()->json(['message' => 'Not Found.'], 404)
        : redirect()->route('home');
});
