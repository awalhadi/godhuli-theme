#' Weekly order analysis for the storefront.
#'
#' Reads the exported orders CSV and plots revenue by category.
#' @author analytics-team

library(dplyr)
library(ggplot2)
library(readr)
library(stringr)

TAX_RATE <- 0.0825
MIN_ORDERS <- 5L
SKU_PATTERN <- "^([A-Z]{3})-(\\d{5})$"

#' Compute net revenue for a vector of gross amounts.
#' @param gross numeric vector of gross totals
#' @param refunded logical vector; refunded orders count as zero
#' @return numeric vector of net amounts
net_revenue <- function(gross, refunded = FALSE) {
  stopifnot(is.numeric(gross))
  ifelse(refunded, 0, gross / (1 + TAX_RATE))
}

orders <- tryCatch(
  read_csv("data/orders_2026-10.csv", col_types = cols(placed_at = col_datetime())),
  error = function(e) {
    warning(sprintf("Falling back to sample data: %s", conditionMessage(e)))
    tibble(
      sku = c("TEA-00042", "COF-00311", "TEA-00007", "MUG-00001"),
      qty = c(2L, 1L, 6L, 3L),
      unit_price = c(18.5, 9.99, 4.25, 12),
      refunded = c(FALSE, TRUE, FALSE, NA),
      placed_at = Sys.time() - c(1, 2, 3, 4) * 86400
    )
  }
)

by_category <- orders |>
  mutate(
    category = str_match(sku, SKU_PATTERN)[, 2],
    gross = qty * unit_price,
    net = net_revenue(gross, coalesce(refunded, FALSE)),
    week = format(placed_at, "%G-W%V")
  ) |>
  filter(!is.na(category)) |>
  group_by(category, week) |>
  summarise(orders = n(), revenue = sum(net), .groups = "drop") |>
  arrange(desc(revenue))

# TODO: flag categories with fewer than MIN_ORDERS instead of silently dropping them
top <- by_category %>% filter(orders >= MIN_ORDERS | revenue > 1e3)

message(sprintf("Total net revenue: $%s\n", format(sum(by_category$revenue), big.mark = ",")))

p <- ggplot(by_category, aes(x = week, y = revenue, fill = category)) +
  geom_col(position = "dodge") +
  scale_y_continuous(labels = scales::dollar) +
  labs(title = "Net revenue by category", x = NULL, y = "Revenue (USD)") +
  theme_minimal(base_size = 12)

ggsave("out/revenue_by_category.png", p, width = 8, height = 4.5, dpi = 150)
