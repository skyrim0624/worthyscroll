import Foundation

@MainActor
final class ShelfViewModel: ObservableObject {
    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    @Published private(set) var items: [ContentItem] = []
    @Published private(set) var state: LoadState = .idle

    private let repository: ContentRepository

    init(repository: ContentRepository = BundledContentRepository()) {
        self.repository = repository
    }

    func load() async {
        state = .loading
        do {
            items = try await repository.loadUnreadItems()
            state = .loaded
        } catch {
            items = ContentItem.previewItems
            state = .failed("内容库存读取失败，已显示预览内容")
        }
    }
}
