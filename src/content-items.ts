export type ContentSource = "wechat_article" | "wechat_video" | "wechat_note" | "substack";

export type ContentItem = {
  id: string;
  title: string;
  sourceType: ContentSource;
  sourceName: string;
  author?: string;
  tags?: string[];
  url?: string;
  savedAt: string;
  savedAtRaw?: string;
  filePath?: string;
  estimatedMinutes: number;
  wordCount?: number;
  markdown?: string;
  plainText?: string;
  excerpt: string;
  status?: "unread" | "read" | "archived";
  visual: "document" | "note" | "poster" | "video" | "stack";
};

export const contentItems: ContentItem[] = [
  {
    id: "aigc-mv",
    title: "未来战胜人工智能后的某一时刻",
    sourceType: "wechat_video",
    sourceName: "视频号",
    tags: ["视频", "娱乐"],
    savedAt: "5 月 21 日",
    estimatedMinutes: 1,
    visual: "video",
    excerpt:
      "一个关于机械打字、计算机、青春电影和人与人羁绊的 AI MV。适合轻松刷，但不会把人拖进无限流。",
  },
  {
    id: "harness",
    title: "一文读懂 Harness Engineering",
    sourceType: "wechat_article",
    sourceName: "微信公众号",
    tags: ["AI", "工程"],
    savedAt: "5 月 16 日",
    estimatedMinutes: 32,
    visual: "document",
    excerpt:
      "从 14 篇工程文章中整理 AI 应用层的 Harness 思路，适合放进项目方法库。",
  },
  {
    id: "claude-code",
    title: "探秘 Claude Code，搞懂 Agent Harness",
    sourceType: "wechat_article",
    sourceName: "微信公众号",
    tags: ["AI", "Agent"],
    savedAt: "5 月 14 日",
    estimatedMinutes: 19,
    visual: "note",
    excerpt:
      "围绕 Agent Harness 的访谈整理，适合继续拆解 AI-native 产品的壳和工作流。",
  },
  {
    id: "music-workshop",
    title: "CMI 音乐即兴戏剧工作坊",
    sourceType: "wechat_article",
    sourceName: "微信公众号",
    tags: ["活动", "戏剧"],
    savedAt: "5 月 11 日",
    estimatedMinutes: 1,
    visual: "poster",
    excerpt:
      "清迈客栈地毯区、音乐即兴和身体参与。更像活动灵感，不是纯知识摄入。",
  },
  {
    id: "ai-tarot",
    title: "亲手搓出你的 AI 塔罗占卜师",
    sourceType: "wechat_article",
    sourceName: "微信公众号",
    tags: ["AI", "工具"],
    savedAt: "5 月 11 日",
    estimatedMinutes: 1,
    visual: "stack",
    excerpt:
      "把代码变成直觉的延伸，适合作为 Vibe Coding 活动设计参考。",
  },
  {
    id: "openclaw",
    title: "部署你的虾兵蟹将",
    sourceType: "wechat_article",
    sourceName: "微信公众号",
    tags: ["工具", "自动化"],
    savedAt: "5 月 11 日",
    estimatedMinutes: 1,
    visual: "document",
    excerpt:
      "OpenClaw 部署实践，偏工具链与自动化方向，可作为旧思路归档参考。",
  },
];
