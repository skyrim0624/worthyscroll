import Foundation

struct BlockSessionStore {
    private let defaults: UserDefaults
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(defaults: UserDefaults = AppGroupStore.userDefaults) {
        self.defaults = defaults
    }

    func activeSession() -> BlockSession? {
        guard let data = defaults.data(forKey: "activeBlockSession") else {
            return nil
        }
        return try? decoder.decode(BlockSession.self, from: data)
    }

    func start(profile: BlockProfile, summary: BlockTargetSummary) -> BlockSession {
        let session = BlockSession(profile: profile, selectedTargetSummary: summary)
        saveActive(session)
        appendRecent(session)
        return session
    }

    func completeActiveSession() {
        guard var session = activeSession() else {
            return
        }
        session.status = .completed
        session.completedAt = Date()
        defaults.removeObject(forKey: "activeBlockSession")
        appendRecent(session)
    }

    private func saveActive(_ session: BlockSession) {
        guard let data = try? encoder.encode(session) else {
            return
        }
        defaults.set(data, forKey: "activeBlockSession")
    }

    private func appendRecent(_ session: BlockSession) {
        var sessions = recentSessions()
        sessions.removeAll { $0.id == session.id }
        sessions.insert(session, at: 0)
        if sessions.count > 50 {
            sessions = Array(sessions.prefix(50))
        }

        guard let data = try? encoder.encode(sessions) else {
            return
        }
        defaults.set(data, forKey: "recentBlockSessions")
    }

    func recentSessions() -> [BlockSession] {
        guard let data = defaults.data(forKey: "recentBlockSessions"),
              let sessions = try? decoder.decode([BlockSession].self, from: data) else {
            return []
        }
        return sessions
    }
}
