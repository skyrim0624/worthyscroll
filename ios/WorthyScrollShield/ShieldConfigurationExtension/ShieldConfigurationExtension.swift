import ManagedSettings
import ManagedSettingsUI
import UIKit

final class ShieldConfigurationExtension: ShieldConfigurationDataSource {
    override func configuration(shielding application: Application) -> ShieldConfiguration {
        ShieldConfiguration(
            backgroundBlurStyle: .systemMaterial,
            backgroundColor: UIColor.systemBackground,
            icon: UIImage(systemName: "hand.raised.fill"),
            title: ShieldConfiguration.Label(
                text: "先停一下",
                color: .label
            ),
            subtitle: ShieldConfiguration.Label(
                text: "这不是禁止娱乐，而是把这一刷换成更值得看的内容。",
                color: .secondaryLabel
            ),
            primaryButtonLabel: ShieldConfiguration.Label(
                text: "去 WorthyScroll",
                color: .white
            ),
            primaryButtonBackgroundColor: .systemIndigo,
            secondaryButtonLabel: ShieldConfiguration.Label(
                text: "暂时不打开",
                color: .systemIndigo
            )
        )
    }
}
