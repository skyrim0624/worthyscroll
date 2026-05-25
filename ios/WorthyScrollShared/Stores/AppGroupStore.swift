import Foundation

enum AppGroupStore {
    static let identifier = "group.com.skyrim0624.worthyscroll"

    static var userDefaults: UserDefaults {
        guard let defaults = UserDefaults(suiteName: identifier) else {
            return .standard
        }
        return defaults
    }

    static var sharedDirectory: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: identifier)
    }
}
