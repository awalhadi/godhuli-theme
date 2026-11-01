package shop.orders

import scala.concurrent.{ExecutionContext, Future}
import scala.util.matching.Regex

/** Order domain for the storefront, written in Scala 3. */
enum Status(val label: String):
  case Pending   extends Status("pending")
  case Paid      extends Status("paid")
  case Shipped   extends Status("shipped")
  case Cancelled extends Status("cancelled")

final case class Line(sku: String, qty: Int, unitPrice: BigDecimal)
final case class Order(id: Long, email: Option[String], lines: List[Line], status: Status)

trait Pricing:
  def taxRate: BigDecimal

given defaultPricing: Pricing with
  val taxRate: BigDecimal = BigDecimal("0.0825")

object Orders:
  val SkuPattern: Regex = raw"([A-Z]{3})-(\d{5})".r
  final val MaxLines = 0x80
  private val FreeShippingOver = 75.00

  extension (o: Order)
    def subtotal: BigDecimal = o.lines.map(l => l.unitPrice * l.qty).sum
    def total(using p: Pricing): BigDecimal = (o.subtotal * (1 + p.taxRate)).setScale(2)
    def isEmpty: Boolean = o.lines.isEmpty

  def describe(o: Order): String = o match
    case Order(id, _, Nil, _)                   => s"#$id has no lines"
    case Order(id, Some(e), _, Status.Shipped)  => s"#$id shipped to ${e.toLowerCase}"
    case Order(id, None, lines, _) if lines.size > 10 => s"#$id: bulk guest order"
    case Order(id, _, _, status)                => s"#$id is ${status.label}"

  def category(sku: String): Either[String, String] = sku match
    case SkuPattern(cat, _) => Right(cat)
    case other              => Left(s"invalid SKU \"$other\"")

  // TODO: replace Future with a cats-effect IO once the team agrees on it
  def checkout(
      loadOrder: Long => Future[Option[Order]],
      charge: (Long, BigDecimal) => Future[String]
  )(id: Long)(using ExecutionContext, Pricing): Future[String] =
    for
      maybe <- loadOrder(id)
      order <- maybe.fold(Future.failed(NoSuchElementException(s"order $id")))(Future.successful)
      if !order.isEmpty
      txId  <- charge(order.id, order.total)
      ship   = order.subtotal >= FreeShippingOver
    yield f"tx=$txId%s total=${order.total}%.2f freeShipping=$ship"
