import FamilyControls
import SwiftUI

struct BlockDashboardView: View {
    @StateObject private var authorizationService = ScreenTimeAuthorizationService()
    @StateObject private var blockStore = BlockStore()
    @State private var isPickerPresented = false

    var body: some View {
        List {
            Section {
                LabeledContent("授权状态", value: authorizationService.state.label)

                Button("请求 Screen Time 授权") {
                    Task {
                        await authorizationService.requestAuthorization()
                    }
                }

                Button("选择要屏蔽的 App 和网站") {
                    isPickerPresented = true
                }
            } header: {
                Text("目标")
            } footer: {
                Text("已选择 \(blockStore.selectedTargetSummary.total) 个目标，其中 App \(blockStore.selectedTargetSummary.applications) 个，网站 \(blockStore.selectedTargetSummary.webDomains) 个，类别 \(blockStore.selectedTargetSummary.categories) 个。")
            }

            Section {
                Button("开始 Manual Block") {
                    blockStore.applyManualBlock()
                }
                .buttonStyle(.borderedProminent)
                .disabled(blockStore.selectedTargetSummary.total == 0)

                Button("停止屏蔽", role: .destructive) {
                    blockStore.clearShield()
                }

                if let session = blockStore.activeSession {
                    LabeledContent("当前会话", value: session.profile.name)
                    LabeledContent("屏蔽目标", value: "\(session.selectedTargetSummary.total) 个")
                }
            } header: {
                Text("屏蔽")
            } footer: {
                Text("第一版先做手动屏蔽。临时解锁、睡眠模式和阈值恢复会在 Shield 功能块接入。")
            }
        }
        .navigationTitle("屏蔽")
        .familyActivityPicker(isPresented: $isPickerPresented, selection: $blockStore.selection)
        .task {
            authorizationService.refreshAuthorizationState()
        }
    }
}

#Preview {
    NavigationStack {
        BlockDashboardView()
    }
}
