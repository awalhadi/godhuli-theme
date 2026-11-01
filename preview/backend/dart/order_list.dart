import 'dart:async';

import 'package:flutter/material.dart';

/// Lifecycle states an order can be in.
enum OrderStatus { pending, paid, shipped, cancelled }

const double kTaxRate = 0.0825;
const int kPageSize = 0x19;
final RegExp skuPattern = RegExp(r'^[A-Z]{3}-\d{5}$');

typedef Order = ({String reference, double total, String? email, OrderStatus status});

abstract interface class OrderApi {
  Future<List<Order>> fetchPage(int page, {int size});
}

/// Paged list of the signed-in customer's orders.
class OrderList extends StatefulWidget {
  const OrderList({super.key, required this.api, this.onTap});

  final OrderApi api;
  final void Function(Order order)? onTap;

  @override
  State<OrderList> createState() => _OrderListState();
}

class _OrderListState extends State<OrderList> {
  final List<Order> _orders = [];
  var _page = 1;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_loadMore());
  }

  Future<void> _loadMore() async {
    if (_loading) return;
    setState(() => _loading = true);
    try {
      final next = await widget.api
          .fetchPage(_page++, size: kPageSize)
          .timeout(const Duration(seconds: 10));
      setState(() => _orders.addAll(next));
    } on TimeoutException catch (e) {
      setState(() => _error = 'Request timed out after ${e.duration?.inSeconds ?? 10}s');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  (String, Color) _badge(OrderStatus s) => switch (s) {
        OrderStatus.paid => ('Paid', Colors.green),
        OrderStatus.shipped => ('Shipped', Colors.blue),
        OrderStatus.cancelled => ('Cancelled', Colors.grey),
        _ => ('Pending', Colors.orange),
      };

  @override
  Widget build(BuildContext context) {
    // TODO: replace with a sliver list and pull-to-refresh
    if (_error case final message?) return Center(child: Text('Error: $message'));
    return ListView.builder(
      itemCount: _orders.length + (_loading ? 1 : 0),
      itemBuilder: (context, i) {
        if (i >= _orders.length) return const LinearProgressIndicator();
        final order = _orders[i];
        final (label, color) = _badge(order.status);
        final gross = (order.total * (1 + kTaxRate)).toStringAsFixed(2);
        return ListTile(
          title: Text(order.reference),
          subtitle: Text('${order.email ?? "guest"} • \$$gross'),
          trailing: Chip(label: Text(label), backgroundColor: color.withOpacity(0.15)),
          onTap: () => widget.onTap?.call(order),
        );
      },
    );
  }
}
