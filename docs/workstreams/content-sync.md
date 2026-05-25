# P2/P3 共享模型与未读库存同步

状态：未开始  
建议分支：`codex/content-sync`  
责任范围：`scripts/**`、`supabase/**`、`ios/WorthyScrollShared/**`、`docs/workstreams/content-sync.md`

## 目标

把公众号未读库存从 Obsidian 同步助手稳定导入数据库，并让 iOS App 能拿到同一批内容。

## 验收标准

- [ ] Obsidian 同步目录能被脚本扫描。
- [ ] Markdown 正文、纯文本、标题、来源、作者、保存时间、阅读分钟数能进入本地 SQLite。
- [ ] 内容能同步到 Supabase `content_items`。
- [ ] iOS 共享模型能表达同一份 `ContentItem`。
- [ ] App 可拉取一批未读内容并本地缓存。
- [ ] 成功提交并推送本功能块。

## 步骤

- [ ] 固定 `ContentItem` 字段协议。
- [ ] 补齐 Supabase 云项目创建和迁移应用。
- [ ] 验证 `scripts/import-wechat-notes.py` 当前导入结果。
- [ ] 验证 `scripts/sync-content-to-supabase.py` 云端写入。
- [ ] 在 iOS 侧创建 Supabase 内容拉取服务。
- [ ] 写入本地缓存策略。
- [ ] 更新本日志勾选状态并提交推送。

## 接口依赖

- 读取器依赖 `ContentItem.markdown`、`ContentItem.plainText`、`ContentItem.estimatedMinutes`。
- 推送功能依赖 `ContentItem.id`、`savedAt`、`readingStatus`。
