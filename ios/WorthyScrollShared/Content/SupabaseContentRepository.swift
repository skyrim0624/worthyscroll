import Foundation

struct SupabaseContentRepository: ContentRepository {
    private let config: SupabaseConfig
    private let accessTokenProvider: () -> String?
    private let session: URLSession
    private let decoder: JSONDecoder

    init(
        config: SupabaseConfig = .fromMainBundle(),
        accessTokenProvider: @escaping () -> String? = { SupabaseSessionStore.shared.accessToken },
        session: URLSession = .shared,
        decoder: JSONDecoder = JSONDecoder()
    ) {
        self.config = config
        self.accessTokenProvider = accessTokenProvider
        self.session = session
        self.decoder = decoder
    }

    func loadUnreadItems() async throws -> [ContentItem] {
        guard config.isConfigured else {
            throw ContentRepositoryError.supabaseConfigMissing
        }

        guard let accessToken = accessTokenProvider(), !accessToken.isEmpty else {
            throw ContentRepositoryError.supabaseSessionMissing
        }

        guard var components = URLComponents(url: config.url.appendingPathComponent("rest/v1/content_items"), resolvingAgainstBaseURL: false) else {
            throw ContentRepositoryError.invalidSupabaseURL
        }

        components.queryItems = [
            URLQueryItem(name: "select", value: "id,external_id,source_type,source_subtype,content_kind,title,source_name,author,original_url,saved_at,markdown,plain_text,excerpt,cover_image_url,estimated_minutes,word_count,status,metadata,updated_at"),
            URLQueryItem(name: "status", value: "eq.unread"),
            URLQueryItem(name: "order", value: "saved_at.desc.nullslast"),
            URLQueryItem(name: "limit", value: "100")
        ]

        guard let url = components.url else {
            throw ContentRepositoryError.invalidSupabaseURL
        }

        var request = URLRequest(url: url)
        request.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ContentRepositoryError.unexpectedStatusCode(-1)
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw ContentRepositoryError.unexpectedStatusCode(httpResponse.statusCode)
        }

        return try decoder.decode([SupabaseContentItemDTO].self, from: data).map(\.contentItem)
    }
}

struct SupabaseConfig {
    let url: URL
    let anonKey: String

    var isConfigured: Bool {
        anonKey.isEmpty == false
            && anonKey.contains("WORTHYSCROLL_SUPABASE_ANON_KEY") == false
            && url.absoluteString.contains("WORTHYSCROLL_SUPABASE_URL") == false
    }

    static func fromMainBundle(bundle: Bundle = .main) -> SupabaseConfig {
        let urlString = bundle.object(forInfoDictionaryKey: "WorthyScrollSupabaseURL") as? String ?? ""
        let anonKey = bundle.object(forInfoDictionaryKey: "WorthyScrollSupabaseAnonKey") as? String ?? ""
        let url = URL(string: urlString) ?? URL(string: "https://localhost")!
        return SupabaseConfig(url: url, anonKey: anonKey)
    }
}

final class SupabaseSessionStore {
    static let shared = SupabaseSessionStore()

    var accessToken: String? {
        AppGroupStore.userDefaults.string(forKey: "supabaseAccessToken")
    }

    private init() {}
}

private struct SupabaseContentItemDTO: Decodable {
    let id: String
    let externalID: String
    let sourceType: String
    let sourceSubtype: String?
    let contentKind: String
    let title: String
    let sourceName: String?
    let author: String?
    let originalURL: URL?
    let savedAt: String?
    let markdown: String?
    let plainText: String?
    let excerpt: String?
    let coverImageURL: String?
    let estimatedMinutes: Int
    let wordCount: Int
    let status: ReadingStatus
    let metadata: Metadata

    enum CodingKeys: String, CodingKey {
        case id
        case externalID = "external_id"
        case sourceType = "source_type"
        case sourceSubtype = "source_subtype"
        case contentKind = "content_kind"
        case title
        case sourceName = "source_name"
        case author
        case originalURL = "original_url"
        case savedAt = "saved_at"
        case markdown
        case plainText = "plain_text"
        case excerpt
        case coverImageURL = "cover_image_url"
        case estimatedMinutes = "estimated_minutes"
        case wordCount = "word_count"
        case status
        case metadata
    }

    var contentItem: ContentItem {
        ContentItem(
            id: externalID.isEmpty ? id : externalID,
            remoteID: id,
            title: title,
            sourceType: metadata.sourceSubtype.flatMap(ContentSource.init(rawValue:)) ?? mapSourceType(sourceType),
            sourceName: sourceName ?? sourceType,
            author: author,
            url: originalURL,
            savedAt: metadata.savedAtLabel ?? savedAt,
            savedAtRaw: savedAt,
            filePath: metadata.localFilePath,
            estimatedMinutes: estimatedMinutes,
            wordCount: wordCount,
            markdown: markdown,
            plainText: plainText,
            excerpt: excerpt ?? plainText?.prefix(260).description ?? title,
            status: status,
            visual: metadata.visual.flatMap(ContentVisual.init(rawValue:)) ?? mapVisual(contentKind)
        )
    }

    private func mapSourceType(_ value: String) -> ContentSource {
        switch value {
        case "wechat":
            return .wechatArticle
        case "x":
            return .xBookmark
        case "substack":
            return .substack
        default:
            return .wechatNote
        }
    }

    private func mapVisual(_ value: String) -> ContentVisual {
        switch value {
        case "video":
            return .video
        case "note", "bookmark", "thread":
            return .note
        default:
            return .document
        }
    }

    struct Metadata: Decodable {
        let localFilePath: String?
        let visual: String?
        let savedAtLabel: String?
        let sourceSubtype: String?
    }
}
