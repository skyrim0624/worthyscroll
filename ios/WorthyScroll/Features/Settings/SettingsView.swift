import SwiftUI
import UserNotifications

struct SettingsView: View {
    @StateObject private var pushNotificationService = PushNotificationService()
    private let deviceInstallationStore = DeviceInstallationStore()
    private let supabaseEventClient = SupabaseEventClient()

    var body: some View {
        List {
            Section("同步") {
                LabeledContent("内容源", value: "公众号 / X / Substack")
                LabeledContent("数据库", value: "Supabase")
            }

            Section("推送") {
                LabeledContent("通知权限", value: pushNotificationService.authorizationStatus.label)

                Button("开启推送") {
                    Task {
                        await pushNotificationService.requestAuthorizationAndRegister()
                        try? await supabaseEventClient.upsertDeviceInstallation(deviceInstallationStore.installation())
                    }
                }
            }

            Section("本机能力") {
                LabeledContent("App Group", value: AppGroupStore.identifier)
                LabeledContent("最低系统", value: "iOS 17")
            }
        }
        .navigationTitle("设置")
        .task {
            await pushNotificationService.refreshAuthorizationStatus()
        }
    }
}

private extension UNAuthorizationStatus {
    var label: String {
        switch self {
        case .notDetermined:
            return "未请求"
        case .denied:
            return "已拒绝"
        case .authorized:
            return "已开启"
        case .provisional:
            return "临时授权"
        case .ephemeral:
            return "临时会话"
        @unknown default:
            return "未知"
        }
    }
}

#Preview {
    NavigationStack {
        SettingsView()
    }
}
