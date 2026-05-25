import DeviceActivity
import Foundation
import ManagedSettings

final class DeviceActivityMonitorExtension: DeviceActivityMonitor {
    private let store = ManagedSettingsStore(named: .worthyScrollThreshold)

    override func intervalDidEnd(for activity: DeviceActivityName) {
        AppGroupStore.userDefaults.set(Date().timeIntervalSince1970, forKey: "lastDeviceActivityIntervalEndedAt")
        store.clearAllSettings()
    }

    override func eventDidReachThreshold(_ event: DeviceActivityEvent.Name, activity: DeviceActivityName) {
        AppGroupStore.userDefaults.set(Date().timeIntervalSince1970, forKey: "lastDeviceActivityThresholdAt")
    }
}

private extension ManagedSettingsStore.Name {
    static let worthyScrollThreshold = Self("worthyScroll.threshold")
}
