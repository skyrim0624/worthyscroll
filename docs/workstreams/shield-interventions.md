# P7/P8 Shield 拦截、摩擦、临时解锁和中途再拦

状态：进行中
建议分支：`codex/shield-interventions`  
责任范围：`ios/WorthyScrollShield/**`、`ios/WorthyScrollBlocking/**`、`docs/workstreams/shield-interventions.md`

## 目标

把 one sec 的六项核心能力落到 iOS 原生系统能力上，同时把用户导回 WorthyScroll 的高质量内容流。

## one sec 六项核心映射

- [x] 打开前强制拦截：ManagedSettings Shield。
- [x] 制造摩擦：Shield 文案、按钮、等待、呼吸。
- [x] 追问意图：Shield 动作记录回主 App 的请求。
- [x] 有边界地使用：临时解锁 5 / 10 分钟。
- [x] 刷着刷着再拦一次：DeviceActivity 阈值后恢复 Shield。
- [x] 硬封锁：Manual 模式直接应用 Shield。

## 验收标准

- [x] Shield 页面显示 WorthyScroll 自定义内容。
- [x] Shield 按钮动作可被扩展处理。
- [x] 临时解锁到期后能恢复屏蔽。
- [x] 达到使用阈值后能再次屏蔽。
- [x] 主 App 能记录一次干预事件。
- [ ] 成功提交并推送本功能块。

## 步骤

- [x] 创建 ShieldConfiguration Extension 源码。
- [x] 创建 ShieldAction Extension 源码。
- [x] 创建临时解锁状态模型。
- [x] 创建 DeviceActivityMonitor Extension 源码。
- [x] 创建干预事件记录。
- [ ] 更新本日志勾选状态并提交推送。

## 接口依赖

- 屏蔽核心提供目标 token 和配置。
- 内容货架提供“转去刷好内容”的入口。
