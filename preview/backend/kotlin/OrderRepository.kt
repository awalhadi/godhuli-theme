package com.godhuli.shop.orders

import kotlinx.coroutines.*
import java.math.BigDecimal
import java.time.Instant

/** Lifecycle of an order as seen by the repository layer. */
sealed class OrderState {
    data object Pending : OrderState()
    data class Paid(val at: Instant, val txId: String) : OrderState()
    data class Failed(val reason: String, val retryable: Boolean = true) : OrderState()
}

@JvmInline
value class Sku(val raw: String) {
    init { require(SKU_REGEX.matches(raw)) { "invalid SKU: \"$raw\"" } }
}

data class Order(
    val id: Long,
    val customerEmail: String?,
    val lines: Map<Sku, Int>,
    val state: OrderState = OrderState.Pending,
)

private val SKU_REGEX = Regex("""^[A-Z]{3}-\d{5}$""")

fun BigDecimal.asUsd(): String = "$" + "%,.2f".format(this)

fun Order.isHighValue(threshold: Int = 1_000): Boolean = lines.values.sum() > threshold

interface OrderStore {
    suspend fun load(id: Long): Order?
    suspend fun save(order: Order)
}

class OrderRepository(private val store: OrderStore, private val io: CoroutineDispatcher) {

    companion object {
        const val MAX_BATCH = 0x40
        private const val TIMEOUT_MS = 2_500L
    }

    suspend fun describe(id: Long): String = withContext(io) {
        val order = store.load(id) ?: return@withContext "order #$id not found"
        val email = order.customerEmail?.lowercase() ?: "guest"
        when (val s = order.state) {
            is OrderState.Pending -> "#${order.id} pending for $email"
            is OrderState.Paid -> "#${order.id} paid at ${s.at} (tx=${s.txId})"
            is OrderState.Failed -> if (s.retryable) "retry #$id: ${s.reason}" else "dead"
        }
    }

    suspend fun loadMany(ids: List<Long>): List<Order> = coroutineScope {
        // TODO: chunk by MAX_BATCH once the store supports bulk reads
        ids.map { id -> async { withTimeoutOrNull(TIMEOUT_MS) { store.load(id) } } }
            .awaitAll()
            .filterNotNull()
    }

    fun markPaidLater(scope: CoroutineScope, order: Order, txId: String) = scope.launch(io) {
        try {
            store.save(order.copy(state = OrderState.Paid(Instant.now(), txId)))
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            val retry = order.copy(state = OrderState.Failed(e.message!!, retryable = false))
            store.save(retry)
        }
    }
}
