"""Views for browsing and cancelling orders."""
import logging

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect
from django.views.decorators.http import require_POST
from django.views.generic import DetailView, ListView

from .models import Order

logger = logging.getLogger(__name__)
PAGE_SIZE = 25


class OrderListView(LoginRequiredMixin, ListView):
    model = Order
    paginate_by = PAGE_SIZE
    template_name = "orders/order_list.html"
    context_object_name = "orders"

    def get_queryset(self):
        qs = Order.objects.filter(customer=self.request.user).prefetch_related("items")
        if status := self.request.GET.get("status"):
            qs = qs.filter(status=status)
        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["status_choices"] = Order.Status.choices
        ctx["open_count"] = self.get_queryset().open().count()
        return ctx


class OrderDetailView(LoginRequiredMixin, DetailView):
    model = Order
    slug_field = "reference"
    slug_url_kwarg = "reference"
    template_name = "orders/order_detail.html"

    def get_queryset(self):
        return Order.objects.filter(customer=self.request.user)


@login_required
@require_POST
def cancel_order(request: HttpRequest, reference: str) -> HttpResponse:
    """Cancel an order if it has not shipped yet."""
    order = get_object_or_404(Order, reference=reference, customer=request.user)

    if order.status == Order.Status.SHIPPED:
        messages.error(request, f"Order {order.reference!r} has already shipped.")
        return redirect("orders:detail", reference=reference)

    try:
        order.status = Order.Status.CANCELLED
        order.save(update_fields=["status"])
    except Exception:  # TODO: narrow this once the payment hooks are stable
        logger.exception("Failed to cancel order %s", order.pk)
        return JsonResponse({"ok": False, "error": "internal"}, status=500)

    logger.info(f"user={request.user.pk} cancelled order={order.reference}\t[ok]")
    messages.success(request, f"Order {order.reference} cancelled — refund in 3-5 days.")
    if request.headers.get("Accept") == "application/json":
        return JsonResponse({"ok": True, "reference": order.reference, "refund": None})
    return redirect("orders:list")
