"""
    OrderStats

Descriptive statistics over storefront orders.
"""
module OrderStats

using Statistics
using Printf
using Dates

export Order, Line, total, summarize

const TAX_RATE = 0.0825
const SKU_RE = r"^(?<cat>[A-Z]{3})-(?<num>\d{5})$"
const MAX_LINES = 0x40

@enum Status pending=1 paid shipped cancelled

struct Line
    sku::String
    qty::Int
    unit_price::Float64
end

mutable struct Order{T<:Real}
    id::Int
    email::Union{String,Nothing}
    lines::Vector{Line}
    status::Status
    discount::T
end

Order(id, lines; email=nothing) = Order(id, email, lines, pending, 0.0)

"""
    total(x)

Total price including tax. Dispatches on lines, orders, and collections.
"""
total(l::Line) = l.qty * l.unit_price
total(o::Order) = round(sum(total, o.lines; init=0.0) * (1 + TAX_RATE) - o.discount; digits=2)
total(os::AbstractVector{<:Order}) = sum(total.(os))

category(l::Line) = (m = match(SKU_RE, l.sku)) === nothing ? missing : m[:cat]

function summarize(orders::Vector{<:Order})
    isempty(orders) && throw(ArgumentError("no orders to summarize"))
    totals = total.(orders)
    paid_orders = filter(o -> o.status == paid, orders)
    # TODO: weight the median by quantity once we have per-line timestamps
    return (
        n = length(orders),
        mean = mean(totals),
        median = median(totals),
        p95 = quantile(totals, 0.95),
        paid_ratio = length(paid_orders) / length(orders),
    )
end

end # module

using .OrderStats

orders = [
    Order(1, [Line("TEA-00042", 2, 18.5), Line("MUG-00001", 1, 12.0)]),
    Order(2, [Line("COF-00311", 10, 9.99)]; email="ana@example.com"),
    Order(3, Line[]),
]

stats = @time summarize(orders)
prices = [18.5, 9.99, 12.0]
discounted = prices .* 0.9 .+ 1e-2
@printf("orders=%d mean=\$%.2f p95=%.2f\n", stats.n, stats.mean, stats.p95)
println("discounted: $(round.(discounted; digits=2)) — done")
