# P10 真机验证、权限申请和发布准备

状态：进行中
建议分支：`codex/release-readiness`  
责任范围：`ios/project.yml`、`ios/WorthyScroll.xcodeproj/**`、`docs/workstreams/release-readiness.md`

## 目标

让 WorthyScroll 能被完整 Xcode 接手，并明确真机测试、Apple 权限、Supabase 云端、推送和发布前检查的剩余工作。

## 验收标准

- [x] 已安装 XcodeGen。
- [x] 已生成 `ios/WorthyScroll.xcodeproj`。
- [x] `project.yml` 能重复生成 Info.plist、entitlements 和 project。
- [x] plist / entitlements 静态校验通过。
- [ ] 完整 Xcode 下 `xcodebuild -list -project ios/WorthyScroll.xcodeproj` 通过。
- [ ] 真机上完成 FamilyControls 授权验证。
- [ ] 真机上完成 Manual Block / Shield / 临时解锁验证。
- [ ] Supabase 云项目创建并应用迁移。
- [ ] Apple Developer 后台配置 App Group、APNs、Family Controls entitlement。
- [ ] 成功提交并推送本功能块。

## 当前阻塞

- 本机 `xcodebuild` 仍指向 `/Library/Developer/CommandLineTools`，缺完整 Xcode。
- 本机 Docker CLI / Docker daemon 不可用，暂时不能跑本地 Supabase 数据库验证迁移。
- Supabase 新项目创建工具要求先确认组织和费用，不能静默创建。
- FamilyControls 是 Apple 受限 entitlement，需要在 Apple Developer 后台申请，通过前不能做完整发布验证。

## 完整 Xcode 配置

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
cd /Users/andreas/vibe\ coding/shortvideo/ios
xcodegen generate --spec project.yml
xcodebuild -list -project WorthyScroll.xcodeproj
```

## Apple Developer 配置清单

- Bundle ID：`com.skyrim0624.worthyscroll`
- Shield Configuration Extension：`com.skyrim0624.worthyscroll.shield-configuration`
- Shield Action Extension：`com.skyrim0624.worthyscroll.shield-action`
- Device Activity Monitor Extension：`com.skyrim0624.worthyscroll.device-activity-monitor`
- App Group：`group.com.skyrim0624.worthyscroll`
- Capabilities：App Groups、Family Controls、Push Notifications

## Supabase 配置清单

- 建议新项目名：`worthyscroll`
- 建议区域：`ap-southeast-1`
- 已知组织：`omuwwgbrsudtpzqsejmv`
- 需要迁移：
  - `20260525001842_init_worthyscroll_schema.sql`
  - `20260525014021_add_auth_uid_defaults.sql`
- iOS 配置变量：
  - `WORTHYSCROLL_SUPABASE_URL`
  - `WORTHYSCROLL_SUPABASE_ANON_KEY`
- 配置样例：`ios/Config/WorthyScroll.example.xcconfig`
- 当前 App 有开发期 Access Token 输入入口，正式版需要替换成 Supabase Auth 登录。

## 真机验证清单

- [ ] 首次打开 App，请求通知权限。
- [ ] 首次进入屏蔽页，请求 Screen Time 授权。
- [ ] 选择小红书、YouTube Shorts 或测试 App。
- [ ] 点击 Manual Block 后目标 App 出现 Shield。
- [ ] Shield 主按钮和副按钮能记录干预事件。
- [ ] 临时解锁 5 分钟后恢复屏蔽。
- [ ] 内容货架能打开 App 内阅读页。
- [ ] 喜欢 / 不喜欢 / 隐藏 / 已读能本地记录。
