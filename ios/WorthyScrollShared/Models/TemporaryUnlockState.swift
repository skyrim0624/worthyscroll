import Foundation

struct TemporaryUnlockState: Codable, Hashable, Sendable {
    var startedAt: Date
    var endsAt: Date
    var minutes: Int

    var isActive: Bool {
        Date() < endsAt
    }
}
