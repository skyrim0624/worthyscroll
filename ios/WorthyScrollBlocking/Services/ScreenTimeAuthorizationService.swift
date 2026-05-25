import FamilyControls
import Foundation

enum ScreenTimeAuthorizationState: String {
    case notDetermined
    case denied
    case approved
    case unknown

    var label: String {
        switch self {
        case .notDetermined:
            return "未请求"
        case .denied:
            return "已拒绝"
        case .approved:
            return "已授权"
        case .unknown:
            return "未知"
        }
    }
}

@MainActor
final class ScreenTimeAuthorizationService: ObservableObject {
    @Published private(set) var state: ScreenTimeAuthorizationState = .notDetermined

    func refreshAuthorizationState() {
        state = Self.mapStatus(AuthorizationCenter.shared.authorizationStatus)
    }

    func requestAuthorization() async {
        do {
            try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
            refreshAuthorizationState()
        } catch {
            refreshAuthorizationState()
        }
    }

    private static func mapStatus(_ status: FamilyControls.AuthorizationStatus) -> ScreenTimeAuthorizationState {
        switch status {
        case .notDetermined:
            return .notDetermined
        case .denied:
            return .denied
        case .approved:
            return .approved
        @unknown default:
            return .unknown
        }
    }
}
