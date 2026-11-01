<?php

namespace App\Models;

use App\Enums\OrderStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property string $number
 * @property int $total_minor
 * @property OrderStatus $status
 * @property-read string $formatted_total
 */
class Order extends Model
{
    use HasFactory, SoftDeletes;

    /** @var list<string> */
    protected $fillable = [
        'number',
        'status',
        'currency',
        'total_minor',
        'shipping_address',
        'placed_at',
    ];

    protected $attributes = ['status' => 'pending', 'currency' => 'usd'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => OrderStatus::class,
            'shipping_address' => 'array',
            'placed_at' => 'immutable_datetime',
            'is_gift' => 'boolean',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    /** @return HasMany<OrderItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class)->orderBy('position');
    }

    public function scopePlacedBetween(Builder $query, string $from, ?string $to = null): void
    {
        $query->whereBetween('placed_at', [$from, $to ?? now()->toDateString()]);
    }

    // TODO: move currency formatting into the Money value object
    protected function formattedTotal(): Attribute
    {
        return Attribute::make(
            get: fn (mixed $value, array $attrs) => sprintf(
                '%s %s',
                strtoupper($attrs['currency']),
                number_format($attrs['total_minor'] / 100, 2),
            ),
        );
    }

    public function isShipped(): bool
    {
        return $this->status === OrderStatus::Shipped;
    }
}
