import SwiftUI

struct LineItem: Identifiable, Hashable, Codable {
    let id: UUID
    var sku: String
    var quantity: Int
    var unitPrice: Decimal
}

protocol OrderFetching {
    func fetchOrder(reference: String) async throws -> [LineItem]
}

enum OrderError: LocalizedError {
    case invalidReference(String), network(underlying: Error)
    var errorDescription: String? {
        switch self {
        case .invalidReference(let ref): "Invalid order reference \"\(ref)\""
        case .network(let err): "Network error: \(err.localizedDescription)"
        }
    }
}

@Observable
final class OrderModel<Service: OrderFetching> {
    static var taxRate: Decimal { 0.0825 }
    private let referencePattern = /^ORD-\d{8}$/
    var items: [LineItem] = []
    var error: OrderError?
    var isLoading = false
    private let service: Service

    init(service: Service) { self.service = service }

    var total: Decimal {
        items.reduce(0) { $0 + $1.unitPrice * Decimal($1.quantity) } * (1 + Self.taxRate)
    }

    @MainActor
    func load(_ reference: String) async {
        guard reference.wholeMatch(of: referencePattern) != nil else {
            error = .invalidReference(reference)
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            items = try await service.fetchOrder(reference: reference)
        } catch {
            self.error = .network(underlying: error)  // TODO: add retry with backoff
        }
    }
}

struct OrderView<Service: OrderFetching>: View {
    let reference: String
    @State var model: OrderModel<Service>
    @Binding var showsReceipt: Bool

    var body: some View {
        List {
            ForEach(model.items) { item in
                HStack {
                    Text(item.sku).font(.system(.body, design: .monospaced))
                    Spacer()
                    Text("\(item.quantity) × \(item.unitPrice, format: .currency(code: "USD"))")
                }
            }
            if let message = model.error?.errorDescription {
                Label(message, systemImage: "exclamationmark.triangle").foregroundStyle(.red)
            }
        }
        .navigationTitle("Order \(reference)")
        .toolbar { Button("Receipt") { showsReceipt.toggle() } }
        .task { await model.load(reference) }
    }
}
