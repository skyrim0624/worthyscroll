import Foundation

enum BlockProfileMode: String, Codable, CaseIterable, Sendable {
    case manual
    case focus
    case sleep
    case strict
}

struct BlockProfile: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    var name: String
    var mode: BlockProfileMode
    var allowsTemporaryUnlock: Bool
    var temporaryUnlockMinutes: Int
    var usageThresholdMinutes: Int?

    init(
        id: UUID = UUID(),
        name: String,
        mode: BlockProfileMode,
        allowsTemporaryUnlock: Bool,
        temporaryUnlockMinutes: Int,
        usageThresholdMinutes: Int? = nil
    ) {
        self.id = id
        self.name = name
        self.mode = mode
        self.allowsTemporaryUnlock = allowsTemporaryUnlock
        self.temporaryUnlockMinutes = temporaryUnlockMinutes
        self.usageThresholdMinutes = usageThresholdMinutes
    }
}

extension BlockProfile {
    static let manualDefault = BlockProfile(
        name: "Manual Block",
        mode: .manual,
        allowsTemporaryUnlock: true,
        temporaryUnlockMinutes: 10,
        usageThresholdMinutes: nil
    )
}
