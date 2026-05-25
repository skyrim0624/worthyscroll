import Foundation
import ManagedSettings
import ManagedSettingsUI

final class ShieldActionExtension: ShieldActionDelegate {
    override func handle(action: ShieldAction, for application: ApplicationToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
        switch action {
        case .primaryButtonPressed:
            AppGroupStore.userDefaults.set(Date().timeIntervalSince1970, forKey: "lastShieldPrimaryActionAt")
            completionHandler(.close)
        case .secondaryButtonPressed:
            completionHandler(.close)
        @unknown default:
            completionHandler(.none)
        }
    }
}
