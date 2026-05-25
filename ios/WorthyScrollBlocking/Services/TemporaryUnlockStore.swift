import Foundation

struct TemporaryUnlockStore {
    private let defaults: UserDefaults
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(defaults: UserDefaults = AppGroupStore.userDefaults) {
        self.defaults = defaults
    }

    func load() -> TemporaryUnlockState? {
        guard let data = defaults.data(forKey: "temporaryUnlockState") else {
            return nil
        }
        return try? decoder.decode(TemporaryUnlockState.self, from: data)
    }

    func save(_ state: TemporaryUnlockState) {
        guard let data = try? encoder.encode(state) else {
            return
        }
        defaults.set(data, forKey: "temporaryUnlockState")
    }

    func clear() {
        defaults.removeObject(forKey: "temporaryUnlockState")
    }
}
