import Foundation

enum PushJobKind: String, Codable, Sendable {
    case newItem = "new_item"
    case unreadDigest = "unread_digest"
    case resumeReading = "resume_reading"
    case replacementPrompt = "replacement_prompt"
}

enum PushJobStatus: String, Codable, Sendable {
    case pending
    case sent
    case failed
    case skipped
    case cancelled
}

struct PushJob: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    var itemID: String?
    var kind: PushJobKind
    var status: PushJobStatus
    var scheduledAt: Date
    var sentAt: Date?

    init(
        id: UUID = UUID(),
        itemID: String? = nil,
        kind: PushJobKind,
        status: PushJobStatus = .pending,
        scheduledAt: Date = Date(),
        sentAt: Date? = nil
    ) {
        self.id = id
        self.itemID = itemID
        self.kind = kind
        self.status = status
        self.scheduledAt = scheduledAt
        self.sentAt = sentAt
    }
}
