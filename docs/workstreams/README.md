# 功能块日志说明

这里的每个 Markdown 文件对应一个可独立推进的功能块。并行开发时，一个分支或 worktree 尽量只认领一个功能块，减少冲突。

## 协作规则

- 总控状态写在 `docs/project-log.md`。
- 具体勾选写在本目录下对应功能块文件里。
- 功能块完成一个可验证步骤后，先更新自己的日志，再提交并推送。
- 修改共享接口时，同步更新受影响功能块的“接口依赖”部分。

## 当前功能块

- `ios-shell.md`：Xcode 原生工程外壳。
- `content-sync.md`：公众号、Obsidian、Supabase、App 内容缓存。
- `reader.md`：内容货架和 App 内阅读体验。
- `blocking-core.md`：Screen Time 授权、目标选择、屏蔽策略。
- `shield-interventions.md`：Shield 拦截页、摩擦、临时解锁、中途再拦。
- `push-feedback.md`：推送、提醒、阅读反馈和推荐信号。
