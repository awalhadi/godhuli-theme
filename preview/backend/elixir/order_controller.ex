defmodule ShopWeb.OrderController do
  @moduledoc """
  JSON endpoints for customer orders.
  """
  use ShopWeb, :controller

  alias Shop.{Orders, Payments}
  alias Shop.Orders.Order

  @sku_pattern ~r/^[A-Z]{3}-\d{5}$/
  @page_size 25
  @free_shipping_cents 7_500
  @tax_rate 0.0825

  action_fallback ShopWeb.FallbackController

  @doc "Lists the current customer's orders, newest first."
  def index(conn, params) do
    page = params |> Map.get("page", "1") |> String.to_integer()

    orders =
      conn.assigns.current_user
      |> Orders.list_for_customer(status: params["status"], limit: @page_size)
      |> Enum.drop((page - 1) * @page_size)
      |> Enum.map(&summarize/1)

    json(conn, %{data: orders, page: page})
  end

  @doc """
  Places a new order. Returns `201` on success or `422` with errors.
  """
  def create(conn, %{"order" => %{"lines" => lines} = attrs}) when is_list(lines) do
    with :ok <- validate_skus(lines),
         {:ok, %Order{} = order} <- Orders.create(conn.assigns.current_user, attrs),
         {:ok, _tx} <- Payments.authorize(order, timeout: 5_000) do
      conn
      |> put_status(:created)
      |> put_resp_header("location", ~p"/api/orders/#{order.reference}")
      |> json(%{data: summarize(order)})
    else
      {:error, :invalid_sku, sku} ->
        conn |> put_status(422) |> json(%{error: "invalid SKU #{inspect(sku)}"})

      {:error, %Ecto.Changeset{} = changeset} ->
        {:error, changeset}

      {:error, reason} ->
        # FIXME: payment failures leave a dangling :pending order
        {:error, reason}
    end
  end

  def create(_conn, _params), do: {:error, :bad_request}

  defp validate_skus(lines) do
    case Enum.find(lines, fn %{"sku" => sku} -> not Regex.match?(@sku_pattern, sku) end) do
      nil -> :ok
      %{"sku" => bad} -> {:error, :invalid_sku, bad}
    end
  end

  defp summarize(%Order{total_cents: cents, status: status} = order) do
    %{
      reference: order.reference,
      status: status,
      total: :erlang.float_to_binary(cents * (1 + @tax_rate) / 100, decimals: 2),
      free_shipping: cents >= @free_shipping_cents,
      note: order.note || ~s(No "gift" message)
    }
  end
end
