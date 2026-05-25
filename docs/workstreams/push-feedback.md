# P9 推送、提醒、阅读反馈和推荐信号

状态：进行中
建议分支：`codex/push-feedback`  
责任范围：`ios/WorthyScroll/**`、`ios/WorthyScrollShared/**`、`supabase/**`、`docs/workstreams/push-feedback.md`

## 目标

让 App 不只是被动打开，还能在合适的时候把未读库存推到用户面前，并收集“这个好 / 这个不好”的反馈信号。

## 验收标准

- [x] iOS 设备能注册推送 token。
- [x] Supabase 能保存设备安装记录。
- [x] `push_jobs` 能表达待推送内容。
- [x] App 能记录点赞、拉踩、隐藏、已读。
- [x] 反馈能回写 Supabase。
- [ ] 成功提交并推送本功能块。

## 步骤

- [x] 创建推送权限请求和 token 上报。
- [x] 创建推送任务数据模型。
- [x] 创建本地通知或 APNs 第一版策略。
- [x] 创建反馈按钮和事件写入。
- [x] 创建推荐信号字段说明。
- [ ] 更新本日志勾选状态并提交推送。

## 接口依赖

- 内容同步提供可推送内容。
- 后续推荐系统依赖反馈事件和阅读事件。
