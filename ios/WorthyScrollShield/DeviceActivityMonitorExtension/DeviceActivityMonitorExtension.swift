import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings

final class DeviceActivityMonitorExtension: DeviceActivityMonitor {
    private let store = ManagedSettingsStore(named: .worthyScrollThreshold)
    private let decoder = JSONDecoder()

    override func intervalDidEnd(for activity: DeviceActivityName) {
        AppGroupStore.userDefaults.set(Date().timeIntervalSince1970, forKey: "lastDeviceActivityIntervalEndedAt")
        restoreManualShield(reason: "interval_ended")
    }

    override func eventDidReachThreshold(_ event: DeviceActivityEvent.Name, activity: DeviceActivityName) {
        AppGroupStore.userDefaults.set(Date().timeIntervalSince1970, forKey: "lastDeviceActivityThresholdAt")
        restoreManualShield(reason: "usage_threshold")
    }

    private func restoreManualShield(reason: String) {
        guard let data = AppGroupStore.userDefaults.data(forKey: "manualBlockSelection"),
              let selection = try? decoder.decode(FamilyActivitySelection.self, from: data) else {
            return
        }

        store.shield.applications = selection.applicationTokens.isEmpty ? nil : selection.applicationTokens
        store.shield.webDomains = selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens
        InterventionEventStore().record(
            InterventionEvent(eventType: .blockedAgain, metadata: ["reason": reason])
        )
    }
}

private extension ManagedSettingsStore.Name {
    static let worthyScrollThreshold = Self("worthyScroll.threshold")
}
