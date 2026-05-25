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

## 手动导入

```bash
python3 scripts/import-wechat-notes.py
```

脚本会跳过 `同步助手_YYYY-MM-DD.md` 这类日汇总文件，避免和独立文章重复。
