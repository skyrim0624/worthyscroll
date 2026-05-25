import SwiftUI

struct SettingsView: View {
    var body: some View {
        List {
            Section("同步") {
                LabeledContent("内容源", value: "公众号 / X / Substack")
                LabeledContent("数据库", value: "Supabase")
            }

            Section("本机能力") {
                LabeledContent("App Group", value: AppGroupStore.identifier)
                LabeledContent("最低系统", value: "iOS 17")
            }
        }
        .navigationTitle("设置")
    }
}

#Preview {
    NavigationStack {
        SettingsView()
    }
}
