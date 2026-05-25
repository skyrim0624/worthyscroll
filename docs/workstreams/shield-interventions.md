# P7/P8 Shield 拦截、摩擦、临时解锁和中途再拦

状态：未开始  
建议分支：`codex/shield-interventions`  
责任范围：`ios/WorthyScrollShield/**`、`ios/WorthyScrollBlocking/**`、`docs/workstreams/shield-interventions.md`

## 目标

把 one sec 的六项核心能力落到 iOS 原生系统能力上，同时把用户导回 WorthyScroll 的高质量内容流。

## one sec 六项核心映射

- [ ] 打开前强制拦截：ManagedSettings Shield。
- [ ] 制造摩擦：Shield 文案、按钮、等待、呼吸。
- [ ] 追问意图：Shield 动作引导回主 App 的意图确认页。
- [ ] 有边界地使用：临时解锁 5 / 10 / 15 分钟。
- [ ] 刷着刷着再拦一次：DeviceActivity 阈值后恢复 Shield。
- [ ] 硬封锁：Manual / Sleep / Strict 模式不提供轻易解锁。

## 验收标准

- [ ] Shield 页面显示 WorthyScroll 自定义内容。
- [ ] Shield 按钮动作可被扩展处理。
- [ ] 临时解锁到期后能恢复屏蔽。
- [ ] 达到使用阈值后能再次屏蔽。
- [ ] 主 App 能记录一次干预事件。
- [ ] 成功提交并推送本功能块。

## 步骤

- [ ] 创建 ShieldConfiguration Extension 源码。
- [ ] 创建 ShieldAction Extension 源码。
- [ ] 创建临时解锁状态模型。
- [ ] 创建 DeviceActivityMonitor Extension 源码。
- [ ] 创建干预事件记录。
- [ ] 更新本日志勾选状态并提交推送。

## 接口依赖

- 屏蔽核心提供目标 token 和配置。
- 内容货架提供“转去刷好内容”的入口。
