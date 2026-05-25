import Foundation

enum BlockSessionStatus: String, Codable, Sendable {
    case active
    case completed
    case cancelled
    case expired
}

struct BlockTargetSummary: Codable, Hashable, Sendable {
    var applications: Int
    var webDomains: Int
    var categories: Int

    var total: Int {
        applications + webDomains + categories
    }

    static let empty = BlockTargetSummary(applications: 0, webDomains: 0, categories: 0)
}

struct BlockSession: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    var profile: BlockProfile
    var status: BlockSessionStatus
    var startedAt: Date
    var completedAt: Date?
    var selectedTargetSummary: BlockTargetSummary

    init(
        id: UUID = UUID(),
        profile: BlockProfile,
        status: BlockSessionStatus = .active,
        startedAt: Date = Date(),
        completedAt: Date? = nil,
        selectedTargetSummary: BlockTargetSummary
    ) {
        self.id = id
        self.profile = profile
        self.status = status
        self.startedAt = startedAt
        self.completedAt = completedAt
        self.selectedTargetSummary = selectedTargetSummary
    }
}
