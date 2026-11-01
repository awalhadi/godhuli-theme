---
title: "Pricing & Tax Calculation"
description: How Godhuli Shop computes order totals, VAT, and discounts.
date: 2026-10-30
draft: false
weight: 20
tags:
  - pricing
  - tax
  - checkout
authors: [nusrat, arif]
---

# Pricing & Tax Calculation

Every order total is computed server-side. The client **never** sends a final
price; it only sends SKUs and quantities.

## Formula

For an order with line items $i = 1 \dots n$, unit price $p_i$ and quantity
$q_i$, the subtotal is $S = \sum_i p_i q_i$. The final total applies a discount
rate $d$ and VAT rate $\tau$:

$$
T = \left( \sum_{i=1}^{n} p_i \, q_i \right) (1 - d)(1 + \tau), \qquad 0 \le d < 1
$$

With the default $\tau = 0.075$, a ৳1,000 subtotal with a 10% coupon yields
$T = 1000 \times 0.9 \times 1.075 = 967.50$.

## Rounding

Totals are rounded **half-even** to two decimals:

```python
from decimal import Decimal, ROUND_HALF_EVEN

def total(subtotal: Decimal, discount: Decimal, vat: Decimal = Decimal("0.075")) -> Decimal:
    raw = subtotal * (1 - discount) * (1 + vat)
    return raw.quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)
```

### Edge cases

- Free items ($p_i = 0$) are still listed on the invoice.
- Coupons cannot push the total below zero: $T \ge 0$.

> See also: [Refunds](./refunds.md) and [Currencies](./currencies.md).
