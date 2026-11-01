# frozen_string_literal: true

# Customer-facing order management.
class OrdersController < ApplicationController
  PER_PAGE = 25

  before_action :authenticate_user!
  before_action :set_order, only: %i[show update cancel]
  after_action :verify_authorized, except: :index

  rescue_from ActiveRecord::RecordNotFound do |error|
    respond_to do |format|
      format.html { redirect_to orders_path, alert: "Order not found." }
      format.json { render json: { error: error.message }, status: :not_found }
    end
  end

  def index
    @orders = current_user.orders
                          .includes(:line_items)
                          .recent(params.fetch(:days, 30).to_i)
                          .page(params[:page]).per(PER_PAGE)
    @orders = @orders.where(status: params[:status]) if params[:status].present?
  end

  def show
    authorize @order
    respond_to do |format|
      format.html
      format.json { render json: @order, include: { line_items: { only: %i[sku quantity] } } }
      format.pdf  { send_data OrderPdf.new(@order).render, filename: "#{@order.reference}.pdf" }
    end
  end

  def create
    @order = current_user.orders.build(order_params)
    authorize @order

    if @order.save
      redirect_to @order, notice: "Order #{@order.reference} placed. Thanks!"
    else
      flash.now[:alert] = @order.errors.full_messages.to_sentence
      render :new, status: :unprocessable_entity
    end
  end

  def cancel
    authorize @order
    # FIXME: race with the warehouse webhook flipping status to :shipped
    if @order.shipped?
      redirect_back fallback_location: @order, alert: "Too late — already shipped."
    else
      @order.cancelled!
      redirect_to orders_path, notice: "Cancelled #{@order.reference}."
    end
  end

  private

  def set_order
    @order = current_user.orders.find_by!(reference: params[:id].to_s.upcase)
  end

  def order_params
    params.require(:order).permit(:gift, :notes, line_items_attributes: %i[sku quantity _destroy])
  end
end
