/**
 * ring_buffer.c - fixed-size ring buffer for order events.
 *
 * Single producer / single consumer; not thread-safe without external locking.
 */
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#ifndef RING_CAPACITY
#define RING_CAPACITY 256u
#endif

#define RING_MASK (RING_CAPACITY - 1u)
#define IS_POW2(n) (((n) & ((n) - 1)) == 0)
#define MIN(a, b) ((a) < (b) ? (a) : (b))

#if !IS_POW2(RING_CAPACITY)
#error "RING_CAPACITY must be a power of two"
#endif

typedef enum { EVT_PLACED = 1, EVT_PAID, EVT_SHIPPED, EVT_CANCELLED = 0x7F } event_kind;

typedef struct {
    event_kind kind;
    uint64_t order_id;
    union {
        double amount;      /* EVT_PAID */
        char tracking[16];  /* EVT_SHIPPED */
    } data;
} order_event;

typedef struct {
    order_event slots[RING_CAPACITY];
    volatile uint32_t head;
    volatile uint32_t tail;
} ring_buffer;

typedef void (*event_handler)(const order_event *evt, void *ctx);

static inline uint32_t ring_size(const ring_buffer *rb) { return rb->head - rb->tail; }
static inline bool ring_full(const ring_buffer *rb) { return ring_size(rb) == RING_CAPACITY; }

bool ring_push(ring_buffer *rb, const order_event *evt) {
    if (rb == NULL || evt == NULL || ring_full(rb)) {
        return false;
    }
    memcpy(&rb->slots[rb->head & RING_MASK], evt, sizeof *evt);
    rb->head++;
    return true;
}

/* Drains up to `max` events into `handler`; returns the number processed. */
size_t ring_drain(ring_buffer *rb, size_t max, event_handler handler, void *ctx) {
    size_t n = MIN((size_t)ring_size(rb), max);
    for (size_t i = 0; i < n; ++i) {
        handler(&rb->slots[rb->tail++ & RING_MASK], ctx);
    }
    return n; /* FIXME: report dropped events once we add overwrite mode */
}

static void print_event(const order_event *e, void *ctx) {
    (void)ctx;
    unsigned long long id = (unsigned long long)e->order_id;
    switch (e->kind) {
    case EVT_PAID:    printf("order #%llu paid $%.2f\n", id, e->data.amount); break;
    case EVT_SHIPPED: printf("order #%llu shipped [%s]\n", id, e->data.tracking); break;
    default:          printf("order #%llu event 0x%02X\n", id, (unsigned)e->kind); break;
    }
}

int main(void) {
    static ring_buffer rb = {0};
    order_event paid = {.kind = EVT_PAID, .order_id = 1042u, .data.amount = 129.95};
    ring_push(&rb, &paid);
    printf("drained %zu event(s)\t\"ok\"\n", ring_drain(&rb, 8, print_event, NULL));
    return 0;
}
