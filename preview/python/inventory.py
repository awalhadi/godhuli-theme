"""In-memory inventory with async restocking (Python 3.12+)."""
import asyncio
import re
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Protocol, TypedDict

type SkuMap[T] = dict[str, T]

SKU_RE = re.compile(r"(?P<cat>[A-Z]{3})-(?P<num>\d{5})")
BARCODE_RE = re.compile(rb"^\x02(\d{12,13})\x03$")
REORDER_RATIO = 0.15


class Warehouse(StrEnum):
    EAST = "east"
    WEST = "west"


class StockRow(TypedDict):
    sku: str
    qty: int
    warehouse: Warehouse


@dataclass(slots=True, frozen=True)
class Item:
    sku: str
    name: str
    price: float
    tags: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        if not SKU_RE.fullmatch(self.sku):
            raise ValueError(f"bad SKU: {self.sku!r}")


class Supplier(Protocol):
    async def fetch(self, sku: str, qty: int) -> int: ...


class Repo[T]:
    """A tiny generic keyed store."""

    def __init__(self) -> None:
        self._rows: SkuMap[T] = {}

    def __contains__(self, sku: object) -> bool:
        return sku in self._rows

    def put(self, sku: str, value: T) -> None:
        self._rows[sku] = value


def describe(event: object) -> str:
    match event:
        case Item(sku=sku, price=p) if p > 100:
            return f"premium {sku} @ ${p:,.2f}"
        case {"sku": str(sku), "qty": int(q)} if q <= 0:
            return f"{sku} is out of stock ⚠"
        case [first, *rest]:
            return f"batch of {len(rest) + 1} starting with {first!r}"
        case _:
            return f"unknown event: {type(event).__name__}"


async def restock(supplier: Supplier, wanted: dict[str, int]) -> dict[str, int]:
    # TODO: add retry with exponential backoff (base 0.5s, cap 30s)
    async with asyncio.TaskGroup() as tg:
        tasks = {sku: tg.create_task(supplier.fetch(sku, n)) for sku, n in wanted.items()}
    return {sku: t.result() for sku, t in tasks.items()}


if __name__ == "__main__":
    tea = Item("TEA-00042", "Darjeeling \"First Flush\"", 18.5, tags=("organic",))
    print(describe(tea), describe({"sku": tea.sku, "qty": 0}), sep="\n")
    print(f"{'ratio':>8}: {REORDER_RATIO:.1%}  max={1_000_000:_}  hex={0xFF_A0:#x}")
    if m := BARCODE_RE.match(b"\x02012345678905\x03"):
        print(m.group(1).decode())
