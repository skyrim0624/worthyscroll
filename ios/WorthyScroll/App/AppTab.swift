import SwiftUI

enum AppTab: String, CaseIterable, Identifiable {
    case shelf
    case blocking
    case settings

    var id: String { rawValue }

    @ViewBuilder
    var contentView: some View {
        switch self {
        case .shelf:
            ShelfView()
        case .blocking:
            BlockDashboardView()
        case .settings:
            SettingsView()
        }
    }

    @ViewBuilder
    var label: some View {
        switch self {
        case .shelf:
            Label("库存", systemImage: "books.vertical")
        case .blocking:
            Label("屏蔽", systemImage: "hand.raised")
        case .settings:
            Label("设置", systemImage: "gearshape")
        }
    }
}
