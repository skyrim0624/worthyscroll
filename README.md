# 短视频防御系统

当前阶段已经确认第一版 MVP 要转向 Xcode 原生 App：它不仅要做收藏 / 未读 / 推送 / 站内阅读，还要实现类似 one sec 的系统级 App 屏蔽能力。

Web 原型继续保留，用来验证内容库存、公众号导入和站内阅读交互；最终移动端主线见 [`docs/ios-native-mvp.md`](docs/ios-native-mvp.md)。

## 当前原型

已经有一个基于参考图视觉方向做的移动端原型：首页是「未读库存」内容货架，支持搜索、公众号筛选、网格 / 列表切换、详情弹层和 App 内全文阅读。

```bash
npm run dev -- --port 5174
```

本轮视觉分析记录在 [`docs/visual-direction.md`](docs/visual-direction.md)。

## 当前管道

1. 在微信里把想看的公众号文章或视频转发给「笔记同步助手」。
2. NoteHelper 插件同步到 Obsidian：`/Users/andreas/cmi社区知识库/CMI/笔记同步助手/`。
3. 本项目脚本扫描同步目录，把独立文章 Markdown 导入 SQLite 数据库：`data/content-shelf.sqlite`。
4. 脚本同时导出前端可读取的 JSON：`public/content-items.json`。
5. App 首页读取这个 JSON，生成「现在刷点好的」未读内容货架。

## Supabase 数据库

数据库选型采用 Supabase。原因是第一版需要内容库存、阅读状态、反馈、推送队列、屏蔽会话和干预事件，Postgres + RLS 比 Cloudflare D1 更适合作为主数据层。

本仓库已经包含本地 Supabase 配置和首个迁移：

```bash
supabase/migrations/20260525001842_init_worthyscroll_schema.sql
```

核心表：

- `content_items`：收藏 / 未读内容库存。
- `content_feedback`：点赞、拉踩、偏好反馈。
- `reading_events`：打开、阅读进度、已读等事件。
- `device_installations`：iOS 设备和推送 token。
- `push_jobs`：待推送任务。
- `block_profiles`：屏蔽配置。
- `block_sessions`：一次屏蔽会话。
- `intervention_events`：one sec 六大核心功能对应的干预事件。

同步本地内容到 Supabase：

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
