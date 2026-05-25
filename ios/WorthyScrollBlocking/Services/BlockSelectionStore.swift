import FamilyControls
import Foundation

struct BlockSelectionStore {
    private let defaults: UserDefaults
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(defaults: UserDefaults = AppGroupStore.userDefaults) {
        self.defaults = defaults
    }

    func loadSelection() -> FamilyActivitySelection {
        guard let data = defaults.data(forKey: "manualBlockSelection"),
              let selection = try? decoder.decode(FamilyActivitySelection.self, from: data) else {
            return FamilyActivitySelection()
        }
        return selection
    }

    func saveSelection(_ selection: FamilyActivitySelection) {
        guard let data = try? encoder.encode(selection) else {
            return
        }
        defaults.set(data, forKey: "manualBlockSelection")
        saveSummary(summary(for: selection))
    }

    func loadSummary() -> BlockTargetSummary {
        guard let data = defaults.data(forKey: "manualBlockSelectionSummary"),
              let summary = try? decoder.decode(BlockTargetSummary.self, from: data) else {
            return .empty
        }
        return summary
    }

    func summary(for selection: FamilyActivitySelection) -> BlockTargetSummary {
        BlockTargetSummary(
            applications: selection.applicationTokens.count,
            webDomains: selection.webDomainTokens.count,
            categories: selection.categoryTokens.count
        )
    }

    private func saveSummary(_ summary: BlockTargetSummary) {
        guard let data = try? encoder.encode(summary) else {
            return
        }
        defaults.set(data, forKey: "manualBlockSelectionSummary")
    }
}
