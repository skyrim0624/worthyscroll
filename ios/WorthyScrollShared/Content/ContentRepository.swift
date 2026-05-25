import Foundation

protocol ContentRepository {
    func loadUnreadItems() async throws -> [ContentItem]
}

struct BundledContentRepository: ContentRepository {
    private let bundle: Bundle
    private let decoder: JSONDecoder

    init(bundle: Bundle = .main, decoder: JSONDecoder = JSONDecoder()) {
        self.bundle = bundle
        self.decoder = decoder
    }

    func loadUnreadItems() async throws -> [ContentItem] {
        let items = try loadBundledItems()
        return items
            .filter { $0.status == .unread }
            .sorted { lhs, rhs in
                (lhs.savedAtRaw ?? lhs.savedAt ?? "") > (rhs.savedAtRaw ?? rhs.savedAt ?? "")
            }
    }

    private func loadBundledItems() throws -> [ContentItem] {
        guard let url = bundle.url(forResource: "content-items", withExtension: "json")
            ?? bundle.url(forResource: "content-items.sample", withExtension: "json")
        else {
            return ContentItem.previewItems
        }

        let data = try Data(contentsOf: url)
        return try decoder.decode([ContentItem].self, from: data)
    }
}
