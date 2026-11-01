# Changelog

All notable changes to **Godhuli Shop** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Partial refund API behind the `refunds.partial` feature flag.

## [2.4.1] - 2026-10-28

### Fixed
- Stock reservation no longer fails under concurrent updates (#231).
- `PATCH /orders/:id` returned `500` when `currency` was omitted.

### Security
- Bumped `jsonwebtoken` to `9.0.3` to address CVE-2026-1142.

## [2.4.0] - 2026-10-02

### Added
- Gift messages on orders, up to 280 characters.
- bKash tokenized checkout.
- `orders.watch` streaming RPC.

### Changed
- Order totals are now rounded half-even instead of half-up.

### Deprecated
- `shop.legacyCheckout` — will be removed in 3.0.0.

## [2.0.0] - 2026-06-15

### Removed
- **BREAKING:** Long-polling order updates; use WebSockets instead.
- Node.js 18 support.

### Changed
- Package renamed from `godhuli-shop` to `@godhuli/shop`.

## [1.0.0] - 2026-01-10

### Added
- Initial release with orders, customers, and invoices.

[Unreleased]: https://github.com/godhuli/shop/compare/v2.4.1...HEAD
[2.4.1]: https://github.com/godhuli/shop/compare/v2.4.0...v2.4.1
[2.4.0]: https://github.com/godhuli/shop/compare/v2.0.0...v2.4.0
[2.0.0]: https://github.com/godhuli/shop/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/godhuli/shop/releases/tag/v1.0.0
