import Foundation

enum InterventionEventType: String, Codable, Sendable {
    case shieldSeen = "shield_seen"
    case frictionStarted = "friction_started"
    case frictionCompleted = "friction_completed"
    case intentPrompted = "intent_prompted"
    case temporaryUnlockRequested = "temporary_unlock_requested"
    case temporaryUnlockGranted = "temporary_unlock_granted"
    case blockedAgain = "blocked_again"
    case hardBlocked = "hard_blocked"
    case openedReplacementContent = "opened_replacement_content"
}

struct InterventionEvent: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    var eventType: InterventionEventType
    var durationSeconds: Int?
    var createdAt: Date
    var metadata: [String: String]

    init(
        id: UUID = UUID(),
        eventType: InterventionEventType,
        durationSeconds: Int? = nil,
        createdAt: Date = Date(),
        metadata: [String: String] = [:]
    ) {
        self.id = id
        self.eventType = eventType
        self.durationSeconds = durationSeconds
        self.createdAt = createdAt
        self.metadata = metadata
    }
}

struct InterventionEventStore {
    private let defaults: UserDefaults
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(defaults: UserDefaults = AppGroupStore.userDefaults) {
        self.defaults = defaults
    }

    func record(_ event: InterventionEvent) {
        var events = recentEvents()
        events.insert(event, at: 0)
        if events.count > 200 {
            events = Array(events.prefix(200))
        }
        guard let data = try? encoder.encode(events) else {
            return
        }
        defaults.set(data, forKey: "interventionEvents")
    }

    func recentEvents() -> [InterventionEvent] {
        guard let data = defaults.data(forKey: "interventionEvents"),
              let events = try? decoder.decode([InterventionEvent].self, from: data) else {
            return []
        }
        return events
    }
}
