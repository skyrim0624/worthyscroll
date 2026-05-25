import DeviceActivity
import FamilyControls
import Foundation

struct DeviceActivityScheduleService {
    private let center = DeviceActivityCenter()
    private let calendar = Calendar.current

    func scheduleTemporaryUnlock(minutes: Int) throws {
        let now = Date()
        let endDate = calendar.date(byAdding: .minute, value: minutes, to: now) ?? now.addingTimeInterval(TimeInterval(minutes * 60))
        let schedule = DeviceActivitySchedule(
            intervalStart: calendar.dateComponents([.hour, .minute, .second], from: now),
            intervalEnd: calendar.dateComponents([.hour, .minute, .second], from: endDate),
            repeats: false
        )
        try center.startMonitoring(.worthyScrollTemporaryUnlock, during: schedule)
    }

    func startUsageThresholdMonitoring(minutes: Int, selection: FamilyActivitySelection) throws {
        guard minutes > 0 else {
            return
        }

        let schedule = DeviceActivitySchedule(
            intervalStart: DateComponents(hour: 0, minute: 0),
            intervalEnd: DateComponents(hour: 23, minute: 59),
            repeats: true
        )
        let event = DeviceActivityEvent(
            applications: selection.applicationTokens,
            categories: selection.categoryTokens,
            webDomains: selection.webDomainTokens,
            threshold: DateComponents(minute: minutes)
        )
        try center.startMonitoring(
            .worthyScrollUsageThreshold,
            during: schedule,
            events: [.worthyScrollUsageThresholdReached: event]
        )
    }

    func stopAll() {
        center.stopMonitoring([.worthyScrollTemporaryUnlock, .worthyScrollUsageThreshold])
    }
}
