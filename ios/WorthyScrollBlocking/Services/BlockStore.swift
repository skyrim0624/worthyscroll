import FamilyControls
import Foundation
import ManagedSettings

@MainActor
final class BlockStore: ObservableObject {
    @Published var selection: FamilyActivitySelection {
        didSet {
            selectionStore.saveSelection(selection)
            selectedTargetSummary = selectionStore.summary(for: selection)
        }
    }

    @Published private(set) var selectedTargetSummary: BlockTargetSummary
    @Published private(set) var activeSession: BlockSession?

    private let store = ManagedSettingsStore(named: .worthyScrollManual)
    private let selectionStore: BlockSelectionStore
    private let sessionStore: BlockSessionStore

    init(
        selectionStore: BlockSelectionStore = BlockSelectionStore(),
        sessionStore: BlockSessionStore = BlockSessionStore()
    ) {
        self.selectionStore = selectionStore
        self.sessionStore = sessionStore
        let savedSelection = selectionStore.loadSelection()
        self.selection = savedSelection
        self.selectedTargetSummary = selectionStore.summary(for: savedSelection)
        self.activeSession = sessionStore.activeSession()
    }

    func applyManualBlock() {
        store.shield.applications = selection.applicationTokens.isEmpty ? nil : selection.applicationTokens
        store.shield.webDomains = selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens

        let profile = BlockProfile.manualDefault
        activeSession = sessionStore.start(profile: profile, summary: selectedTargetSummary)
    }

    func clearShield() {
        store.clearAllSettings()
        sessionStore.completeActiveSession()
        activeSession = nil
    }
}

private extension ManagedSettingsStore.Name {
    static let worthyScrollManual = Self("worthyScroll.manual")
}
