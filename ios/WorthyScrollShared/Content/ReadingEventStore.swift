import Foundation

enum ReadingEventType: String, Codable, Sendable {
    case opened
    case started
    case progressed
    case completed
    case markedRead
    case archived
}

struct ReadingEvent: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    var itemID: String
    var eventType: ReadingEventType
    var progressRatio: Double?
    var createdAt: Date

    init(
        id: UUID = UUID(),
        itemID: String,
        eventType: ReadingEventType,
        progressRatio: Double? = nil,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.itemID = itemID
        self.eventType = eventType
        self.progressRatio = progressRatio
        self.createdAt = createdAt
    }
}

struct ReadingEventStore {
    private let defaults: UserDefaults
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(defaults: UserDefaults = AppGroupStore.userDefaults) {
        self.defaults = defaults
    }

    func status(for itemID: String) -> ReadingStatus? {
        guard let rawValue = statusMap()[itemID] else {
            return nil
        }
        return ReadingStatus(rawValue: rawValue)
    }

    func progress(for itemID: String) -> Double {
        progressMap()[itemID] ?? 0
    }

    func applyLocalState(to items: [ContentItem]) -> [ContentItem] {
        items.map { item in
            var copy = item
            if let status = status(for: item.id) {
                copy.status = status
            }
            return copy
        }
    }

    func record(_ event: ReadingEvent) {
        var events = recentEvents()
        events.insert(event, at: 0)
        if events.count > 200 {
            events = Array(events.prefix(200))
        }

        if let data = try? encoder.encode(events) {
            defaults.set(data, forKey: "readingEvents")
        }

        if let progressRatio = event.progressRatio {
            setProgress(progressRatio, for: event.itemID)
        }

        switch event.eventType {
        case .completed, .markedRead:
            setStatus(.read, for: event.itemID)
        case .archived:
            setStatus(.archived, for: event.itemID)
        default:
            break
        }
    }

    func recentEvents() -> [ReadingEvent] {
        guard let data = defaults.data(forKey: "readingEvents"),
              let events = try? decoder.decode([ReadingEvent].self, from: data) else {
            return []
        }
        return events
    }

    private func setStatus(_ status: ReadingStatus, for itemID: String) {
        var map = statusMap()
        map[itemID] = status.rawValue
        defaults.set(map, forKey: "readingStatusByItemID")
    }

    private func statusMap() -> [String: String] {
        defaults.dictionary(forKey: "readingStatusByItemID") as? [String: String] ?? [:]
    }

    private func setProgress(_ progress: Double, for itemID: String) {
        var map = progressMap()
        map[itemID] = min(1, max(0, progress))
        defaults.set(map, forKey: "readingProgressByItemID")
    }

    private func progressMap() -> [String: Double] {
        defaults.dictionary(forKey: "readingProgressByItemID") as? [String: Double] ?? [:]
    }
}
