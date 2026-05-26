# 短视频防御系统

当前阶段已经确认第一版 MVP 要转向 Xcode 原生 App：它不仅要做收藏 / 阅读 / 推送 / 站内阅读，还要实现类似 one sec 的系统级 App 屏蔽能力。

Web 原型继续保留，用来验证独立内容平台、浏览器可点流程和站内阅读交互；最终移动端主线见 [`docs/ios-native-mvp.md`](docs/ios-native-mvp.md)。

项目推进日志见 [`docs/project-log.md`](docs/project-log.md)。后续每个功能块会在 `docs/workstreams/` 下单独打勾记录，避免并行开发时互相覆盖。

## 当前原型

已经有一个基于参考图视觉方向做的移动端原型：首页是「值得刷」内容流，支持搜索、来源筛选、网格 / 列表切换、App 内全文阅读、阅读反馈、浏览器内模拟屏蔽和本地偏好状态。

```bash
npm run dev -- --port 5174
```

本地预览内置批注模式：

1. 打开 `http://127.0.0.1:5174/`。
2. 点击左侧「开始批注」。
3. 直接点击手机预览里的具体组件并写下意见，批注会绑定到该组件，滚动时跟随组件移动。
4. 点击「复制给 Codex」把所有批注整理成 Markdown，直接粘回对话。
5. 批注默认保存在当前浏览器本地，也可以下载为 `.md` 文件。

本轮视觉分析记录在 [`docs/visual-direction.md`](docs/visual-direction.md)。

## 当前管道

1. 在微信里把想看的公众号文章或视频转发给「笔记同步助手」。
2. NoteHelper 插件同步到 Obsidian：`/Users/andreas/cmi社区知识库/CMI/笔记同步助手/`。
3. 本项目脚本扫描同步目录，把独立文章 Markdown 导入 SQLite 数据库：`data/content-shelf.sqlite`。
4. 脚本同时导出前端可读取的 JSON：`public/content-items.json`。
5. App 首页读取这个 JSON，生成 WorthyScroll 内容流。

## Supabase 数据库

数据库选型采用 Supabase。原因是第一版需要内容池、阅读状态、反馈、推送队列、屏蔽会话和干预事件，Postgres + RLS 比 Cloudflare D1 更适合作为主数据层。

本仓库已经包含本地 Supabase 配置和首个迁移：

```bash
supabase/migrations/20260525001842_init_worthyscroll_schema.sql
```

核心表：

- `content_items`：收藏内容池。
- `content_feedback`：点赞、拉踩、偏好反馈。
- `reading_events`：打开、阅读进度、已读等事件。
- `device_installations`：iOS 设备和推送 token。
- `push_jobs`：待推送任务。
- `block_profiles`：屏蔽配置。
- `block_sessions`：一次屏蔽会话。
- `intervention_events`：one sec 六大核心功能对应的干预事件。

导入本地内容到 Supabase：

```bash
cp .env.example .env
python3 scripts/import-wechat-notes.py
python3 scripts/sync-content-to-supabase.py
```

`.env` 里的 `SUPABASE_SERVICE_ROLE_KEY` 只能用于本机导入脚本或服务端，不能放进前端或 iOS 客户端。

## 手动导入

```bash
python3 scripts/import-wechat-notes.py
```

脚本会跳过 `同步助手_YYYY-MM-DD.md` 这类日汇总文件，避免和独立文章重复。
