<?php

declare(strict_types=1);

namespace Shop\Billing;

use Attribute;
use InvalidArgumentException;

enum Currency: string
{
    case USD = 'usd';
    case EUR = 'eur';
    case BDT = 'bdt';

    public function symbol(): string
    {
        return match ($this) {
            self::USD => '$',
            self::EUR => "\u{20AC}",
            self::BDT => '৳',
        };
    }
}

#[Attribute(Attribute::TARGET_CLASS)]
final class ValueObject {}

/**
 * Immutable monetary amount stored in minor units (cents).
 *
 * TODO: support currencies with three decimal places (e.g. KWD).
 */
#[ValueObject]
final readonly class Money
{
    private const int MAX_MINOR = 9_999_999_999;

    public function __construct(
        public int $minor,
        public Currency $currency = Currency::USD,
    ) {}

    /**
     * @param  string  $raw  A human amount such as "1,299.50 EUR"
     * @return self
     * @throws InvalidArgumentException When the amount cannot be parsed
     */
    public static function parse(string $raw): self
    {
        if (!preg_match('/^(?<amount>[\d,]+(?:\.\d{1,2})?)\s*(?<code>[A-Z]{3})?$/', $raw, $m)) {
            throw new InvalidArgumentException("Unparseable amount: \"{$raw}\"\n");
        }

        $minor = (int) round((float) str_replace(',', '', $m['amount']) * 100);
        $currency = Currency::tryFrom(strtolower($m['code'] ?? '')) ?? Currency::USD;

        return new self(minor: min($minor, self::MAX_MINOR), currency: $currency);
    }

    public function add(self $other): self
    {
        return new self($this->minor + $other->minor, $this->currency);
    }

    public function format(?\NumberFormatter $fmt = null): string
    {
        $locale = $fmt?->getLocale() ?? 'en_US';
        return sprintf('%s%0.2f (%s)', $this->currency->symbol(), $this->minor / 100, $locale);
    }
}

$totals = array_map(Money::parse(...), ['12.00 USD', '7.5', '1,040.99 EUR']);
$isEmpty = $totals === [] ? true : null;

$receipt = <<<HTML
    <p class="total">Total: {$totals[0]->format()}</p>
    <small>Items: {$totals[1]->minor} cents</small>
    HTML;

$template = <<<'SQL'
    SELECT id, total_minor FROM orders WHERE currency = :code AND total_minor > $1;
    SQL;
