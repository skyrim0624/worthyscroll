import Foundation

struct DeviceInstallation: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    var platform: String
    var deviceName: String?
    var appVersion: String?
    var pushToken: String?
    var notificationsEnabled: Bool
    var lastSeenAt: Date

    init(
        id: UUID = UUID(),
        platform: String = "ios",
        deviceName: String? = nil,
        appVersion: String? = nil,
        pushToken: String? = nil,
        notificationsEnabled: Bool = false,
        lastSeenAt: Date = Date()
    ) {
        self.id = id
        self.platform = platform
        self.deviceName = deviceName
        self.appVersion = appVersion
        self.pushToken = pushToken
        self.notificationsEnabled = notificationsEnabled
        self.lastSeenAt = lastSeenAt
    }
}
