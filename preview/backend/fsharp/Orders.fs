module Godhuli.Shop.Orders

open System
open System.Text.RegularExpressions

/// Payment method attached to an order.
type Payment =
    | Card of last4: string * expiryYear: int
    | Wallet of provider: string
    | Invoice of netDays: int

type Status =
    | Pending
    | Paid of DateTimeOffset
    | Shipped of tracking: string
    | Cancelled

/// A single order line.
type Line = { Sku: string; Quantity: int; UnitPrice: decimal }

type Order =
    { Id: Guid
      Email: string option
      Lines: Line list
      Payment: Payment
      Status: Status }

[<Literal>]
let TaxRate = 0.0825m

let MaxLines = 0x40
let private skuRegex = Regex(@"^[A-Z]{3}-\d{5}$", RegexOptions.Compiled)

let subtotal order =
    order.Lines |> List.sumBy (fun l -> l.UnitPrice * decimal l.Quantity)

let total order = subtotal order * (1m + TaxRate) |> fun t -> Math.Round(t, 2)

let describe order =
    match order.Status, order.Payment with
    | Cancelled, _ -> "cancelled"
    | Shipped tracking, _ -> sprintf "shipped (%s)" tracking
    | Paid at, Card(last4, _) -> $"paid {at:yyyy-MM-dd} with card \"{last4}\""
    | Pending, Card(_, year) when year < 2026 -> "card expired"
    | Pending, _ -> "awaiting payment"
    | Paid _, (Wallet _ | Invoice _) -> "paid"

let validate order : Result<Order, string list> =
    let errors =
        order.Lines
        |> List.filter (fun l -> not (skuRegex.IsMatch l.Sku) || l.Quantity <= 0)
        |> List.map (fun l -> $"bad line: {l.Sku}")
    if List.isEmpty errors then Ok order else Error errors

// TODO: replace the fake gateway with the real payments client
let charge (order: Order) : Async<Result<string, string>> =
    async {
        do! Async.Sleep 150
        let amount = total order
        if amount > 10_000m then return Error "requires manual review"
        else return Ok(sprintf "tx_%08x" (abs (order.Id.GetHashCode())))
    }

let checkout order =
    async {
        match validate order with
        | Error errs -> return Error(String.Join("; ", errs))
        | Ok valid ->
            let! tx = charge valid
            let paid = { valid with Status = Paid DateTimeOffset.UtcNow }
            return tx |> Result.map (fun id -> paid, id)
    }
