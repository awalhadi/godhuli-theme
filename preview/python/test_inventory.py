"""Tests for the inventory module."""
import asyncio

import pytest

import inventory
from inventory import Item, Repo, describe, restock


@pytest.fixture
def tea() -> Item:
    return Item("TEA-00042", "Assam Breakfast", 12.75, tags=("black", "loose-leaf"))


@pytest.fixture
def repo(tea: Item) -> Repo[Item]:
    r: Repo[Item] = Repo()
    r.put(tea.sku, tea)
    return r


class FakeSupplier:
    def __init__(self, fail_on: str | None = None) -> None:
        self.fail_on = fail_on
        self.calls: list[tuple[str, int]] = []

    async def fetch(self, sku: str, qty: int) -> int:
        self.calls.append((sku, qty))
        if sku == self.fail_on:
            raise ConnectionError(f"supplier timeout for {sku}")
        await asyncio.sleep(0)
        return qty


def test_repo_contains(repo: Repo[Item], tea: Item) -> None:
    assert tea.sku in repo
    assert "NOP-00000" not in repo


@pytest.mark.parametrize(
    ("sku", "valid"),
    [("TEA-00001", True), ("tea-00001", False), ("TEA-1", False), ("COF-99999", True)],
)
def test_sku_validation(sku: str, valid: bool) -> None:
    if valid:
        assert Item(sku, "x", 1.0).sku == sku
    else:
        with pytest.raises(ValueError, match=r"bad SKU: '.*'"):
            Item(sku, "x", 1.0)


@pytest.mark.parametrize(
    "event, expected",
    [
        ({"sku": "TEA-00042", "qty": 0}, "TEA-00042 is out of stock ⚠"),
        ([1, 2, 3], "batch of 3 starting with 1"),
    ],
)
def test_describe(event: object, expected: str) -> None:
    assert describe(event) == expected


def test_reorder_ratio_can_be_patched(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(inventory, "REORDER_RATIO", 0.5)
    monkeypatch.setenv("INVENTORY_ENV", "test")
    assert inventory.REORDER_RATIO == pytest.approx(0.5)


async def test_restock_collects_results() -> None:
    supplier = FakeSupplier()
    got = await restock(supplier, {"TEA-00042": 24, "COF-00007": 6})
    assert got == {"TEA-00042": 24, "COF-00007": 6}


@pytest.mark.xfail(reason="FIXME: TaskGroup wraps errors in ExceptionGroup", strict=False)
async def test_restock_propagates_failure() -> None:
    with pytest.raises(ConnectionError):
        await restock(FakeSupplier(fail_on="COF-00007"), {"COF-00007": 1})
