package com.godhuli.shop.orders;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST endpoints for placing and querying orders.
 *
 * @author storefront-team
 * @since 2.3.0
 */
@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {

    private static final Pattern REF = Pattern.compile("^ORD-\\d{8}$");
    private static final long MAX_CENTS = 9_999_999L;
    private static final int FLAGS = 0x0F;

    sealed interface Payment permits Card, Wallet, Invoice {}
    record Card(String last4, int expiryYear) implements Payment {}
    record Wallet(String provider) implements Payment {}
    record Invoice(int netDays) implements Payment {}

    public record LineItem(@NotBlank String sku, @Positive int quantity, BigDecimal price) {}
    public record CreateOrder(@NotEmpty List<@Valid LineItem> items, Payment payment) {}
    public record OrderView(String reference, BigDecimal total, boolean paid) {}

    private final OrderService service;

    public OrderController(OrderService service) {
        this.service = service;
    }

    /**
     * Looks up a single order by its reference.
     *
     * @param ref the order reference, e.g. {@code ORD-00001234}
     * @return the order, or {@code 404} when it does not exist
     */
    @GetMapping("/{ref}")
    public ResponseEntity<OrderView> get(@PathVariable String ref) {
        if (!REF.matcher(ref).matches()) {
            return ResponseEntity.badRequest().build();
        }
        Optional<OrderView> found = service.find(ref);
        return found.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<OrderView> create(@Valid @RequestBody CreateOrder body) {
        BigDecimal total = body.items().stream()
            .map(i -> i.price().multiply(BigDecimal.valueOf(i.quantity())))
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        String terms = switch (body.payment()) {
            case Card c when c.expiryYear() < 2026 -> throw new IllegalStateException("expired");
            case Card c -> "card ending %s".formatted(c.last4());
            case Wallet(var provider) -> "wallet via " + provider;
            case Invoice inv -> "net-" + inv.netDays();
        };

        // TODO: move receipt rendering into a dedicated template service
        String receipt = """
            Order total: $%s
            Payment:     %s\tflags=%d
            """.formatted(total, terms, FLAGS);

        OrderView view = service.place(body, total, receipt);
        return ResponseEntity.status(201).body(view);
    }
}
