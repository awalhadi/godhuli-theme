# frozen_string_literal: true

# An order placed by a customer. Totals are cached in `total_cents`.
class Order < ApplicationRecord
  REFERENCE_FORMAT = /\AORD-\d{8}\z/
  FREE_SHIPPING_CENTS = 7_500
  TAX_RATE = 0.0825

  belongs_to :customer, class_name: "User", inverse_of: :orders
  has_many :line_items, dependent: :destroy
  has_many :products, through: :line_items
  has_one :shipment, dependent: :nullify

  enum :status, { pending: 0, paid: 1, shipped: 2, cancelled: 9 }, default: :pending

  validates :reference, presence: true, uniqueness: true, format: { with: REFERENCE_FORMAT }
  validates :total_cents, numericality: { greater_than_or_equal_to: 0 }
  validate :must_have_items, on: :create

  before_validation :assign_reference, on: :create
  after_commit :notify_warehouse, if: -> { saved_change_to_status?(to: "paid") }

  scope :recent, ->(days = 30) { where(created_at: days.days.ago..) }
  scope :large, -> { where("total_cents > ?", 50_000) }
  scope :gifts, -> { where(gift: true).order(created_at: :desc) }

  # @return [String] the formatted total, e.g. "$1,299.00"
  def display_total
    dollars = total_cents / 100.0
    "$#{dollars.round(2).to_s.reverse.scan(/\d{1,3}/).join(',').reverse}"
  end

  def free_shipping?
    total_cents >= FREE_SHIPPING_CENTS && !cancelled?
  end

  def recalculate!
    subtotal = line_items.sum { |li| li.unit_price_cents * li.quantity }
    update!(total_cents: (subtotal * (1 + TAX_RATE)).round)
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.error("Order #{id} failed to recalculate: #{e.message}")
    raise
  end

  def to_s = "Order #{reference} (#{status.humanize})"

  private

  def assign_reference
    self.reference ||= format("ORD-%08d", (self.class.maximum(:id) || 0) + 1)
  end

  def must_have_items
    errors.add(:line_items, "can't be empty") if line_items.empty?
  end

  def notify_warehouse
    # TODO: move to a background job; this blocks the request cycle
    WarehouseClient.new.enqueue(reference:, items: line_items.map(&:sku), priority: nil)
  end
end
