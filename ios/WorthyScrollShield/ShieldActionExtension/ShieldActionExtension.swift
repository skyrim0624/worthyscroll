import Foundation
import ManagedSettings
import ManagedSettingsUI

final class ShieldActionExtension: ShieldActionDelegate {
    override func handle(action: ShieldAction, for application: ApplicationToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
        switch action {
        case .primaryButtonPressed:
            AppGroupStore.userDefaults.set(Date().timeIntervalSince1970, forKey: "lastShieldPrimaryActionAt")
            InterventionEventStore().record(
                InterventionEvent(eventType: .openedReplacementContent, metadata: ["source": "shield_primary_button"])
            )
            completionHandler(.close)
        case .secondaryButtonPressed:
            InterventionEventStore().record(
                InterventionEvent(eventType: .frictionCompleted, metadata: ["source": "shield_secondary_button"])
            )
            completionHandler(.close)
        @unknown default:
            completionHandler(.none)
        }
    }
}
