import SwiftUI

struct AppRootView: View {
    @State private var selectedTab: AppTab = .shelf

    var body: some View {
        TabView(selection: $selectedTab) {
            ForEach(AppTab.allCases) { tab in
                NavigationStack {
                    tab.contentView
                }
                .tabItem { tab.label }
                .tag(tab)
            }
        }
    }
}

#Preview {
    AppRootView()
}
