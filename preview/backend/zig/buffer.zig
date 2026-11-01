//! Fixed-capacity buffer of order line items.
const std = @import("std");
const Allocator = std.mem.Allocator;

pub const max_lines: usize = 0x40;
const tax_rate: f64 = 0.0825;

pub const Status = enum(u8) {
    pending,
    paid,
    shipped,
    cancelled = 0xFF,
};

pub const BufferError = error{ Full, InvalidSku, Empty };

pub const Line = struct {
    sku: []const u8,
    qty: u32,
    unit_cents: u64,

    /// Line total in cents.
    pub fn total(self: Line) u64 {
        return self.unit_cents * self.qty;
    }
};

/// Generic bounded buffer; `capacity` is resolved at compile time.
pub fn Buffer(comptime T: type, comptime capacity: usize) type {
    return struct {
        const Self = @This();

        items: [capacity]T = undefined,
        len: usize = 0,

        pub fn push(self: *Self, item: T) BufferError!void {
            if (self.len >= capacity) return error.Full;
            self.items[self.len] = item;
            self.len += 1;
        }

        pub fn pop(self: *Self) ?T {
            if (self.len == 0) return null;
            self.len -= 1;
            return self.items[self.len];
        }
    };
}

fn validateSku(sku: []const u8) BufferError!void {
    // TODO: share the SKU grammar with the API layer instead of duplicating it
    if (sku.len != 9 or sku[3] != '-') return error.InvalidSku;
}

pub fn summarize(alloc: Allocator, lines: []const Line) ![]u8 {
    var sum: u64 = 0;
    for (lines) |l| sum += l.total();
    const with_tax = @as(f64, @floatFromInt(sum)) * (1.0 + tax_rate) / 100.0;
    return std.fmt.allocPrint(alloc, "{d} lines, total ${d:.2}\n", .{ lines.len, with_tax });
}

test "push until full" {
    var buf = Buffer(Line, 2){};
    try buf.push(.{ .sku = "TEA-00042", .qty = 2, .unit_cents = 1_850 });
    try buf.push(.{ .sku = "COF-00311", .qty = 1, .unit_cents = 999 });
    try std.testing.expectError(error.Full, buf.push(.{ .sku = "X", .qty = 1, .unit_cents = 1 }));
}

test "summarize and validate" {
    const alloc = std.testing.allocator;
    const lines = [_]Line{.{ .sku = "TEA-00042", .qty = 3, .unit_cents = 1_000 }};
    const text = try summarize(alloc, &lines);
    defer alloc.free(text);
    try std.testing.expect(std.mem.startsWith(u8, text, "1 lines"));
    validateSku("bad") catch |err| try std.testing.expect(err == error.InvalidSku);
}
