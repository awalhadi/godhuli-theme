"""Inventory HTTP API built on FastAPI."""
import re
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator

SKU_PATTERN = re.compile(r"^[A-Z]{3}-\d{4,6}$")
LOW_STOCK_THRESHOLD = 10


class Product(BaseModel):
    """A sellable product as exposed over the API."""

    sku: str = Field(..., examples=["TEA-00042"])
    name: str = Field(min_length=1, max_length=120)
    price: float = Field(gt=0, description="Unit price in USD")
    stock: int = Field(default=0, ge=0)
    active: bool = True
    barcode: str | None = None

    @field_validator("sku")
    @classmethod
    def check_sku(cls, value: str) -> str:
        if not SKU_PATTERN.fullmatch(value):
            raise ValueError(f"invalid SKU {value!r}; expected e.g. 'TEA-00042'")
        return value


class Database:
    def __init__(self, dsn: str) -> None:
        self.dsn = dsn
        self.rows: dict[str, Product] = {}

    async def connect(self) -> None: ...
    async def close(self) -> None: ...


db = Database("postgresql://inventory@localhost:5432/shop")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    await db.connect()
    yield
    await db.close()


app = FastAPI(title="Inventory", version="1.4.0", lifespan=lifespan)


async def get_db() -> Database:
    return db


DB = Annotated[Database, Depends(get_db)]


@app.get("/products", response_model=list[Product])
async def list_products(
    database: DB,
    low_stock: Annotated[bool, Query(description="Only items below threshold")] = False,
    limit: Annotated[int, Query(le=500)] = 50,
) -> list[Product]:
    items = list(database.rows.values())
    if low_stock:
        items = [p for p in items if p.stock < LOW_STOCK_THRESHOLD]
    return items[:limit]


@app.post("/products", status_code=status.HTTP_201_CREATED)
async def create_product(product: Product, database: DB) -> Product:
    if product.sku in database.rows:
        raise HTTPException(status_code=409, detail=f"SKU {product.sku} already exists")
    # TODO: emit a `product.created` event to the outbox table
    database.rows[product.sku] = product
    return product
