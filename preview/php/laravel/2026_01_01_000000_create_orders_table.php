<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('customer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('coupon_id')->nullable()->constrained()->nullOnDelete();
            $table->string('number', 32)->unique();
            $table->enum('status', ['pending', 'paid', 'shipped', 'cancelled'])->default('pending');
            $table->char('currency', 3)->default('usd');
            $table->unsignedBigInteger('total_minor')->default(0);
            $table->decimal('tax_rate', 5, 4)->default(0.0750);
            $table->json('shipping_address')->nullable();
            $table->boolean('is_gift')->default(false);
            $table->timestamp('placed_at')->nullable()->index();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['customer_id', 'status'], 'orders_customer_status_idx');
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->unsignedSmallInteger('position')->default(1);
            $table->unsignedInteger('quantity');
            $table->unsignedBigInteger('unit_price_minor');
            // TODO: snapshot product name/SKU so renamed products don't rewrite history
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
    }
};
