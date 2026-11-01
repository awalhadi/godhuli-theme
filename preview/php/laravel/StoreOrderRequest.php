<?php

namespace App\Http\Requests;

use App\Enums\ShippingMethod;
use App\Models\Product;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Enum;

class StoreOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', \App\Models\Order::class) ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'currency' => ['required', Rule::in(['usd', 'eur', 'bdt'])],
            'shipping_method' => ['required', new Enum(ShippingMethod::class)],
            'coupon' => ['nullable', 'string', 'regex:/^[A-Z0-9]{4,12}$/'],
            'shipping_address.line1' => 'required|string|max:120',
            'shipping_address.postcode' => ['required', 'regex:/^\d{4,6}(-\d{4})?$/'],
            'shipping_address.country' => ['required', 'size:2'],
            'is_gift' => ['boolean'],
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.product_id' => [
                'required',
                Rule::exists('products', 'id')->where('is_active', true),
            ],
            'items.*.quantity' => [
                'required',
                'integer',
                'between:1,99',
                function (string $attribute, mixed $value, Closure $fail): void {
                    $index = (int) explode('.', $attribute)[1];
                    $product = Product::find($this->input("items.{$index}.product_id"));

                    if ($product !== null && $value > $product->stock) {
                        $fail("Only {$product->stock} units of \"{$product->name}\" left.");
                    }
                },
            ],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        // TODO: move to lang/en/validation.php
        return [
            'items.min' => 'Your cart is empty.',
            'coupon.regex' => 'Coupon codes are 4–12 uppercase letters or digits.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['coupon' => strtoupper(trim((string) $this->coupon)) ?: null]);
    }
}
