import Foundation

struct ContentCacheStore {
    private let fileURL: URL
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    init(
        fileURL: URL? = nil,
        encoder: JSONEncoder = JSONEncoder(),
        decoder: JSONDecoder = JSONDecoder()
    ) {
        self.fileURL = fileURL ?? Self.defaultFileURL()
        self.encoder = encoder
        self.decoder = decoder
    }

    func load() throws -> [ContentItem] {
        let data = try Data(contentsOf: fileURL)
        return try decoder.decode([ContentItem].self, from: data)
    }

    func save(_ items: [ContentItem]) throws {
        let directoryURL = fileURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
        let data = try encoder.encode(items)
        try data.write(to: fileURL, options: [.atomic])
    }

    private static func defaultFileURL() -> URL {
        let baseURL = AppGroupStore.sharedDirectory
            ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return baseURL
            .appendingPathComponent("content-cache", isDirectory: true)
            .appendingPathComponent("unread-items.json")
    }
}
