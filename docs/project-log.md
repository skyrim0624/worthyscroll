# WorthyScroll 项目日志

最后更新：2026-05-25  
当前阶段：原生 iOS MVP 启动  
主仓库：https://github.com/skyrim0624/worthyscroll

## 产品边界

WorthyScroll 第一版不是单纯的阅读器，也不是单纯的 App Blocker。它要把“堵”和“疏”合成一个 iOS 原生应用：

- 堵：实现类似 one sec 的六项核心能力，拦住视频号、小红书、YouTube Shorts 等目标入口。
- 疏：把 X、公众号、未来 Substack 等未读库存整理成更值得刷的内容流。
- 阅读：所有内容尽量在 App 内阅读，不把用户重新送回高诱惑平台。
- 数据：内容库存、阅读状态、反馈、推送、屏蔽会话统一进 Supabase。
- 原生：系统级屏蔽必须走 Xcode 原生能力和 Apple Screen Time 技术栈。

## 开发循环

每个功能块都按同一个循环推进：

1. 从本日志选择一个未完成功能块。
2. 如果并行开发，先创建独立分支或 worktree，分支名使用 `codex/<workstream>`。
3. 只修改该功能块声明的责任文件，跨块接口先写到共享模型或文档里。
4. 完成一个可验证的小步骤后运行对应检查。
5. 更新对应 `docs/workstreams/*.md` 的勾选状态。
6. 提交并推送。
7. 回到本日志更新总进度。

## 并行边界

为降低冲突，后续改动按文件所有权分块：

- `ios/WorthyScroll/**`：原生 iOS 主工程。
- `ios/WorthyScrollShared/**`：共享模型、App Group 存储、Supabase DTO。
- `ios/WorthyScrollBlocking/**`：FamilyControls、ManagedSettings、屏蔽策略。
- `ios/WorthyScrollShield/**`：Shield 配置和按钮动作扩展。
- `scripts/**`：Obsidian / 公众号 / Supabase 导入同步。
- `supabase/**`：数据库迁移、RLS、seed。
- `src/**`：Web 原型，只作为交互和数据导入验证环境。
- `docs/workstreams/**`：每个功能块自己的进度日志。

如果某一步必须跨块修改，先在提交说明里写清楚原因，并把接口变更同步到相关功能块日志。

## 总进度

- [x] P0 项目日志和并行开发框架
- [ ] P1 Xcode 原生工程外壳
- [ ] P2 共享模型与本地内容缓存
- [ ] P3 公众号未读库存同步到 App
- [ ] P4 App 内内容货架和阅读器
- [ ] P5 Screen Time 授权与目标 App 选择
- [ ] P6 Manual Block 和屏蔽配置
- [ ] P7 Shield 拦截页与 one sec 式摩擦
- [ ] P8 临时解锁、到点恢复和中途再拦
- [ ] P9 推送、提醒、阅读反馈
- [ ] P10 真机验证、权限申请和发布准备

## 当前阻塞

- 本机 `xcodebuild` 当前仍指向 Command Line Tools，不是完整 Xcode。可以先写工程文件和源码，但不能在本机完成 iOS build / simulator 验证。
- Screen Time / FamilyControls 属于 Apple 受限能力，最终需要 Apple Developer 账号、entitlement、App Group 和真机测试。

## 下一步

先做 P1：建立可打开的 iOS 原生工程外壳、模块目录和最小 SwiftUI App。由于当前没有完整 Xcode，P1 的验收先以文件结构、项目配置和静态检查为主；完整 build 验收等 Xcode 配好后补上。
