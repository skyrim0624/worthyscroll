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
    @Published private(set) var temporaryUnlockState: TemporaryUnlockState?

    private let store = ManagedSettingsStore(named: .worthyScrollManual)
    private let selectionStore: BlockSelectionStore
    private let sessionStore: BlockSessionStore
    private let temporaryUnlockStore: TemporaryUnlockStore
    private let scheduleService: DeviceActivityScheduleService
    private let interventionEventStore: InterventionEventStore

    init(
        selectionStore: BlockSelectionStore = BlockSelectionStore(),
        sessionStore: BlockSessionStore = BlockSessionStore(),
        temporaryUnlockStore: TemporaryUnlockStore = TemporaryUnlockStore(),
        scheduleService: DeviceActivityScheduleService = DeviceActivityScheduleService(),
        interventionEventStore: InterventionEventStore = InterventionEventStore()
    ) {
        self.selectionStore = selectionStore
        self.sessionStore = sessionStore
        self.temporaryUnlockStore = temporaryUnlockStore
        self.scheduleService = scheduleService
        self.interventionEventStore = interventionEventStore
        let savedSelection = selectionStore.loadSelection()
        self.selection = savedSelection
        self.selectedTargetSummary = selectionStore.summary(for: savedSelection)
        self.activeSession = sessionStore.activeSession()
        self.temporaryUnlockState = temporaryUnlockStore.load()
    }

    func applyManualBlock() {
        applyShield()
        temporaryUnlockStore.clear()
        temporaryUnlockState = nil

        let profile = BlockProfile.manualDefault
        if let thresholdMinutes = profile.usageThresholdMinutes {
            try? scheduleService.startUsageThresholdMonitoring(minutes: thresholdMinutes, selection: selection)
        }

        activeSession = sessionStore.start(profile: profile, summary: selectedTargetSummary)
        interventionEventStore.record(
            InterventionEvent(eventType: .hardBlocked, metadata: ["profile": profile.name])
        )
    }

    func grantTemporaryUnlock(minutes: Int) {
        interventionEventStore.record(
            InterventionEvent(eventType: .temporaryUnlockRequested, durationSeconds: minutes * 60)
        )
        store.clearAllSettings()

        let state = TemporaryUnlockState(
            startedAt: Date(),
            endsAt: Date().addingTimeInterval(TimeInterval(minutes * 60)),
            minutes: minutes
        )
        temporaryUnlockStore.save(state)
        temporaryUnlockState = state
        try? scheduleService.scheduleTemporaryUnlock(minutes: minutes)

        interventionEventStore.record(
            InterventionEvent(eventType: .temporaryUnlockGranted, durationSeconds: minutes * 60)
        )
    }

    func restoreShieldIfUnlockExpired() {
        guard let state = temporaryUnlockStore.load() else {
            return
        }

        if state.isActive {
            temporaryUnlockState = state
            return
        }

        temporaryUnlockStore.clear()
        temporaryUnlockState = nil
        applyShield()
        interventionEventStore.record(
            InterventionEvent(eventType: .blockedAgain, metadata: ["reason": "temporary_unlock_expired"])
        )
    }

    func clearShield() {
        store.clearAllSettings()
        scheduleService.stopAll()
        temporaryUnlockStore.clear()
        temporaryUnlockState = nil
        sessionStore.completeActiveSession()
        activeSession = nil
    }

    private func applyShield() {
        store.shield.applications = selection.applicationTokens.isEmpty ? nil : selection.applicationTokens
        store.shield.webDomains = selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens
    }
}

private extension ManagedSettingsStore.Name {
    static let worthyScrollManual = Self("worthyScroll.manual")
}
