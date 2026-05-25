import Foundation

protocol ContentRepository {
    func loadUnreadItems() async throws -> [ContentItem]
}

enum ContentRepositoryError: LocalizedError {
    case supabaseConfigMissing
    case supabaseSessionMissing
    case invalidSupabaseURL
    case unexpectedStatusCode(Int)

    var errorDescription: String? {
        switch self {
        case .supabaseConfigMissing:
            return "Supabase 配置缺失"
        case .supabaseSessionMissing:
            return "Supabase 登录态缺失"
        case .invalidSupabaseURL:
            return "Supabase URL 无效"
        case .unexpectedStatusCode(let statusCode):
            return "Supabase 返回异常状态码：\(statusCode)"
        }
    }
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

struct CachedContentRepository: ContentRepository {
    private let remoteRepository: ContentRepository
    private let fallbackRepository: ContentRepository
    private let cacheStore: ContentCacheStore

    init(
        remoteRepository: ContentRepository = SupabaseContentRepository(),
        fallbackRepository: ContentRepository = BundledContentRepository(),
        cacheStore: ContentCacheStore = ContentCacheStore()
    ) {
        self.remoteRepository = remoteRepository
        self.fallbackRepository = fallbackRepository
        self.cacheStore = cacheStore
    }

    func loadUnreadItems() async throws -> [ContentItem] {
        do {
            let remoteItems = try await remoteRepository.loadUnreadItems()
            try cacheStore.save(remoteItems)
            return remoteItems
        } catch {
            if let cachedItems = try? cacheStore.load(), !cachedItems.isEmpty {
                return cachedItems
            }
            return try await fallbackRepository.loadUnreadItems()
        }
    }
}
