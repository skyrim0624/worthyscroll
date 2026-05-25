import Foundation

struct DeviceInstallationStore {
    private let defaults: UserDefaults
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(defaults: UserDefaults = AppGroupStore.userDefaults) {
        self.defaults = defaults
    }

    func installation() -> DeviceInstallation {
        let existing = loadInstallation()
        return DeviceInstallation(
            id: existing?.id ?? UUID(),
            platform: "ios",
            deviceName: existing?.deviceName,
            appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String,
            pushToken: existing?.pushToken,
            notificationsEnabled: existing?.notificationsEnabled ?? false,
            lastSeenAt: Date()
        )
    }

    func saveNotificationsEnabled(_ enabled: Bool) {
        var installation = self.installation()
        installation.notificationsEnabled = enabled
        save(installation)
    }

    func savePushToken(_ token: String) {
        var installation = self.installation()
        installation.pushToken = token
        installation.notificationsEnabled = true
        save(installation)
    }

    func savePushRegistrationError(_ message: String) {
        defaults.set(message, forKey: "pushRegistrationError")
    }

    private func loadInstallation() -> DeviceInstallation? {
        guard let data = defaults.data(forKey: "deviceInstallation") else {
            return nil
        }
        return try? decoder.decode(DeviceInstallation.self, from: data)
    }

    private func save(_ installation: DeviceInstallation) {
        guard let data = try? encoder.encode(installation) else {
            return
        }
        defaults.set(data, forKey: "deviceInstallation")
    }
}
