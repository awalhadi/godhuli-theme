// inventory.cpp - stock tracking with C++20 ranges and concepts.
#include <concepts>
#include <format>
#include <iostream>
#include <map>
#include <memory>
#include <ranges>
#include <string>
#include <vector>

namespace shop::inventory {

inline constexpr int kReorderLevel = 10;
inline constexpr double kTaxRate = 0.0825;
inline constexpr unsigned kFlags = 0xFF'00u;

template <typename T>
concept Priced = requires(const T& t) {
    { t.price() } -> std::convertible_to<double>;
    { t.sku() } -> std::convertible_to<std::string>;
};

/// Base class for anything that can sit on a shelf.
class Item {
public:
    Item(std::string sku, double price) : sku_{std::move(sku)}, price_{price} {}
    virtual ~Item() = default;

    [[nodiscard]] const std::string& sku() const noexcept { return sku_; }
    [[nodiscard]] virtual double price() const { return price_; }
private:
    std::string sku_;
    double price_;
};

class PerishableItem final : public Item {
public:
    PerishableItem(std::string sku, double price, int daysLeft)
        : Item{std::move(sku), price}, daysLeft_{daysLeft} {}

    [[nodiscard]] double price() const override {
        return daysLeft_ <= 2 ? Item::price() * 0.5 : Item::price();  // markdown
    }
private:
    int daysLeft_;
};

template <Priced T>
constexpr double withTax(const T& item) { return item.price() * (1.0 + kTaxRate); }

[[nodiscard]] auto lowStock(const std::map<std::string, int>& stock) {
    return stock
         | std::views::filter([](const auto& kv) { return kv.second < kReorderLevel; })
         | std::views::keys;
}

}  // namespace shop::inventory

int main() {
    using namespace shop::inventory;
    std::vector<std::unique_ptr<Item>> shelf;
    shelf.push_back(std::make_unique<Item>("TEA-00042", 18.50));
    shelf.push_back(std::make_unique<PerishableItem>("MLK-00007", 3.99, 1));

    std::map<std::string, int> stock{{"TEA-00042", 4}, {"MLK-00007", 120}, {"COF-00311", 0}};
    for (const auto& [sku, qty] : stock) {
        std::cout << std::format("{:<10} {:>4}\n", sku, qty);
    }

    const double threshold = 5.0;
    auto cheap = [&threshold](const auto& p) { return p->price() < threshold; };
    // TODO: replace with std::ranges::to once all compilers ship it
    for (const auto& item : shelf | std::views::filter(cheap)) {
        std::cout << std::format("cheap: {} @ ${:.2f}\n", item->sku(), withTax(*item));
    }

    for (auto sku : lowStock(stock)) std::cout << "reorder " << sku << '\n';
    std::cout << R"(report saved to "C:\reports\stock.csv")" << std::endl;
    return 0;
}
