# P1 Xcode 原生工程外壳

状态：进行中
建议分支：`codex/ios-shell`  
责任范围：`ios/**`、`docs/workstreams/ios-shell.md`

## 目标

建立 WorthyScroll 的 iOS 原生基础工程，让后续内容阅读、屏蔽能力、Shield 扩展可以分块接入。

## 验收标准

- [x] 仓库出现 `ios/` 工程目录。
- [x] 主 App 使用 SwiftUI，入口名为 `WorthyScrollApp`。
- [x] 工程预留 App Group、FamilyControls、ManagedSettings、DeviceActivity、Shield 扩展的目录和配置说明。
- [x] 已生成 `ios/WorthyScroll.xcodeproj`。
- [ ] 本机配置完整 Xcode 后，`xcodebuild` 能识别工程和 scheme。
- [x] 成功提交并推送本功能块。

## 步骤

- [x] 创建 iOS 工程目录结构。
- [x] 创建 SwiftUI 主 App、Tab 架构和占位页面。
- [x] 创建共享模型目录，先放最小 `ContentItem` 和 `BlockProfile`。
- [x] 创建扩展目录占位，明确后续 target 的职责。
- [x] 写入本机 Xcode 配置说明。
- [x] 更新本日志勾选状态并提交推送。

## 接口依赖

- 内容侧会提供 `ContentItem`。
- 屏蔽侧会提供 `BlockProfile`、`ShieldActionRequest`。
- 数据侧会提供 Supabase URL、匿名 key、当前用户身份。
