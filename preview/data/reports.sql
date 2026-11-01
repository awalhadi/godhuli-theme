-- Godhuli Shop: monthly revenue & customer ranking reports
-- Target: PostgreSQL 16

/* ------------------------------------------------------------
 * Schema
 * ------------------------------------------------------------ */
CREATE TABLE IF NOT EXISTS orders (
    id            BIGSERIAL PRIMARY KEY,
    customer_id   BIGINT       NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
    status        TEXT         NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'paid', 'shipped', 'refunded')),
    total_cents   INTEGER      NOT NULL CHECK (total_cents >= 0),
    currency      CHAR(3)      NOT NULL DEFAULT 'BDT',
    is_gift       BOOLEAN      NOT NULL DEFAULT FALSE,
    metadata      JSONB        DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_orders_customer_created UNIQUE (customer_id, created_at)
);

CREATE INDEX idx_orders_status_created ON orders (status, created_at DESC);
CREATE INDEX idx_orders_metadata_gin   ON orders USING gin (metadata jsonb_path_ops);

-- Idempotent upsert of a single order
INSERT INTO orders (customer_id, status, total_cents, metadata)
VALUES (42, 'paid', 129900, '{"coupon": "DUSK10", "note": "It''s a gift\n"}')
ON CONFLICT (customer_id, created_at)
DO UPDATE SET status      = EXCLUDED.status,
              total_cents = EXCLUDED.total_cents
RETURNING id, created_at;

/* Top 3 customers per month by revenue, with running totals */
WITH monthly AS (
    SELECT
        date_trunc('month', o.created_at)::date AS month,
        c.id                                     AS customer_id,
        c.email,
        SUM(o.total_cents) / 100.0               AS revenue,
        COUNT(*) FILTER (WHERE o.is_gift)        AS gift_orders
    FROM orders o
    INNER JOIN customers c ON c.id = o.customer_id
    LEFT JOIN refunds   r ON r.order_id = o.id
    WHERE o.status <> 'refunded'
      AND r.id IS NULL
      AND o.created_at >= now() - INTERVAL '12 months'
    GROUP BY 1, 2, 3
),
ranked AS (
    SELECT
        m.*,
        ROW_NUMBER() OVER (PARTITION BY m.month ORDER BY m.revenue DESC) AS rn,
        SUM(m.revenue) OVER (PARTITION BY m.customer_id ORDER BY m.month
                             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS lifetime
    FROM monthly m
)
SELECT
    to_char(month, 'YYYY-MM')               AS month,
    email,
    round(revenue::numeric, 2)              AS revenue,
    CASE
        WHEN lifetime >= 50000 THEN 'platinum'
        WHEN lifetime >= 10000 THEN 'gold'
        ELSE 'standard'
    END                                     AS tier,
    COALESCE(NULLIF(gift_orders, 0), NULL)  AS gifts
FROM ranked
WHERE rn <= 3
ORDER BY month DESC, rn ASC
LIMIT 36;
