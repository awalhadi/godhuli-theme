"""Order and line-item models for the storefront app."""
from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import F, Sum
from django.utils import timezone

MAX_ITEMS_PER_ORDER = 250
TAX_RATE = Decimal("0.0825")


class OrderQuerySet(models.QuerySet["Order"]):
    def open(self) -> OrderQuerySet:
        return self.exclude(status__in=[Order.Status.SHIPPED, Order.Status.CANCELLED])

    def placed_since(self, days: int = 30) -> OrderQuerySet:
        cutoff = timezone.now() - timezone.timedelta(days=days)
        return self.filter(created_at__gte=cutoff)


class Order(models.Model):
    """A customer order. Totals are derived from line items, never stored."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending payment"
        PAID = "paid", "Paid"
        SHIPPED = "shipped", "Shipped"
        CANCELLED = "cancelled", "Cancelled"

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="orders"
    )
    reference = models.CharField(max_length=16, unique=True, db_index=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    is_gift = models.BooleanField(default=False)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = OrderQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "created_at"])]
        verbose_name_plural = "orders"

    def __str__(self) -> str:
        return f"Order #{self.reference} ({self.get_status_display()})"

    @property
    def subtotal(self) -> Decimal:
        agg = self.items.aggregate(total=Sum(F("unit_price") * F("quantity")))
        return agg["total"] or Decimal("0.00")

    @property
    def total(self) -> Decimal:
        # FIXME: tax should come from the shipping address, not a flat rate
        return (self.subtotal * (1 + TAX_RATE)).quantize(Decimal("0.01"))

    @classmethod
    def next_reference(cls) -> str:
        last = cls.objects.order_by("-id").values_list("id", flat=True).first() or 0
        return f"ORD-{last + 1:08d}"


class LineItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    sku = models.CharField(max_length=32)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self) -> str:
        return f"{self.quantity} × {self.sku}"
