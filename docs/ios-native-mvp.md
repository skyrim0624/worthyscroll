# iOS 原生 MVP 架构

## 当前判断

第一版 MVP 应转向 Xcode 原生 App，而不是继续把 Web App 当最终形态。

原因不是“站内阅读”必须原生，站内阅读 Web 也能做；真正原因是产品需要系统级屏蔽其他 App，这必须走 Apple 的 Screen Time 技术栈，包括 FamilyControls、ManagedSettings、ManagedSettingsUI 和 DeviceActivity。

Web/React 版本继续保留，但定位降级为：

- 内容库存和站内阅读的交互原型。
- 公众号导入管道的本地验证环境。
- iOS 原生界面和数据结构的参考样板。

## Apple 能力边界

官方文档依据：

- Screen Time Technology Frameworks: https://developer.apple.com/documentation/ScreenTimeAPIDocumentation
- FamilyControls: https://developer.apple.com/documentation/familycontrols
- ManagedSettings: https://developer.apple.com/documentation/ManagedSettings
- ShieldSettings: https://developer.apple.com/documentation/managedsettings/shieldsettings
- ShieldActionDelegate: https://developer.apple.com/documentation/ManagedSettings/ShieldActionDelegate
- DeviceActivity: https://developer.apple.com/documentation/DeviceActivity

可做：

- 请求用户授权 Screen Time / Family Controls。
- 让用户通过系统选择器选择要屏蔽的 App、网站、类别。
- 用 ManagedSettingsStore 给选中的 App / 网站 / 类别加系统 Shield。
- 自定义 Shield 页面文案和按钮。
- 响应 Shield 上的按钮动作，例如关闭当前 App、延迟处理、刷新 Shield 展示。
- 用 DeviceActivity 做时间段监控、阈值提醒、刷到一半再拦一次、定时恢复屏蔽。

重要限制：

- App 拿不到被屏蔽 App 的真实身份，Apple 用 opaque token 保护隐私。
- 用户必须主动授权，不能静默监控或静默屏蔽。
- Family Controls entitlement 是受限权限，提交 App Store 前需要向 Apple 申请。
- 主 App、DeviceActivityMonitor Extension、ShieldConfiguration Extension、ShieldAction Extension 都要正确配置能力和 App Group。
- 不能把任意自定义界面直接盖在其他 App 上；系统会显示 Shield，App 只能配置 Shield 外观和处理有限动作。

## MVP 产品范围

第一版必须是一个集成应用：

- 我的收藏 / 未读库存。
- App 内阅读，不跳转外部平台。
- 内容推送或提醒。
- one sec 六个核心功能的原生实现。
- 对视频号、小红书、YouTube Shorts 等目标入口的系统级屏蔽。

## one sec 六个核心功能的原生映射

1. 打开前强制拦截  
   ManagedSettings Shield 覆盖目标 App / 网站。

2. 制造摩擦  
   ShieldConfiguration Extension 自定义 Shield 文案和按钮，例如暂停、呼吸、等待、确认。

3. 追问意图  
   Shield 上的主按钮进入本 App 的意图确认 / 内容替代页；受 iOS 限制，无法像普通页面一样直接嵌入复杂交互到 Shield 内。

4. 允许有边界地使用  
   主 App 里提供临时解锁，例如 5 / 10 / 15 分钟；通过 ManagedSettingsStore 临时移除 token，再由 DeviceActivityMonitor 到点恢复。

5. 刷着刷着再拦一次  
   DeviceActivityEvent 监听使用时长阈值，达到阈值后重新应用 Shield。

6. 硬封锁  
   Manual Block / Sleep Block / Focus Block 模式直接对选中 App 应用 Shield，不提供临时解锁或只提供强摩擦解锁。

## 目标工程结构

建议 Xcode workspace：

```text
ShortVideoDefense/
├── ShortVideoDefenseApp/              # SwiftUI 主 App
├── SharedModels/                      # App Group 共用模型、设置、存储
├── ContentShelf/                      # 收藏、未读、阅读器、推送
├── BlockingCore/                      # Screen Time 授权、选择器、屏蔽策略
├── DeviceActivityMonitorExtension/    # 定时、阈值、恢复屏蔽
├── ShieldConfigurationExtension/      # 自定义 Shield UI
├── ShieldActionExtension/             # Shield 按钮响应
└── AppGroupStore/                     # UserDefaults / 文件 / SQLite 共享存储
```

## 数据流

公众号第一版数据流：

1. 用户在微信把文章/视频转发给笔记同步助手。
2. Mac 上 Obsidian NoteHelper 同步到本地 Markdown。
3. 当前 `scripts/import-wechat-notes.py` 继续导入内容。
4. 后续把 SQLite/JSON 上传到云端内容表。
5. iOS App 拉取内容，缓存正文和图片，站内阅读。

X / Substack 后续走类似内容入库协议，先统一成 `ContentItem`：

- id
- title
- sourceType
- sourceName
- url
- savedAt
- markdown / plainText
- estimatedMinutes
- status
- feedback

## 第一阶段开发顺序

1. 创建 Xcode SwiftUI 工程，先做内容货架和站内阅读。
2. 加 FamilyControls 授权页和 FamilyActivityPicker。
3. 实现 Manual Block：用户选择 App 后，点按钮立即屏蔽。
4. 加 ShieldConfiguration Extension，显示自定义拦截页。
5. 加 ShieldAction Extension，把 Shield 主按钮动作接到关闭 / 延迟 / 引导回本 App。
6. 加临时解锁和 DeviceActivityMonitor，到点恢复屏蔽。
7. 加使用阈值，完成“刷着刷着再拦一次”。
8. 接内容推送 / 新内容提醒。

## 当前环境状态

当前机器的 `xcodebuild` 指向 Command Line Tools，不是完整 Xcode：

```text
xcode-select: active developer directory '/Library/Developer/CommandLineTools'
```

因此现在不能直接构建 iOS App 或启动模拟器。开始原生开发前需要：

1. 安装完整 Xcode。
2. 运行 `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`。
3. 打开 Xcode 登录 Apple Developer 账号。
4. 准备真机测试，因为 Screen Time / FamilyControls 相关能力通常不能只靠普通 Web 调试验证。

