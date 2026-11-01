"""Order lookup endpoints, mounted at /api/orders."""
from http import HTTPStatus

from flask import Blueprint, abort, current_app, jsonify, request
from werkzeug.exceptions import HTTPException

bp = Blueprint("orders", __name__, url_prefix="/api/orders")

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 0x64  # 100

_ORDERS = {
    "ORD-1001": {"id": "ORD-1001", "total": 42.50, "status": "paid", "gift": False},
    "ORD-1002": {"id": "ORD-1002", "total": 1_299.00, "status": "shipped", "gift": True},
}


class OrderNotFound(Exception):
    def __init__(self, order_id: str) -> None:
        super().__init__(f"order {order_id!r} not found")
        self.order_id = order_id


@bp.get("/")
def list_orders():
    """Return a page of orders, optionally filtered by ``status``."""
    page = request.args.get("page", 1, type=int)
    size = min(request.args.get("size", DEFAULT_PAGE_SIZE, type=int), MAX_PAGE_SIZE)
    wanted = request.args.get("status")

    rows = [o for o in _ORDERS.values() if wanted is None or o["status"] == wanted]
    start = (page - 1) * size
    return jsonify(items=rows[start : start + size], page=page, total=len(rows))


@bp.get("/<string:order_id>")
def get_order(order_id: str):
    if (order := _ORDERS.get(order_id.upper())) is None:
        raise OrderNotFound(order_id)
    return jsonify(order)


@bp.post("/<string:order_id>/refund")
def refund_order(order_id: str):
    payload = request.get_json(silent=True) or {}
    amount = payload.get("amount")
    if not isinstance(amount, (int, float)) or amount <= 0:
        abort(HTTPStatus.BAD_REQUEST, description="'amount' must be a positive number")
    # FIXME: refunds bypass the payments service in dev; wire up the real client
    current_app.logger.warning("refund %s: $%.2f", order_id, amount)
    return jsonify(ok=True, order_id=order_id, refunded=amount), HTTPStatus.ACCEPTED


@bp.errorhandler(OrderNotFound)
def handle_not_found(err: OrderNotFound):
    return jsonify(error="not_found", message=str(err)), HTTPStatus.NOT_FOUND


@bp.errorhandler(HTTPException)
def handle_http_error(err: HTTPException):
    body = {"error": err.name.lower().replace(" ", "_"), "message": err.description}
    return jsonify(body), err.code
