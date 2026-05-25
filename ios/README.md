# WorthyScroll iOS

这是 WorthyScroll 的原生 iOS 主线。Web 原型继续用于验证内容库存和阅读交互，最终具备系统级屏蔽能力的版本在这里推进。

## 当前状态

当前仓库先提供 XcodeGen 配置和 Swift 源码骨架。由于本机还没有切到完整 Xcode，暂时不能运行 `xcodebuild` 验证。

完整 Xcode 配好后执行：

```bash
cd ios
xcodegen generate
open WorthyScroll.xcodeproj
```

如果本机没有 XcodeGen，可以先安装：

```bash
brew install xcodegen
```

## 能力边界

系统级屏蔽依赖 Apple Screen Time 技术栈：

- `FamilyControls`：请求授权和选择要屏蔽的 App / 网站。
- `ManagedSettings`：对选择的目标应用系统 Shield。
- `ManagedSettingsUI`：自定义 Shield 页面。
- `DeviceActivity`：做时间段、阈值和恢复屏蔽。

这些能力需要 Apple Developer 账号、受限 entitlement、App Group，并且最终要在真机上验证。
