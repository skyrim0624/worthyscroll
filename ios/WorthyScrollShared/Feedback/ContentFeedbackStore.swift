import Foundation

struct ContentFeedbackStore {
    private let defaults: UserDefaults
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(defaults: UserDefaults = AppGroupStore.userDefaults) {
        self.defaults = defaults
    }

    func record(_ feedback: ContentFeedback) {
        var feedbackItems = allFeedback()
        feedbackItems.removeAll { $0.itemID == feedback.itemID }
        feedbackItems.insert(feedback, at: 0)
        guard let data = try? encoder.encode(feedbackItems) else {
            return
        }
        defaults.set(data, forKey: "contentFeedback")
    }

    func allFeedback() -> [ContentFeedback] {
        guard let data = defaults.data(forKey: "contentFeedback"),
              let feedback = try? decoder.decode([ContentFeedback].self, from: data) else {
            return []
        }
        return feedback
    }
}
