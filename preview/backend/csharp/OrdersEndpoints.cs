#nullable enable
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;

namespace Godhuli.Shop.Orders;

public enum OrderStatus { Pending, Paid, Shipped, Cancelled }

public record LineItem(string Sku, int Quantity, decimal UnitPrice);
public record Order(Guid Id, string? Email, IReadOnlyList<LineItem> Lines, OrderStatus Status)
{
    public decimal Total => Lines.Sum(l => l.UnitPrice * l.Quantity);
}

/// <summary>Minimal API endpoints for orders.</summary>
public static partial class OrdersEndpoints
{
    private const int MaxPageSize = 0x64;
    private const decimal FreeShippingThreshold = 75.00m;

    [GeneratedRegex(@"^[A-Z]{3}-\d{5}$", RegexOptions.CultureInvariant)]
    private static partial Regex SkuRegex();

    #region Routes
    public static RouteGroupBuilder MapOrders(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/orders").WithTags("Orders");
        group.MapGet("/{id:guid}", GetAsync);
        group.MapPost("/", CreateAsync);
        return group;
    }
    #endregion

    /// <summary>Gets a single order.</summary>
    /// <param name="id">The order identifier.</param>
    /// <returns>200 with the order, or 404.</returns>
    private static async Task<IResult> GetAsync(Guid id, OrderStore store, CancellationToken ct)
    {
        var order = await store.FindAsync(id, ct);
        return order is null ? Results.NotFound() : Results.Ok(Describe(order));
    }

    private static async Task<IResult> CreateAsync([FromBody] Order body, OrderStore store)
    {
        var invalid = (from line in body.Lines
                       where !SkuRegex().IsMatch(line.Sku) || line.Quantity <= 0
                       select line.Sku).ToList();
        if (invalid is [_, ..])
            return Results.BadRequest(new { error = $"Invalid SKUs: {string.Join(',', invalid)}" });

        // TODO: enforce idempotency keys from the Idempotency-Key header
        await store.SaveAsync(body with { Status = OrderStatus.Pending });
        return Results.Created($"/api/orders/{body.Id}", body);
    }

    private static string Describe(Order o) => o switch
    {
        { Status: OrderStatus.Cancelled } => "cancelled",
        { Total: > FreeShippingThreshold, Email: not null } => $"{o.Email}: free shipping 🚚",
        { Lines.Count: 0 } => "empty",
        _ => $"{o.Lines.Count} items, total {o.Total:C2}",
    };
}

public sealed class OrderStore(ILogger<OrderStore> logger)
{
    private readonly Dictionary<Guid, Order> _rows = new();

    public Task<Order?> FindAsync(Guid id, CancellationToken ct = default) =>
        Task.FromResult(_rows.GetValueOrDefault(id));

    public Task SaveAsync(Order order)
    {
        _rows[order.Id] = order;
        logger.LogInformation("""Saved order "{Id}" with {Count} lines""",
            order.Id, order.Lines.Count);
        return Task.CompletedTask;
    }
}
