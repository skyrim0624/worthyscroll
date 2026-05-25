import Foundation
import UIKit
import UserNotifications

@MainActor
final class PushNotificationService: ObservableObject {
    @Published private(set) var authorizationStatus: UNAuthorizationStatus = .notDetermined

    private let center: UNUserNotificationCenter
    private let installationStore: DeviceInstallationStore

    init(
        center: UNUserNotificationCenter = .current(),
        installationStore: DeviceInstallationStore = DeviceInstallationStore()
    ) {
        self.center = center
        self.installationStore = installationStore
    }

    func refreshAuthorizationStatus() async {
        let settings = await center.notificationSettings()
        authorizationStatus = settings.authorizationStatus
        installationStore.saveNotificationsEnabled(settings.authorizationStatus == .authorized)
    }

    func requestAuthorizationAndRegister() async {
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
            installationStore.saveNotificationsEnabled(granted)
            authorizationStatus = granted ? .authorized : .denied
            if granted {
                UIApplication.shared.registerForRemoteNotifications()
            }
        } catch {
            authorizationStatus = .denied
            installationStore.savePushRegistrationError(error.localizedDescription)
        }
    }

    func scheduleLocalUnreadReminder(item: ContentItem) async throws {
        let content = UNMutableNotificationContent()
        content.title = "现在刷点好的"
        content.body = item.title
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: "worthy-scroll-\(item.id)",
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: 5, repeats: false)
        )
        try await center.add(request)
    }
}
