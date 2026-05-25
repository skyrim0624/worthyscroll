import FamilyControls
import Foundation
import ManagedSettings

@MainActor
final class BlockStore: ObservableObject {
    @Published var selection = FamilyActivitySelection()

    private let store = ManagedSettingsStore(named: .worthyScrollManual)

    func applyManualBlock() {
        store.shield.applications = selection.applicationTokens.isEmpty ? nil : selection.applicationTokens
        store.shield.webDomains = selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens
        persistSelectionSummary()
    }

    func clearShield() {
        store.clearAllSettings()
    }

    private func persistSelectionSummary() {
        let summary = [
            "applications": selection.applicationTokens.count,
            "webDomains": selection.webDomainTokens.count,
            "categories": selection.categoryTokens.count
        ]
        AppGroupStore.userDefaults.set(summary, forKey: "manualBlockSelectionSummary")
    }
}

private extension ManagedSettingsStore.Name {
    static let worthyScrollManual = Self("worthyScroll.manual")
}
