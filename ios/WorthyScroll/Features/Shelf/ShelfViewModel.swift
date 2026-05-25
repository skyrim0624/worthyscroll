import Foundation

@MainActor
final class ShelfViewModel: ObservableObject {
    enum SourceFilter: String, CaseIterable, Identifiable {
        case all
        case wechatArticle
        case wechatVideo
        case xBookmark
        case substack

        var id: String { rawValue }

        var label: String {
            switch self {
            case .all:
                return "全部"
            case .wechatArticle:
                return "公众号"
            case .wechatVideo:
                return "视频号"
            case .xBookmark:
                return "X"
            case .substack:
                return "Substack"
            }
        }

        var source: ContentSource? {
            switch self {
            case .all:
                return nil
            case .wechatArticle:
                return .wechatArticle
            case .wechatVideo:
                return .wechatVideo
            case .xBookmark:
                return .xBookmark
            case .substack:
                return .substack
            }
        }
    }

    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    @Published private(set) var items: [ContentItem] = []
    @Published private(set) var state: LoadState = .idle
    @Published var query = ""
    @Published var sourceFilter: SourceFilter = .all
    @Published var hidesReadItems = true

    private let repository: ContentRepository
    private let readingEventStore: ReadingEventStore
    private let feedbackStore: ContentFeedbackStore
    private let supabaseEventClient: SupabaseEventClient

    var filteredItems: [ContentItem] {
        items.filter { item in
            if hidesReadItems, item.status == .read || item.status == .archived {
                return false
            }

            if let source = sourceFilter.source, item.sourceType != source {
                return false
            }

            let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmedQuery.isEmpty {
                return true
            }

            return item.title.localizedCaseInsensitiveContains(trimmedQuery)
                || item.excerpt.localizedCaseInsensitiveContains(trimmedQuery)
                || item.sourceName.localizedCaseInsensitiveContains(trimmedQuery)
                || (item.author?.localizedCaseInsensitiveContains(trimmedQuery) ?? false)
        }
    }

    init(
        repository: ContentRepository = CachedContentRepository(),
        readingEventStore: ReadingEventStore = ReadingEventStore(),
        feedbackStore: ContentFeedbackStore = ContentFeedbackStore(),
        supabaseEventClient: SupabaseEventClient = SupabaseEventClient()
    ) {
        self.repository = repository
        self.readingEventStore = readingEventStore
        self.feedbackStore = feedbackStore
        self.supabaseEventClient = supabaseEventClient
    }

    func load() async {
        state = .loading
        do {
            items = readingEventStore.applyLocalState(to: try await repository.loadUnreadItems())
            state = .loaded
        } catch {
            items = readingEventStore.applyLocalState(to: ContentItem.previewItems)
            state = .failed("内容库存读取失败，已显示预览内容")
        }
    }

    func markRead(_ item: ContentItem) {
        readingEventStore.record(
            ReadingEvent(itemID: item.id, eventType: .markedRead, progressRatio: 1)
        )

        items = items.map { currentItem in
            guard currentItem.id == item.id else {
                return currentItem
            }
            var copy = currentItem
            copy.status = .read
            return copy
        }
    }

    func giveFeedback(_ item: ContentItem, rating: FeedbackRating) {
        let feedback = ContentFeedback(
            itemID: item.id,
            remoteItemID: item.remoteID,
            rating: rating
        )
        feedbackStore.record(feedback)

        Task {
            try? await supabaseEventClient.upsertFeedback(feedback)
        }
    }

    func archive(_ item: ContentItem) {
        readingEventStore.record(
            ReadingEvent(itemID: item.id, eventType: .archived, progressRatio: nil)
        )

        items = items.map { currentItem in
            guard currentItem.id == item.id else {
                return currentItem
            }
            var copy = currentItem
            copy.status = .archived
            return copy
        }
    }
}
