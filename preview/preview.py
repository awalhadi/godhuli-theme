"""Godhuli stress sample — Python.

Check: decorators, self/cls, f-string braces vs body, docstrings vs comments, dunder builtins.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import cached_property
from typing import ClassVar, Generic, Iterator, TypeVar

T = TypeVar("T", bound="Shipment")
TRACKING = re.compile(r"^(?P<carrier>[A-Z]{3})\s?(\d{10,12})$", re.IGNORECASE)
DEFAULT_TIMEOUT: float = 2.5


@dataclass(frozen=True, slots=True)
class Shipment:
    """A parcel in transit. Docstrings read as documentation, not code."""

    tracking: str
    weight_kg: float = 0.0
    tags: list[str] = field(default_factory=list)
    registry: ClassVar[dict[str, "Shipment"]] = {}

    def __post_init__(self) -> None:
        if not TRACKING.match(self.tracking):
            raise ValueError(f"bad tracking {self.tracking!r} ({len(self.tracking)} chars)")

    @cached_property
    def carrier(self) -> str:
        return self.tracking[:3].upper()

    @classmethod
    def parse(cls, raw: str, *, strict: bool = True) -> Shipment | None:
        match = TRACKING.match(raw.strip())
        if match is None:
            return None if not strict else cls._fail(raw)
        return cls(tracking=match.group(0), tags=[match["carrier"]])

    @staticmethod
    def _fail(raw: str) -> None:
        raise LookupError(f"{raw=} did not match {TRACKING.pattern}")


class Manifest(Generic[T]):
    def __init__(self, items: list[T] | None = None) -> None:
        self._items = items or []

    def __iter__(self) -> Iterator[T]:
        yield from sorted(self._items, key=lambda s: (s.carrier, -s.weight_kg))

    def heavy(self, threshold: float = 20) -> list[T]:
        return [s for s in self if s.weight_kg > threshold and "fragile" not in s.tags]


async def dispatch(manifest: Manifest[Shipment], *, retries: int = 3) -> int:
    sent = 0
    for shipment in manifest:
        while retries > 0:
            try:
                await _send(shipment, timeout=DEFAULT_TIMEOUT)
                sent += 1
                break
            except TimeoutError as exc:  # noqa: PERF203 — comment stays readable but quiet
                retries -= 1
                print(f"retry {shipment.tracking}: {exc}", flush=True)
    return sent


async def _send(shipment: Shipment, timeout: float) -> None: ...


if __name__ == "__main__":
    print(Shipment.parse("UPS 1234567890"), True, None, 0b1010, 3.14e-2)
