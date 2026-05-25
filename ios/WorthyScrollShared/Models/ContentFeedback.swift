import Foundation

enum FeedbackRating: Int, Codable, Sendable {
    case disliked = -1
    case neutral = 0
    case liked = 1
}

struct ContentFeedback: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    var itemID: String
    var remoteItemID: String?
    var rating: FeedbackRating
    var reason: String?
    var createdAt: Date

    init(
        id: UUID = UUID(),
        itemID: String,
        remoteItemID: String? = nil,
        rating: FeedbackRating,
        reason: String? = nil,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.itemID = itemID
        self.remoteItemID = remoteItemID
        self.rating = rating
        self.reason = reason
        self.createdAt = createdAt
    }
}
