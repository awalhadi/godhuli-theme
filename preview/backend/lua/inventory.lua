--- Inventory module for the storefront's Lua scripting layer.
-- @module inventory

local REORDER_LEVEL <const> = 10
local TAX_RATE = 0.0825
local FLAGS = 0xFF

local Inventory = {}
Inventory.__index = Inventory

--- Create a new inventory.
-- @tparam string warehouse warehouse code, e.g. "east"
-- @treturn Inventory
function Inventory.new(warehouse)
  local self = setmetatable({}, Inventory)
  self.warehouse = warehouse or "east"
  self.items = {}
  self.count = 0
  return self
end

local function valid_sku(sku)
  return type(sku) == "string" and sku:match("^%u%u%u%-%d%d%d%d%d$") ~= nil
end

function Inventory:add(sku, qty, price)
  if not valid_sku(sku) then
    error(("invalid SKU %q"):format(tostring(sku)), 2)
  end
  local item = self.items[sku]
  if item == nil then
    item = { qty = 0, price = price or 0.0, active = true }
    self.items[sku] = item
    self.count = self.count + 1
  end
  item.qty = item.qty + (qty or 1)
  return item.qty
end

function Inventory:low_stock()
  local result = {}
  for sku, item in pairs(self.items) do
    if item.active and item.qty < REORDER_LEVEL then
      result[#result + 1] = sku
    end
  end
  table.sort(result)
  return result
end

--- Returns a closure that tracks running order totals.
local function make_counter()
  local total = 0
  return function(amount)
    total = total + amount * (1 + TAX_RATE)
    return total
  end
end

Inventory.__tostring = function(inv)
  return string.format("Inventory<%s, %d skus>", inv.warehouse, inv.count)
end

local REPORT_TEMPLATE = [[
Warehouse: %s
Low stock: %s
]]

-- TODO: load stock levels from the warehouse API instead of hard-coding
local inv = Inventory.new("west")
inv:add("TEA-00042", 4, 18.50)
inv:add("COF-00311", 120, 9.99)

local ok, err = pcall(inv.add, inv, "bad-sku", 1)
if not ok then print("rejected: " .. err) end

local add = make_counter()
add(18.50); print(("running total: $%.2f\tflags=0x%X"):format(add(9.99), FLAGS))
io.write(REPORT_TEMPLATE:format(inv.warehouse, table.concat(inv:low_stock(), ", ")))
print(tostring(inv))
