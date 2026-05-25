import Foundation

struct SupabaseEventClient {
    private let config: SupabaseConfig
    private let accessTokenProvider: () -> String?
    private let session: URLSession
    private let encoder = JSONEncoder()

    init(
        config: SupabaseConfig = .fromMainBundle(),
        accessTokenProvider: @escaping () -> String? = { SupabaseSessionStore.shared.accessToken },
        session: URLSession = .shared
    ) {
        self.config = config
        self.accessTokenProvider = accessTokenProvider
        self.session = session
    }

    func upsertDeviceInstallation(_ installation: DeviceInstallation) async throws {
        let row = DeviceInstallationRow(installation: installation)
        try await post(
            path: "device_installations",
            rows: [row],
            onConflict: "user_id,platform,push_token",
            prefer: "resolution=merge-duplicates,return=minimal"
        )
    }

    func upsertFeedback(_ feedback: ContentFeedback) async throws {
        guard let remoteItemID = feedback.remoteItemID else {
            return
        }
        let row = ContentFeedbackRow(feedback: feedback, remoteItemID: remoteItemID)
        try await post(
            path: "content_feedback",
            rows: [row],
            onConflict: "user_id,item_id",
            prefer: "resolution=merge-duplicates,return=minimal"
        )
    }

    private func post<T: Encodable>(
        path: String,
        rows: [T],
        onConflict: String,
        prefer: String
    ) async throws {
        guard config.isConfigured else {
            throw ContentRepositoryError.supabaseConfigMissing
        }
        guard let accessToken = accessTokenProvider(), accessToken.isEmpty == false else {
            throw ContentRepositoryError.supabaseSessionMissing
        }

        let endpoint = config.url
            .appendingPathComponent("rest")
            .appendingPathComponent("v1")
            .appendingPathComponent(path)
        guard var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false) else {
            throw ContentRepositoryError.invalidSupabaseURL
        }
        components.queryItems = [URLQueryItem(name: "on_conflict", value: onConflict)]
        guard let url = components.url else {
            throw ContentRepositoryError.invalidSupabaseURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = try encoder.encode(rows)
        request.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(prefer, forHTTPHeaderField: "Prefer")

        let (_, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200..<300).contains(httpResponse.statusCode) else {
            throw ContentRepositoryError.unexpectedStatusCode((response as? HTTPURLResponse)?.statusCode ?? -1)
        }
    }
}

private struct DeviceInstallationRow: Encodable {
    let platform: String
    let deviceName: String?
    let appVersion: String?
    let pushToken: String?
    let notificationsEnabled: Bool
    let lastSeenAt: String

    enum CodingKeys: String, CodingKey {
        case platform
        case deviceName = "device_name"
        case appVersion = "app_version"
        case pushToken = "push_token"
        case notificationsEnabled = "notifications_enabled"
        case lastSeenAt = "last_seen_at"
    }

    init(installation: DeviceInstallation) {
        self.platform = installation.platform
        self.deviceName = installation.deviceName
        self.appVersion = installation.appVersion
        self.pushToken = installation.pushToken
        self.notificationsEnabled = installation.notificationsEnabled
        self.lastSeenAt = ISO8601DateFormatter().string(from: installation.lastSeenAt)
    }
}

private struct ContentFeedbackRow: Encodable {
    let itemID: String
    let rating: Int
    let reason: String?

    enum CodingKeys: String, CodingKey {
        case itemID = "item_id"
        case rating
        case reason
    }

    init(feedback: ContentFeedback, remoteItemID: String) {
        self.itemID = remoteItemID
        self.rating = feedback.rating.rawValue
        self.reason = feedback.reason
    }
}
