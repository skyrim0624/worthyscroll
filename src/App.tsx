import {
  Archive,
  ArrowLeft,
  Bell,
  Bookmark,
  BookMarked,
  Check,
  ChevronDown,
  Clipboard,
  Download,
  Eye,
  EyeOff,
  Grid2X2,
  Hand,
  ImagePlus,
  Link2,
  List,
  Mic,
  PenLine,
  RotateCcw,
  Search,
  Settings,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, MouseEvent, RefObject } from "react";
import { ContentItem, contentItems } from "./content-items";

type ViewMode = "grid" | "list";
type SourceFilter = "all" | ContentItem["sourceType"];
type AppTab = "content" | "favorites" | "blocking" | "profile";
type AuthMode = "login" | "register";
type FeedbackSignal = "liked" | "disliked";
type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
};
type AuthResponse = {
  ok?: boolean;
  user?: SessionUser | null;
  error?: string;
  message?: string;
  verificationUrl?: string;
  emailSent?: boolean;
};
type ReaderBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "image"; src: string; alt: string }
  | { type: "section"; text: string };
type Annotation = {
  id: string;
  x: number;
  y: number;
  text: string;
  attachments?: AnnotationAttachment[];
  viewLabel: string;
  createdAt: string;
  targetId?: string;
  targetLabel?: string;
  targetOffsetX?: number;
  targetOffsetY?: number;
  viewKey?: string;
};
type AnnotationDraft = {
  id?: string;
  x: number;
  y: number;
  text: string;
  attachments?: AnnotationAttachment[];
  targetId?: string;
  targetLabel?: string;
  targetOffsetX?: number;
  targetOffsetY?: number;
  viewKey?: string;
  viewLabel?: string;
};
type AnnotationPoint = {
  left: number;
  top: number;
  targetRect?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
};
type AnnotationHoverTarget = {
  targetId: string;
  targetLabel: string;
};
type AnnotationAttachment = {
  id: string;
  kind: "link" | "image" | "audio";
  label: string;
  url: string;
  mimeType?: string;
  size?: number;
};

const sourceLabel: Record<ContentItem["sourceType"], string> = {
  wechat_article: "公众号",
  wechat_video: "视频号",
  wechat_note: "微信笔记",
  substack: "Substack",
};

const ANNOTATION_STORAGE_KEY = "worthyscroll-annotations";
const ANNOTATION_TARGET_SELECTOR = "[data-annotation-target]";
const MAX_ANNOTATION_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const READ_IDS_KEY = "shortvideo-read-ids";
const LIKED_IDS_KEY = "worthyscroll-liked-ids";
const DISLIKED_IDS_KEY = "worthyscroll-disliked-ids";
const FAVORITE_IDS_KEY = "worthyscroll-favorite-ids";
const HIDDEN_IDS_KEY = "worthyscroll-hidden-ids";
const BLOCK_TARGETS_KEY = "worthyscroll-block-targets";
const BLOCK_ACTIVE_KEY = "worthyscroll-block-active";
const REMINDER_ENABLED_KEY = "worthyscroll-reminder-enabled";

async function authRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = (await response.json().catch(() => ({}))) as AuthResponse;
  if (!response.ok) {
    throw new Error(data.error || "请求失败");
  }
  return data as T;
}

async function loadContentItems(): Promise<ContentItem[]> {
  const response = await fetch(`/content-items.json?ts=${Date.now()}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`内容读取失败：${response.status}`);
  }
  return response.json();
}

function cleanInlineMarkdown(text: string) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/\\([_*>#-])/g, "$1")
    .trim();
}

function parseReaderBlocks(item: ContentItem): ReaderBlock[] {
  const markdown = item.markdown?.trim();
  if (!markdown) {
    const fallbackText = item.plainText || item.excerpt;
    return fallbackText
      .split(/(?<=[。！？.!?])\s+/)
      .map((text) => cleanInlineMarkdown(text))
      .filter(Boolean)
      .map((text) => ({ type: "paragraph", text }));
  }

  const blocks: ReaderBlock[] = [];
  let paragraphLines: string[] = [];

  function flushParagraph() {
    const text = cleanInlineMarkdown(paragraphLines.join(" "));
    if (text) {
      blocks.push({ type: "paragraph", text });
    }
    paragraphLines = [];
  }

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      continue;
    }

    const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      flushParagraph();
      blocks.push({
        type: "image",
        alt: imageMatch[1] || "文章图片",
        src: imageMatch[2],
      });
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      blocks.push({ type: "heading", text: cleanInlineMarkdown(headingMatch[2]) });
      continue;
    }

    if (/^\d{1,2}$/.test(line)) {
      flushParagraph();
      blocks.push({ type: "section", text: line });
      continue;
    }

    paragraphLines.push(line);
  }

  flushParagraph();
  return blocks;
}

function createAnnotationId() {
  return `annotation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeAnnotationId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function contentTargetId(prefix: string, item: ContentItem) {
  return `${prefix}-${safeAnnotationId(item.id)}`;
}

function contentTags(item: ContentItem) {
  if (item.tags?.length) {
    return item.tags.slice(0, 3);
  }

  const text = `${item.title} ${item.excerpt}`.toLowerCase();
  const tags: string[] = [];
  const addTag = (tag: string) => {
    if (!tags.includes(tag)) {
      tags.push(tag);
    }
  };

  if (/ai|人工智能|claude|gpt|gemini|agent|harness|code|prompt/.test(text)) {
    addTag("AI");
  }
  if (/产品|创业|app|获客|商业|赚钱|lenny|增长/.test(text)) {
    addTag("产品");
  }
  if (/社区|cmi|清迈|活动|聚会|工作坊|分享会|jam/.test(text)) {
    addTag("社区");
  }
  if (/音乐|戏剧|美声|咏春|武术|身体|身心/.test(text)) {
    addTag("身心");
  }
  if (/视频|mv|电影|影像/.test(text) || item.sourceType === "wechat_video") {
    addTag("视频");
  }
  if (/塔罗|占卜|游戏|玩/.test(text)) {
    addTag("娱乐");
  }

  return tags.length ? tags.slice(0, 3) : [sourceLabel[item.sourceType]];
}

function contentSourceText(item: ContentItem) {
  return item.sourceName || sourceLabel[item.sourceType];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function findAnnotationTargetElement(element: Element | null, root: HTMLElement | null) {
  if (!element || !root) {
    return null;
  }
  const target = element.closest<HTMLElement>(ANNOTATION_TARGET_SELECTOR);
  return target && root.contains(target) ? target : null;
}

function findAnnotationTargetById(root: HTMLElement | null, targetId?: string) {
  if (!root || !targetId) {
    return null;
  }
  return (
    Array.from(root.querySelectorAll<HTMLElement>(ANNOTATION_TARGET_SELECTOR)).find(
      (element) => element.dataset.annotationTarget === targetId,
    ) || null
  );
}

function loadAnnotations(): Annotation[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(ANNOTATION_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function createAnnotationAttachmentId() {
  return `attachment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeAttachmentUrl(value: string) {
  const url = value.trim();
  if (!url) {
    return "";
  }
  if (/^(https?:|mailto:|tel:|data:)/i.test(url)) {
    return url;
  }
  return `https://${url}`;
}

function formatFileSize(size?: number) {
  if (!size) {
    return "";
  }
  if (size < 1024 * 1024) {
    return `${Math.ceil(size / 1024)} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function fileToAnnotationAttachment(file: File): Promise<AnnotationAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const kind: AnnotationAttachment["kind"] = file.type.startsWith("audio/") ? "audio" : "image";
      resolve({
        id: createAnnotationAttachmentId(),
        kind,
        label: file.name,
        url: String(reader.result || ""),
        mimeType: file.type,
        size: file.size,
      });
    };
    reader.onerror = () => reject(reader.error || new Error("附件读取失败"));
    reader.readAsDataURL(file);
  });
}

function formatAttachmentForCodex(attachment: AnnotationAttachment, index: number) {
  const sizeText = formatFileSize(attachment.size);
  const meta = [attachment.mimeType, sizeText].filter(Boolean).join(", ");
  const label = attachment.label || `${attachment.kind}-${index + 1}`;
  if (attachment.kind === "link") {
    return `  - 链接 ${index + 1}: [${label}](${attachment.url})`;
  }
  if (attachment.kind === "image") {
    return `  - 图片 ${index + 1}: ${label}${meta ? `（${meta}）` : ""}\n    ![${label}](${attachment.url})`;
  }
  return `  - 音频 ${index + 1}: [${label}](${attachment.url})${meta ? `（${meta}）` : ""}`;
}

function loadIdSet(key: string): Set<string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveIdSet(key: string, value: Set<string>) {
  localStorage.setItem(key, JSON.stringify(Array.from(value)));
}

function formatAnnotationsForCodex(annotations: Annotation[]) {
  if (annotations.length === 0) {
    return "暂无 WorthyScroll 批注。";
  }

  const lines = [
    `# WorthyScroll 批注 ${new Date().toLocaleString("zh-CN")}`,
    "",
    ...annotations.flatMap((annotation, index) => [
      `## ${index + 1}. ${annotation.viewLabel}`,
      "",
      `- 组件：${annotation.targetLabel || "旧版坐标批注"}`,
      `- 位置：x=${(annotation.targetOffsetX ?? annotation.x).toFixed(1)}%, y=${(annotation.targetOffsetY ?? annotation.y).toFixed(1)}%`,
      `- 内容：${annotation.text || "（无文字说明）"}`,
      ...(annotation.attachments?.length
        ? [
            "- 附件：",
            ...annotation.attachments.map(formatAttachmentForCodex),
          ]
        : []),
      "",
    ]),
  ];

  return lines.join("\n");
}

function PhoneStatusBar() {
  return (
    <div className="status-bar" aria-hidden="true">
      <span>9:41</span>
      <div className="dynamic-island" />
      <div className="status-icons">
        <span className="cell-bars">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="wifi-icon" />
        <span className="battery-icon" />
      </div>
    </div>
  );
}

function PreviewArtwork({ item }: { item: ContentItem }) {
  const annotationTargetId = contentTargetId("content-preview", item);
  const annotationLabel = `封面：${item.title}`;

  if (item.visual === "note") {
    return (
      <div
        className="preview note-preview"
        data-annotation-target={annotationTargetId}
        data-annotation-label={annotationLabel}
      >
        <div className="note-card rear" />
        <div className="note-card front">
          <span>读后再想</span>
          <b>Harness</b>
          <b>Agent</b>
          <b>Workflow</b>
        </div>
      </div>
    );
  }

  if (item.visual === "poster") {
    return (
      <div
        className="preview poster-preview"
        data-annotation-target={annotationTargetId}
        data-annotation-label={annotationLabel}
      >
        <div className="poster-couch" />
        <div className="poster-line" />
        <strong>CMI</strong>
        <span>即兴 · 戏剧 · 声音</span>
      </div>
    );
  }

  if (item.visual === "video") {
    return (
      <div
        className="preview video-preview"
        data-annotation-target={annotationTargetId}
        data-annotation-label={annotationLabel}
      >
        <div className="video-strip strip-one" />
        <div className="video-strip strip-two" />
        <div className="play-mark">▶</div>
        <span>AI MV</span>
      </div>
    );
  }

  if (item.visual === "stack") {
    return (
      <div
        className="preview stack-preview"
        data-annotation-target={annotationTargetId}
        data-annotation-label={annotationLabel}
      >
        <div className="small-paper one" />
        <div className="small-paper two" />
        <div className="small-paper three" />
        <span>AI Tarot</span>
      </div>
    );
  }

  return (
    <div
      className="preview document-preview"
      data-annotation-target={annotationTargetId}
      data-annotation-label={annotationLabel}
    >
      <div className="paper ghost" />
      <div className="paper main">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function ContentCard({
  item,
  viewMode,
  isFavorite,
  onOpen,
  onToggleFavorite,
}: {
  item: ContentItem;
  viewMode: ViewMode;
  isFavorite: boolean;
  onOpen: (item: ContentItem) => void;
  onToggleFavorite: (item: ContentItem) => void;
}) {
  const tags = contentTags(item);

  return (
    <article
      className={`content-card ${viewMode}`}
      data-annotation-target={contentTargetId("content-card", item)}
      data-annotation-label={`内容卡片：${item.title}`}
    >
      <button
        className="content-card-main"
        onClick={() => onOpen(item)}
        aria-label={`阅读：${item.title}`}
      >
        <div
          className="card-header"
          data-annotation-target={contentTargetId("content-title", item)}
          data-annotation-label={`标题：${item.title}`}
        >
          <div>
            <h2
              data-annotation-target={contentTargetId("content-title-text", item)}
              data-annotation-label={`标题文字：${item.title}`}
            >
              {item.title}
            </h2>
            <p
              className="card-tags"
              data-annotation-target={contentTargetId("content-saved-date", item)}
              data-annotation-label={`标签：${item.title}`}
            >
              {tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </p>
          </div>
        </div>
        <PreviewArtwork item={item} />
        <div
          className="card-meta"
          data-annotation-target={contentTargetId("content-meta", item)}
          data-annotation-label={`来源和收藏：${item.title}`}
        >
          <span
            data-annotation-target={contentTargetId("content-source", item)}
            data-annotation-label={`内容来源：${item.title}`}
          >
            {contentSourceText(item)}
          </span>
        </div>
      </button>

      <button
        className={isFavorite ? "favorite-button active" : "favorite-button"}
        onClick={() => onToggleFavorite(item)}
        aria-label={isFavorite ? `取消收藏：${item.title}` : `收藏：${item.title}`}
        data-annotation-target={contentTargetId("content-favorite", item)}
        data-annotation-label={`收藏按钮：${item.title}`}
      >
        <Bookmark size={18} strokeWidth={2.5} fill={isFavorite ? "currentColor" : "none"} />
      </button>
    </article>
  );
}

function ReaderView({
  item,
  onClose,
  onMarkRead,
  onHide,
  onSignal,
  feedbackSignal,
}: {
  item: ContentItem;
  onClose: () => void;
  onMarkRead: (item: ContentItem) => void;
  onHide: (item: ContentItem) => void;
  onSignal: (item: ContentItem, signal: FeedbackSignal) => void;
  feedbackSignal: FeedbackSignal | null;
}) {
  const blocks = useMemo(() => parseReaderBlocks(item), [item]);

  return (
    <article
      className="reader-view"
      data-annotation-target={contentTargetId("reader-page", item)}
      data-annotation-label={`阅读页：${item.title}`}
    >
      <header
        className="reader-nav"
        data-annotation-target={contentTargetId("reader-nav", item)}
        data-annotation-label="阅读页顶部导航"
      >
        <button onClick={onClose} aria-label="返回内容页">
          <ArrowLeft size={25} strokeWidth={2.4} />
        </button>
        <span>阅读中</span>
        <button onClick={() => onMarkRead(item)} aria-label="标为已读">
          <Check size={23} strokeWidth={2.5} />
        </button>
      </header>

      <div
        className="reader-meta"
        data-annotation-target={contentTargetId("reader-meta", item)}
        data-annotation-label={`阅读信息：${item.title}`}
      >
        <span>{sourceLabel[item.sourceType]}</span>
        <span>{item.savedAt}</span>
        <span>{item.estimatedMinutes} 分钟</span>
      </div>

      <h1
        data-annotation-target={contentTargetId("reader-title", item)}
        data-annotation-label={`阅读标题：${item.title}`}
      >
        {item.title}
      </h1>

      {item.author || item.sourceName ? (
        <p
          className="reader-byline"
          data-annotation-target={contentTargetId("reader-byline", item)}
          data-annotation-label={`作者来源：${item.title}`}
        >
          {[item.sourceName, item.author].filter(Boolean).join(" · ")}
        </p>
      ) : null}

      <div
        className="reader-actions-bar"
        data-annotation-target={contentTargetId("reader-actions", item)}
        data-annotation-label="阅读反馈按钮组"
      >
        <button
          className={feedbackSignal === "liked" ? "active" : ""}
          onClick={() => onSignal(item, "liked")}
        >
          <ThumbsUp size={17} />
          喜欢
        </button>
        <button
          className={feedbackSignal === "disliked" ? "active" : ""}
          onClick={() => onSignal(item, "disliked")}
        >
          <ThumbsDown size={17} />
          不喜欢
        </button>
        <button onClick={() => onHide(item)}>
          <Archive size={17} />
          隐藏
        </button>
      </div>

      <div className="reader-content">
        {blocks.map((block, index) => {
          if (block.type === "heading") {
            return (
              <h2
                key={`${block.type}-${index}`}
                data-annotation-target={contentTargetId(`reader-heading-${index}`, item)}
                data-annotation-label={`小标题：${block.text}`}
              >
                {block.text}
              </h2>
            );
          }
          if (block.type === "section") {
            return (
              <div
                className="reader-section-marker"
                key={`${block.type}-${index}`}
                data-annotation-target={contentTargetId(`reader-section-${index}`, item)}
                data-annotation-label={`段落编号：${block.text}`}
              >
                {block.text}
              </div>
            );
          }
          if (block.type === "image") {
            return (
              <figure
                key={`${block.type}-${index}`}
                data-annotation-target={contentTargetId(`reader-image-${index}`, item)}
                data-annotation-label={`阅读图片：${block.alt}`}
              >
                <img src={block.src} alt={block.alt} loading="lazy" />
              </figure>
            );
          }
          return (
            <p
              key={`${block.type}-${index}`}
              data-annotation-target={contentTargetId(`reader-paragraph-${index}`, item)}
              data-annotation-label={`正文段落 ${index + 1}`}
            >
              {block.text}
            </p>
          );
        })}
      </div>
    </article>
  );
}

function ContentHome({
  items,
  isLoading,
  query,
  sourceFilter,
  viewMode,
  onQueryChange,
  onCycleSourceFilter,
  onViewModeChange,
  onOpenItem,
  favoriteIds,
  onToggleFavorite,
}: {
  items: ContentItem[];
  isLoading: boolean;
  query: string;
  sourceFilter: SourceFilter;
  viewMode: ViewMode;
  onQueryChange: (query: string) => void;
  onCycleSourceFilter: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  onOpenItem: (item: ContentItem) => void;
  favoriteIds: Set<string>;
  onToggleFavorite: (item: ContentItem) => void;
}) {
  return (
    <section
      className="app-page content-page"
      data-annotation-target="content-page"
      data-annotation-label="内容页"
    >
      <header
        className="brand-header"
        data-annotation-target="content-header"
        data-annotation-label="内容页标题区"
      >
        <div>
          <h1 className="brand-wordmark">刷点好的</h1>
          <p>by Ziyang</p>
        </div>
      </header>

      <label className="search-box" data-annotation-target="content-search" data-annotation-label="搜索框">
        <Search size={24} strokeWidth={2.4} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索内容"
        />
      </label>

      <div className="filter-bar" data-annotation-target="content-filter-bar" data-annotation-label="筛选和视图切换">
        <button
          className={sourceFilter === "all" ? "active-filter" : ""}
          onClick={onCycleSourceFilter}
        >
          {sourceFilter === "all" ? "全部内容" : sourceLabel[sourceFilter]}
          <ChevronDown size={20} strokeWidth={2.4} />
        </button>
        <div className="view-toggle" role="group" aria-label="视图切换">
          <button
            className={viewMode === "list" ? "selected" : ""}
            onClick={() => onViewModeChange("list")}
            aria-label="列表视图"
          >
            <List size={22} />
          </button>
          <button
            className={viewMode === "grid" ? "selected" : ""}
            onClick={() => onViewModeChange("grid")}
            aria-label="网格视图"
          >
            <Grid2X2 size={22} />
          </button>
        </div>
      </div>

      <section className={`content-grid ${viewMode}`} data-annotation-target="content-grid" data-annotation-label="内容卡片列表">
        {items.map((item) => (
          <ContentCard
            key={item.id}
            item={item}
            viewMode={viewMode}
            isFavorite={favoriteIds.has(item.id)}
            onOpen={onOpenItem}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </section>

      {!isLoading && items.length === 0 ? (
        <div className="empty-state">
          <BookMarked size={28} />
          <strong>这里暂时没有内容</strong>
          <span>换个筛选或搜索词试试。</span>
        </div>
      ) : null}
    </section>
  );
}

function FavoritesHome({
  items,
  viewMode,
  onViewModeChange,
  onOpenItem,
  favoriteIds,
  onToggleFavorite,
}: {
  items: ContentItem[];
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onOpenItem: (item: ContentItem) => void;
  favoriteIds: Set<string>;
  onToggleFavorite: (item: ContentItem) => void;
}) {
  return (
    <section
      className="app-page favorites-page"
      data-annotation-target="favorites-page"
      data-annotation-label="收藏页"
    >
      <header
        className="section-header compact"
        data-annotation-target="favorites-header"
        data-annotation-label="收藏页标题区"
      >
        <h1>收藏</h1>
        <p>留住想反复看的内容</p>
      </header>

      <div
        className="filter-bar favorites-toolbar"
        data-annotation-target="favorites-toolbar"
        data-annotation-label="收藏页视图切换"
      >
        <span>{items.length} 条</span>
        <div className="view-toggle" role="group" aria-label="收藏视图切换">
          <button
            className={viewMode === "list" ? "selected" : ""}
            onClick={() => onViewModeChange("list")}
            aria-label="列表视图"
          >
            <List size={22} />
          </button>
          <button
            className={viewMode === "grid" ? "selected" : ""}
            onClick={() => onViewModeChange("grid")}
            aria-label="网格视图"
          >
            <Grid2X2 size={22} />
          </button>
        </div>
      </div>

      {items.length > 0 ? (
        <section
          className={`content-grid ${viewMode}`}
          data-annotation-target="favorites-grid"
          data-annotation-label="收藏内容列表"
        >
          {items.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              viewMode={viewMode}
              isFavorite={favoriteIds.has(item.id)}
              onOpen={onOpenItem}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </section>
      ) : (
        <div className="empty-state">
          <Bookmark size={28} />
          <strong>还没有收藏</strong>
          <span>点内容卡片右下角的收藏标，就会收进这里。</span>
        </div>
      )}
    </section>
  );
}

function BlockingView({
  selectedTargets,
  blockActive,
  onToggleTarget,
  onToggleBlock,
}: {
  selectedTargets: Set<string>;
  blockActive: boolean;
  onToggleTarget: (id: string) => void;
  onToggleBlock: () => void;
}) {
  const targets = [
    { id: "xiaohongshu", name: "小红书", note: "减少无目的滑动" },
    { id: "wechat-channels", name: "视频号", note: "保留聊天，拦住视频流" },
    { id: "youtube-shorts", name: "YouTube Shorts", note: "只拦短视频入口" },
    { id: "x", name: "X", note: "先做轻度摩擦" },
  ];
  const capabilities = [
    { name: "打开前拦截", note: "目标 App / 网站会先出现系统 Shield" },
    { name: "停一下", note: "等待、呼吸、确认，先把自动动作打断" },
    { name: "问意图", note: "记录这次打开，并把人带回值得刷的内容" },
    { name: "限时解锁", note: "允许 5 / 10 分钟使用，到点恢复屏蔽" },
    { name: "再次拦截", note: "刷到阈值后重新挡住，避免一路滑下去" },
    { name: "硬封锁", note: "Manual Block 直接屏蔽，不给轻易绕开" },
  ];

  return (
    <section className="app-page blocking-page" data-annotation-target="blocking-page" data-annotation-label="屏蔽页">
      <header className="section-header" data-annotation-target="blocking-header" data-annotation-label="屏蔽页标题区">
        <p>防沉迷</p>
        <h1>把低质量入口挡住</h1>
      </header>

      <div
        className={blockActive ? "block-status active" : "block-status"}
        data-annotation-target="blocking-status"
        data-annotation-label="屏蔽状态卡片"
      >
        <Shield size={24} />
        <div>
          <strong>{blockActive ? "屏蔽中" : "未开启"}</strong>
          <span>{selectedTargets.size} 个目标应用</span>
        </div>
      </div>

      <section
        className="blocking-capabilities"
        data-annotation-target="blocking-capabilities"
        data-annotation-label="屏蔽六个核心能力"
      >
        <div className="capability-heading">
          <span>六个拦截能力</span>
          <b>原生版已接入 · 待真机验证</b>
        </div>
        <div className="capability-grid">
          {capabilities.map((capability, index) => (
            <div className="capability-card" key={capability.name}>
              <i>{index + 1}</i>
              <span>
                <b>{capability.name}</b>
                <small>{capability.note}</small>
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="target-list">
        {targets.map((target) => {
          const selected = selectedTargets.has(target.id);
          return (
            <button
              key={target.id}
              className={selected ? "target-row selected" : "target-row"}
              onClick={() => onToggleTarget(target.id)}
              data-annotation-target={`blocking-target-${target.id}`}
              data-annotation-label={`屏蔽目标：${target.name}`}
            >
              <span>
                <b>{target.name}</b>
                <small>{target.note}</small>
              </span>
              <i>{selected ? <Check size={18} /> : null}</i>
            </button>
          );
        })}
      </div>

      <button
        className={blockActive ? "block-action active" : "block-action"}
        onClick={onToggleBlock}
        disabled={selectedTargets.size === 0}
        data-annotation-target="blocking-action"
        data-annotation-label="开始或结束屏蔽按钮"
      >
        <Hand size={18} />
        {blockActive ? "结束本次屏蔽" : "开始屏蔽"}
      </button>
    </section>
  );
}

function ProfileView({
  readCount,
  likedCount,
  dislikedCount,
  sessionUser,
  authError,
  onLogin,
  onRegister,
  onLogout,
  onResetReading,
  onResetFeedback,
  reminderEnabled,
  onToggleReminder,
}: {
  readCount: number;
  likedCount: number;
  dislikedCount: number;
  sessionUser: SessionUser | null;
  authError: string;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, displayName: string) => Promise<AuthResponse>;
  onLogout: () => Promise<void>;
  onResetReading: () => void;
  onResetFeedback: () => void;
  reminderEnabled: boolean;
  onToggleReminder: () => void;
}) {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState(authError);
  const [verificationUrl, setVerificationUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMessage(authError);
  }, [authError]);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    setVerificationUrl("");
    try {
      if (authMode === "login") {
        await onLogin(email, password);
        setMessage("已登录。");
      } else {
        const response = await onRegister(email, password, displayName);
        setMessage(response.message || "账号已创建，请完成邮箱验证。");
        setVerificationUrl(response.verificationUrl || "");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="app-page profile-page" data-annotation-target="profile-page" data-annotation-label="我的页">
      <header className="section-header" data-annotation-target="profile-header" data-annotation-label="我的页标题区">
        <p>我的</p>
        <h1>{sessionUser ? "账号与记录" : "登录账号"}</h1>
      </header>

      {sessionUser ? (
        <div className="account-card" data-annotation-target="account-card" data-annotation-label="已登录账号卡片">
          <User size={28} />
          <div>
            <strong>{sessionUser.displayName || "刷点好的用户"}</strong>
            <span>{sessionUser.email}</span>
          </div>
          <i>{sessionUser.emailVerified ? "已验证" : "未验证"}</i>
        </div>
      ) : (
        <div className="auth-card" data-annotation-target="auth-card" data-annotation-label="登录注册卡片">
          <div className="auth-switch" data-annotation-target="auth-switch" data-annotation-label="登录注册切换">
            <button className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>
              登录
            </button>
            <button className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>
              注册
            </button>
          </div>

          <form className="auth-form" onSubmit={handleAuthSubmit}>
            {authMode === "register" ? (
              <label>
                昵称
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Ziyang"
                  autoComplete="name"
                />
              </label>
            ) : null}
            <label>
              邮箱
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                type="email"
                autoComplete="email"
                required
              />
            </label>
            <label>
              密码
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="至少 8 位"
                type="password"
                autoComplete={authMode === "login" ? "current-password" : "new-password"}
                required
              />
            </label>
            <button className="auth-submit" disabled={isSubmitting}>
              {isSubmitting ? "处理中" : authMode === "login" ? "登录" : "创建账号"}
            </button>
          </form>

          {message ? <p className="auth-message">{message}</p> : null}
          {verificationUrl ? (
            <a className="verification-link" href={verificationUrl}>
              打开邮箱验证链接
            </a>
          ) : null}
        </div>
      )}

      <div className="stats-grid" data-annotation-target="profile-stats" data-annotation-label="阅读统计">
        <div>
          <strong>{readCount}</strong>
          <span>已读</span>
        </div>
        <div>
          <strong>{likedCount}</strong>
          <span>喜欢</span>
        </div>
        <div>
          <strong>{dislikedCount}</strong>
          <span>不喜欢</span>
        </div>
      </div>

      <div className="settings-list" data-annotation-target="profile-settings" data-annotation-label="设置列表">
        <button onClick={onToggleReminder} data-annotation-target="profile-reminder" data-annotation-label="每日提醒开关">
          <Bell size={18} />
          <span>每天提醒我读一点</span>
          <i>{reminderEnabled ? "开" : "关"}</i>
        </button>
        {sessionUser ? (
          <button onClick={onLogout} data-annotation-target="profile-logout" data-annotation-label="退出登录按钮">
            <User size={18} />
            <span>退出登录</span>
          </button>
        ) : null}
        <button onClick={onResetReading} data-annotation-target="profile-reset-reading" data-annotation-label="恢复已读内容按钮">
          <RotateCcw size={18} />
          <span>恢复已读内容</span>
        </button>
        <button onClick={onResetFeedback} data-annotation-target="profile-reset-feedback" data-annotation-label="清空喜好反馈按钮">
          <Trash2 size={18} />
          <span>清空喜好反馈</span>
        </button>
      </div>
    </section>
  );
}

function BottomTabBar({
  activeTab,
  onChange,
}: {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
}) {
  const tabs: Array<{ id: AppTab; label: string; icon: typeof BookMarked }> = [
    { id: "content", label: "内容", icon: BookMarked },
    { id: "favorites", label: "收藏", icon: Bookmark },
    { id: "blocking", label: "屏蔽", icon: Hand },
    { id: "profile", label: "我的", icon: Settings },
  ];

  return (
    <nav className="bottom-tab-bar" aria-label="主导航" data-annotation-target="bottom-tabs" data-annotation-label="底部导航栏">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => onChange(tab.id)}
            data-annotation-target={`bottom-tab-${tab.id}`}
            data-annotation-label={`底部 Tab：${tab.label}`}
          >
            <Icon size={22} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function AnnotationToolbar({
  annotationMode,
  showAnnotations,
  annotationCount,
  copied,
  onToggleMode,
  onToggleVisibility,
  onCopy,
  onDownload,
  onClear,
}: {
  annotationMode: boolean;
  showAnnotations: boolean;
  annotationCount: number;
  copied: boolean;
  onToggleMode: () => void;
  onToggleVisibility: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onClear: () => void;
}) {
  return (
    <aside className="annotation-toolbar" aria-label="批注工具">
      <div className="annotation-toolbar-header">
        <span>{annotationMode ? "正在批注" : "Review"}</span>
        <b>{annotationCount}</b>
      </div>
      <div className="annotation-toolbar-actions">
        <button
          className={annotationMode ? "annotation-primary active" : "annotation-primary"}
          onClick={onToggleMode}
        >
          <PenLine size={18} />
          {annotationMode ? "退出批注" : "开始批注"}
        </button>
        <button onClick={onToggleVisibility}>
          {showAnnotations ? <Eye size={17} /> : <EyeOff size={17} />}
          {showAnnotations ? "隐藏批注" : "显示批注"}
        </button>
        <button onClick={onCopy} disabled={annotationCount === 0}>
          <Clipboard size={17} />
          {copied ? "已复制" : "复制给 Codex"}
        </button>
        <button onClick={onDownload} disabled={annotationCount === 0}>
          <Download size={17} />
          下载批注
        </button>
        <button className="danger" onClick={onClear} disabled={annotationCount === 0}>
          <Trash2 size={17} />
          清空
        </button>
      </div>
      <p>{annotationMode ? "移动鼠标预览组件范围，点击后写批注。" : "批注会保存在本机浏览器里。"}</p>
    </aside>
  );
}

function AnnotationPanel({
  annotations,
  activeAnnotationId,
  onEdit,
  onDelete,
}: {
  annotations: Annotation[];
  activeAnnotationId: string | null;
  onEdit: (annotation: Annotation) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <aside className="annotation-panel" aria-label="批注列表">
      <header className="annotation-panel-header">
        <div>
          <span>当前页面</span>
          <strong>批注</strong>
        </div>
        <b>{annotations.length}</b>
      </header>

      {annotations.length === 0 ? (
        <div className="annotation-empty">
          <PenLine size={20} />
          <b>点选组件开始评审</b>
          <p>打开批注模式后，在手机预览上移动鼠标预览范围，点一下就能写意见。</p>
        </div>
      ) : (
        <ol>
          {annotations.map((annotation, index) => (
            <li
              key={annotation.id}
              className={activeAnnotationId === annotation.id ? "active" : ""}
            >
              <button onClick={() => onEdit(annotation)}>
                <span>{index + 1}</span>
                <small>
                  {annotation.viewLabel}
                  {annotation.targetLabel ? ` · ${annotation.targetLabel}` : ""}
                </small>
                <b>{annotation.text || "仅附件批注"}</b>
                {annotation.attachments?.length ? (
                  <em>{annotation.attachments.length} 个附件</em>
                ) : null}
              </button>
              <button onClick={() => onDelete(annotation.id)} aria-label={`删除批注 ${index + 1}`}>
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

function AnnotationLayer({
  annotations,
  draft,
  annotationMode,
  showAnnotations,
  activeAnnotationId,
  hoverTarget,
  screenRef,
  viewKey,
  currentViewLabel,
  layoutVersion,
  onEdit,
  onDraftTextChange,
  onAddDraftAttachments,
  onRemoveDraftAttachment,
  onSaveDraft,
  onCancelDraft,
  onDeleteDraft,
}: {
  annotations: Annotation[];
  draft: AnnotationDraft | null;
  annotationMode: boolean;
  showAnnotations: boolean;
  activeAnnotationId: string | null;
  hoverTarget: AnnotationHoverTarget | null;
  screenRef: RefObject<HTMLDivElement | null>;
  viewKey: string;
  currentViewLabel: string;
  layoutVersion: number;
  onEdit: (annotation: Annotation) => void;
  onDraftTextChange: (text: string) => void;
  onAddDraftAttachments: (attachments: AnnotationAttachment[]) => void;
  onRemoveDraftAttachment: (attachmentId: string) => void;
  onSaveDraft: () => void;
  onCancelDraft: () => void;
  onDeleteDraft: () => void;
}) {
  void layoutVersion;
  const [draftLinkUrl, setDraftLinkUrl] = useState("");

  useEffect(() => {
    setDraftLinkUrl("");
  }, [draft?.id, draft?.targetId, draft?.x, draft?.y]);

  function getAnnotationPoint(annotation: Annotation | AnnotationDraft): AnnotationPoint | null {
    const screenElement = screenRef.current;
    if (!screenElement) {
      return null;
    }

    const screenRect = screenElement.getBoundingClientRect();
    const target = findAnnotationTargetById(screenElement, annotation.targetId);
    if (target) {
      const targetRect = target.getBoundingClientRect();
      return {
        left: targetRect.left - screenRect.left + targetRect.width * ((annotation.targetOffsetX ?? 50) / 100),
        top: targetRect.top - screenRect.top + targetRect.height * ((annotation.targetOffsetY ?? 50) / 100),
        targetRect: {
          left: targetRect.left - screenRect.left,
          top: targetRect.top - screenRect.top,
          width: targetRect.width,
          height: targetRect.height,
        },
      };
    }

    return {
      left: screenRect.width * (annotation.x / 100),
      top: screenRect.height * (annotation.y / 100),
    };
  }

  function getPopoverStyle(annotation: AnnotationDraft) {
    const screenElement = screenRef.current;
    const point = getAnnotationPoint(annotation);
    if (!screenElement || !point) {
      return undefined;
    }
    const screenRect = screenElement.getBoundingClientRect();
    return {
      left: `${clamp(point.left + 18, 14, Math.max(14, screenRect.width - 326))}px`,
      top: `${clamp(point.top - 34, 14, Math.max(14, screenRect.height - 336))}px`,
    };
  }

  function getTargetFrame(targetId?: string) {
    const screenElement = screenRef.current;
    if (!screenElement || !targetId) {
      return undefined;
    }

    const target = findAnnotationTargetById(screenElement, targetId);
    if (!target) {
      return undefined;
    }

    const screenRect = screenElement.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    return {
      left: targetRect.left - screenRect.left,
      top: targetRect.top - screenRect.top,
      width: targetRect.width,
      height: targetRect.height,
    };
  }

  function addLinkAttachment() {
    const url = normalizeAttachmentUrl(draftLinkUrl);
    if (!url) {
      return;
    }
    onAddDraftAttachments([
      {
        id: createAnnotationAttachmentId(),
        kind: "link",
        label: url.replace(/^https?:\/\//, ""),
        url,
      },
    ]);
    setDraftLinkUrl("");
  }

  async function addFileAttachments(files: FileList | null) {
    const acceptedFiles = Array.from(files || []).filter((file) => {
      return file.type.startsWith("image/") || file.type.startsWith("audio/");
    });
    const safeFiles = acceptedFiles.filter((file) => file.size <= MAX_ANNOTATION_ATTACHMENT_BYTES);
    if (acceptedFiles.length !== safeFiles.length) {
      window.alert("单个批注附件暂时限制在 5MB 以内。");
    }
    if (safeFiles.length === 0) {
      return;
    }
    const attachments = await Promise.all(safeFiles.map(fileToAnnotationAttachment));
    onAddDraftAttachments(attachments);
  }

  const visibleAnnotations = showAnnotations
    ? annotations.filter((annotation) => annotation.targetId && annotation.viewKey === viewKey)
    : [];
  const activeAnnotation = visibleAnnotations.find((annotation) => annotation.id === activeAnnotationId);
  const activeTargetFrame = draft
    ? getAnnotationPoint(draft)?.targetRect
    : activeAnnotation
      ? getAnnotationPoint(activeAnnotation)?.targetRect
      : undefined;
  const hoverTargetFrame = annotationMode && !draft
    ? getTargetFrame(hoverTarget?.targetId)
    : undefined;
  const draftStyle = draft ? getPopoverStyle(draft) : undefined;

  return (
    <div className={annotationMode ? "annotation-layer enabled" : "annotation-layer"}>
      {activeTargetFrame && !hoverTargetFrame ? (
        <div
          className="annotation-target-frame selected"
          style={{
            left: `${activeTargetFrame.left}px`,
            top: `${activeTargetFrame.top}px`,
            width: `${activeTargetFrame.width}px`,
            height: `${activeTargetFrame.height}px`,
          }}
        />
      ) : null}

      {hoverTargetFrame ? (
        <div
          className="annotation-target-frame hover"
          aria-label={`当前悬停组件：${hoverTarget?.targetLabel || currentViewLabel}`}
          style={{
            left: `${hoverTargetFrame.left}px`,
            top: `${hoverTargetFrame.top}px`,
            width: `${hoverTargetFrame.width}px`,
            height: `${hoverTargetFrame.height}px`,
          }}
        />
      ) : null}

      {visibleAnnotations.map((annotation) => {
        const annotationNumber = annotations.findIndex((item) => item.id === annotation.id) + 1;
        const annotationPoint = getAnnotationPoint(annotation);
        return (
          <button
            key={annotation.id}
            className={activeAnnotationId === annotation.id ? "annotation-pin active" : "annotation-pin"}
            style={{
              left: `${annotationPoint?.left ?? -999}px`,
              top: `${annotationPoint?.top ?? -999}px`,
            }}
            onClick={() => onEdit(annotation)}
            aria-label={`编辑批注 ${annotationNumber}`}
          >
            {annotationNumber}
          </button>
        );
      })}

      {draft ? (
        <form
          className="annotation-popover"
          style={draftStyle}
          onSubmit={(event) => {
            event.preventDefault();
            onSaveDraft();
          }}
        >
          <div className="annotation-popover-header">
            <span>{draft.id ? "编辑批注" : "新增批注"}</span>
            <small>{draft.targetLabel || currentViewLabel}</small>
          </div>
          <label className="annotation-text-field">
            <span>意见</span>
            <textarea
              value={draft.text}
              onChange={(event) => onDraftTextChange(event.target.value)}
              placeholder="写下你不满意的地方，或想怎么改..."
              autoFocus
            />
          </label>
          <div className="annotation-link-row">
            <input
              value={draftLinkUrl}
              onChange={(event) => setDraftLinkUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addLinkAttachment();
                }
              }}
              placeholder="粘贴链接"
            />
            <button type="button" onClick={addLinkAttachment} aria-label="添加链接">
              <Link2 size={15} />
            </button>
          </div>
          <div className="annotation-attachment-tools">
            <label>
              <ImagePlus size={15} />
              图片
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  void addFileAttachments(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <label>
              <Mic size={15} />
              音频
              <input
                type="file"
                accept="audio/*"
                multiple
                onChange={(event) => {
                  void addFileAttachments(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>
          {draft.attachments?.length ? (
            <ul className="annotation-attachment-list">
              {draft.attachments.map((attachment) => (
                <li key={attachment.id}>
                  <span>{attachment.kind === "link" ? "链接" : attachment.kind === "image" ? "图片" : "音频"}</span>
                  <b>{attachment.label}</b>
                  <button
                    type="button"
                    onClick={() => onRemoveDraftAttachment(attachment.id)}
                    aria-label={`移除附件 ${attachment.label}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="annotation-popover-actions">
            {draft.id ? (
              <button type="button" className="danger" onClick={onDeleteDraft}>
                删除
              </button>
            ) : null}
            <button type="button" onClick={onCancelDraft}>
              取消
            </button>
            <button type="submit" className="save">
              保存
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

export function App() {
  const screenRef = useRef<HTMLDivElement>(null);
  const appScreenRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<ContentItem[]>(contentItems);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [activeTab, setActiveTab] = useState<AppTab>("content");
  const [readerItem, setReaderItem] = useState<ContentItem | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(() => loadIdSet(LIKED_IDS_KEY));
  const [dislikedIds, setDislikedIds] = useState<Set<string>>(() => loadIdSet(DISLIKED_IDS_KEY));
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => loadIdSet(FAVORITE_IDS_KEY));
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => loadIdSet(HIDDEN_IDS_KEY));
  const [selectedBlockTargets, setSelectedBlockTargets] = useState<Set<string>>(() =>
    loadIdSet(BLOCK_TARGETS_KEY),
  );
  const [blockActive, setBlockActive] = useState(
    () => localStorage.getItem(BLOCK_ACTIVE_KEY) === "true",
  );
  const [reminderEnabled, setReminderEnabled] = useState(
    () => localStorage.getItem(REMINDER_ENABLED_KEY) !== "false",
  );
  const [annotationMode, setAnnotationMode] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [annotations, setAnnotations] = useState<Annotation[]>(loadAnnotations);
  const [annotationDraft, setAnnotationDraft] = useState<AnnotationDraft | null>(null);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [hoverAnnotationTarget, setHoverAnnotationTarget] = useState<AnnotationHoverTarget | null>(null);
  const [annotationLayoutVersion, setAnnotationLayoutVersion] = useState(0);
  const [copiedAnnotations, setCopiedAnnotations] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => loadIdSet(READ_IDS_KEY));
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    loadContentItems()
      .then((nextItems) => {
        setItems(nextItems.length > 0 ? nextItems : contentItems);
        setLoadError("");
      })
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : "内容读取失败");
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    authRequest<AuthResponse>("/api/auth/session")
      .then((response) => {
        setSessionUser(response.user || null);
        setAuthError("");
      })
      .catch(() => {
        // NOTE: 本地 Vite 预览没有 Worker API，账号功能只在 Cloudflare Worker 线上版完整启用。
        setAuthError("线上版会启用账号系统；本地预览暂时只看界面。");
      });
  }, []);

  useEffect(() => {
    screenRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [readerItem]);

  useEffect(() => {
    try {
      localStorage.setItem(ANNOTATION_STORAGE_KEY, JSON.stringify(annotations));
    } catch (error) {
      console.warn("批注保存失败，可能是附件太大。", error);
    }
  }, [annotations]);

  useEffect(() => {
    function updateAnnotationLayout() {
      setAnnotationLayoutVersion((currentVersion) => currentVersion + 1);
    }

    window.addEventListener("resize", updateAnnotationLayout);
    return () => window.removeEventListener("resize", updateAnnotationLayout);
  }, []);

  const currentViewKey = readerItem ? `reader:${safeAnnotationId(readerItem.id)}` : activeTab;
  const currentViewLabel = readerItem
    ? `阅读页：${readerItem.title}`
    : activeTab === "blocking"
      ? "屏蔽页"
      : activeTab === "favorites"
        ? "收藏页"
        : activeTab === "profile"
          ? "我的页"
          : "内容页";

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSource = sourceFilter === "all" || item.sourceType === sourceFilter;
      const searchText = `${item.title} ${item.sourceName} ${item.excerpt}`.toLowerCase();
      const isVisible = !readIds.has(item.id) && !hiddenIds.has(item.id);
      return isVisible && matchesSource && searchText.includes(query.trim().toLowerCase());
    });
  }, [hiddenIds, items, query, readIds, sourceFilter]);

  const sourceOptions = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.sourceType)));
  }, [items]);

  const favoriteItems = useMemo(() => {
    return items.filter((item) => favoriteIds.has(item.id));
  }, [favoriteIds, items]);

  function cycleSourceFilter() {
    if (sourceFilter === "all") {
      setSourceFilter(sourceOptions[0] || "all");
      return;
    }
    const currentIndex = sourceOptions.indexOf(sourceFilter);
    const nextSource = sourceOptions[currentIndex + 1];
    setSourceFilter(nextSource || "all");
  }

  function markRead(item: ContentItem) {
    const nextReadIds = new Set(readIds);
    nextReadIds.add(item.id);
    setReadIds(nextReadIds);
    saveIdSet(READ_IDS_KEY, nextReadIds);
    setReaderItem(null);
  }

  function hideItem(item: ContentItem) {
    const nextHiddenIds = new Set(hiddenIds);
    nextHiddenIds.add(item.id);
    setHiddenIds(nextHiddenIds);
    saveIdSet(HIDDEN_IDS_KEY, nextHiddenIds);
    setReaderItem(null);
  }

  function setFeedbackSignal(item: ContentItem, signal: FeedbackSignal) {
    const nextLikedIds = new Set(likedIds);
    const nextDislikedIds = new Set(dislikedIds);

    if (signal === "liked") {
      if (nextLikedIds.has(item.id)) {
        nextLikedIds.delete(item.id);
      } else {
        nextLikedIds.add(item.id);
      }
      nextDislikedIds.delete(item.id);
    } else {
      if (nextDislikedIds.has(item.id)) {
        nextDislikedIds.delete(item.id);
      } else {
        nextDislikedIds.add(item.id);
      }
      nextLikedIds.delete(item.id);
    }

    setLikedIds(nextLikedIds);
    setDislikedIds(nextDislikedIds);
    saveIdSet(LIKED_IDS_KEY, nextLikedIds);
    saveIdSet(DISLIKED_IDS_KEY, nextDislikedIds);
  }

  function toggleFavorite(item: ContentItem) {
    const nextFavoriteIds = new Set(favoriteIds);
    if (nextFavoriteIds.has(item.id)) {
      nextFavoriteIds.delete(item.id);
    } else {
      nextFavoriteIds.add(item.id);
    }
    setFavoriteIds(nextFavoriteIds);
    saveIdSet(FAVORITE_IDS_KEY, nextFavoriteIds);
  }

  function feedbackSignalFor(item: ContentItem): FeedbackSignal | null {
    if (likedIds.has(item.id)) {
      return "liked";
    }
    if (dislikedIds.has(item.id)) {
      return "disliked";
    }
    return null;
  }

  function handleTabChange(tab: AppTab) {
    setReaderItem(null);
    setActiveTab(tab);
    setAnnotationDraft(null);
    setHoverAnnotationTarget(null);
    window.setTimeout(() => screenRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 0);
  }

  function toggleBlockTarget(id: string) {
    const nextTargets = new Set(selectedBlockTargets);
    if (nextTargets.has(id)) {
      nextTargets.delete(id);
    } else {
      nextTargets.add(id);
    }
    setSelectedBlockTargets(nextTargets);
    saveIdSet(BLOCK_TARGETS_KEY, nextTargets);
    if (nextTargets.size === 0) {
      setBlockActive(false);
      localStorage.setItem(BLOCK_ACTIVE_KEY, "false");
    }
  }

  function toggleBlockActive() {
    if (selectedBlockTargets.size === 0) {
      return;
    }
    setBlockActive((currentValue) => {
      localStorage.setItem(BLOCK_ACTIVE_KEY, String(!currentValue));
      return !currentValue;
    });
  }

  function resetReadingState() {
    setReadIds(new Set());
    setHiddenIds(new Set());
    saveIdSet(READ_IDS_KEY, new Set());
    saveIdSet(HIDDEN_IDS_KEY, new Set());
  }

  function resetFeedbackState() {
    setLikedIds(new Set());
    setDislikedIds(new Set());
    saveIdSet(LIKED_IDS_KEY, new Set());
    saveIdSet(DISLIKED_IDS_KEY, new Set());
  }

  function toggleReminder() {
    setReminderEnabled((currentValue) => {
      localStorage.setItem(REMINDER_ENABLED_KEY, String(!currentValue));
      return !currentValue;
    });
  }

  async function login(email: string, password: string) {
    const response = await authRequest<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setSessionUser(response.user || null);
    setAuthError("");
  }

  async function register(email: string, password: string, displayName: string) {
    const response = await authRequest<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, displayName }),
    });
    setAuthError("");
    return response;
  }

  async function logout() {
    await authRequest<AuthResponse>("/api/auth/logout", { method: "POST", body: "{}" });
    setSessionUser(null);
  }

  function createAnnotationDraft(draft: AnnotationDraft) {
    setCopiedAnnotations(false);
    setActiveAnnotationId(null);
    setAnnotationDraft(draft);
  }

  function handleAnnotationPointerMove(event: MouseEvent<HTMLDivElement>) {
    if (!annotationMode || annotationDraft) {
      return;
    }
    const eventElement = event.target instanceof Element ? event.target : null;
    if (eventElement?.closest(".annotation-pin, .annotation-popover")) {
      setHoverAnnotationTarget(null);
      return;
    }

    const target = findAnnotationTargetElement(eventElement, appScreenRef.current);
    const targetId = target?.dataset.annotationTarget;
    if (!targetId) {
      setHoverAnnotationTarget(null);
      return;
    }

    const targetLabel = target.dataset.annotationLabel || currentViewLabel;
    setHoverAnnotationTarget((currentTarget) =>
      currentTarget?.targetId === targetId && currentTarget.targetLabel === targetLabel
        ? currentTarget
        : { targetId, targetLabel },
    );
  }

  function handleAnnotationPointerClick(event: MouseEvent<HTMLDivElement>) {
    if (!annotationMode) {
      return;
    }
    const eventElement = event.target instanceof Element ? event.target : null;
    if (eventElement?.closest(".annotation-pin, .annotation-popover")) {
      return;
    }

    const screenElement = appScreenRef.current;
    if (!screenElement) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const target = findAnnotationTargetElement(eventElement, screenElement);
    const screenRect = screenElement.getBoundingClientRect();
    const targetRect = target?.getBoundingClientRect();
    const fallbackX = ((event.clientX - screenRect.left) / screenRect.width) * 100;
    const fallbackY = ((event.clientY - screenRect.top) / screenRect.height) * 100;

    createAnnotationDraft({
      x: fallbackX,
      y: fallbackY,
      text: "",
      attachments: [],
      targetId: target?.dataset.annotationTarget,
      targetLabel: target?.dataset.annotationLabel || currentViewLabel,
      targetOffsetX: targetRect ? ((event.clientX - targetRect.left) / targetRect.width) * 100 : undefined,
      targetOffsetY: targetRect ? ((event.clientY - targetRect.top) / targetRect.height) * 100 : undefined,
      viewKey: currentViewKey,
      viewLabel: currentViewLabel,
    });
  }

  function editAnnotation(annotation: Annotation) {
    setAnnotationMode(true);
    setShowAnnotations(true);
    setActiveAnnotationId(annotation.id);
    setAnnotationDraft({
      id: annotation.id,
      x: annotation.x,
      y: annotation.y,
      text: annotation.text,
      attachments: annotation.attachments || [],
      targetId: annotation.targetId,
      targetLabel: annotation.targetLabel,
      targetOffsetX: annotation.targetOffsetX,
      targetOffsetY: annotation.targetOffsetY,
      viewKey: annotation.viewKey,
      viewLabel: annotation.viewLabel,
    });
  }

  function saveAnnotationDraft() {
    if (!annotationDraft) {
      return;
    }

    const text = annotationDraft.text.trim();
    const attachments = annotationDraft.attachments || [];
    if (!text && attachments.length === 0) {
      return;
    }

    if (annotationDraft.id) {
      setAnnotations((currentAnnotations) =>
        currentAnnotations.map((annotation) =>
          annotation.id === annotationDraft.id
            ? { ...annotation, text, attachments, x: annotationDraft.x, y: annotationDraft.y }
            : annotation,
        ),
      );
      setActiveAnnotationId(annotationDraft.id);
    } else {
      const annotation: Annotation = {
        id: createAnnotationId(),
        x: annotationDraft.x,
        y: annotationDraft.y,
        text,
        attachments,
        viewLabel: annotationDraft.viewLabel || currentViewLabel,
        createdAt: new Date().toISOString(),
        targetId: annotationDraft.targetId,
        targetLabel: annotationDraft.targetLabel,
        targetOffsetX: annotationDraft.targetOffsetX,
        targetOffsetY: annotationDraft.targetOffsetY,
        viewKey: annotationDraft.viewKey || currentViewKey,
      };
      setAnnotations((currentAnnotations) => [...currentAnnotations, annotation]);
      setActiveAnnotationId(annotation.id);
    }

    setAnnotationDraft(null);
    setHoverAnnotationTarget(null);
  }

  function deleteAnnotation(id: string) {
    setAnnotations((currentAnnotations) =>
      currentAnnotations.filter((annotation) => annotation.id !== id),
    );
    setAnnotationDraft((currentDraft) => (currentDraft?.id === id ? null : currentDraft));
    setActiveAnnotationId((currentId) => (currentId === id ? null : currentId));
    setHoverAnnotationTarget(null);
  }

  function addDraftAttachments(attachments: AnnotationAttachment[]) {
    if (attachments.length === 0) {
      return;
    }
    setAnnotationDraft((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }
      return {
        ...currentDraft,
        attachments: [...(currentDraft.attachments || []), ...attachments],
      };
    });
  }

  function removeDraftAttachment(attachmentId: string) {
    setAnnotationDraft((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }
      return {
        ...currentDraft,
        attachments: (currentDraft.attachments || []).filter(
          (attachment) => attachment.id !== attachmentId,
        ),
      };
    });
  }

  function clearAnnotations() {
    if (annotations.length === 0) {
      return;
    }
    setAnnotations([]);
    setAnnotationDraft(null);
    setActiveAnnotationId(null);
    setHoverAnnotationTarget(null);
    setCopiedAnnotations(false);
  }

  async function copyAnnotationsForCodex() {
    const text = formatAnnotationsForCodex(annotations);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopiedAnnotations(true);
    window.setTimeout(() => setCopiedAnnotations(false), 1800);
  }

  function downloadAnnotations() {
    const text = formatAnnotationsForCodex(annotations);
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `worthyscroll-批注-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className={annotationMode ? "prototype-stage annotation-mode" : "prototype-stage"}>
      <AnnotationToolbar
        annotationMode={annotationMode}
        showAnnotations={showAnnotations}
        annotationCount={annotations.length}
        copied={copiedAnnotations}
        onToggleMode={() => {
          setAnnotationMode((currentMode) => !currentMode);
          setAnnotationDraft(null);
          setHoverAnnotationTarget(null);
        }}
        onToggleVisibility={() => setShowAnnotations((currentValue) => !currentValue)}
        onCopy={copyAnnotationsForCodex}
        onDownload={downloadAnnotations}
        onClear={clearAnnotations}
      />

      <div className="prototype-workbench">
        <div className="preview-surface">
          <div className="phone-shell">
            <div
              className="app-screen"
              ref={appScreenRef}
              onMouseMoveCapture={handleAnnotationPointerMove}
              onMouseLeave={() => setHoverAnnotationTarget(null)}
              onClickCapture={handleAnnotationPointerClick}
            >
              <PhoneStatusBar />

              <div
                className="app-viewport"
                ref={screenRef}
                onScroll={() =>
                  setAnnotationLayoutVersion((currentVersion) => currentVersion + 1)
                }
              >
                {readerItem ? (
                  <ReaderView
                    item={readerItem}
                    onClose={() => setReaderItem(null)}
                    onMarkRead={markRead}
                    onHide={hideItem}
                    onSignal={setFeedbackSignal}
                    feedbackSignal={feedbackSignalFor(readerItem)}
                  />
                ) : activeTab === "content" ? (
                  <ContentHome
                    items={filteredItems}
                    isLoading={isLoading}
                    query={query}
                    sourceFilter={sourceFilter}
                    viewMode={viewMode}
                    onQueryChange={setQuery}
                    onCycleSourceFilter={cycleSourceFilter}
                    onViewModeChange={setViewMode}
                    onOpenItem={setReaderItem}
                    favoriteIds={favoriteIds}
                    onToggleFavorite={toggleFavorite}
                  />
                ) : activeTab === "favorites" ? (
                  <FavoritesHome
                    items={favoriteItems}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    onOpenItem={setReaderItem}
                    favoriteIds={favoriteIds}
                    onToggleFavorite={toggleFavorite}
                  />
                ) : activeTab === "blocking" ? (
                  <BlockingView
                    selectedTargets={selectedBlockTargets}
                    blockActive={blockActive}
                    onToggleTarget={toggleBlockTarget}
                    onToggleBlock={toggleBlockActive}
                  />
                ) : (
                  <ProfileView
                    readCount={readIds.size}
                    likedCount={likedIds.size}
                    dislikedCount={dislikedIds.size}
                    sessionUser={sessionUser}
                    authError={authError}
                    onLogin={login}
                    onRegister={register}
                    onLogout={logout}
                    onResetReading={resetReadingState}
                    onResetFeedback={resetFeedbackState}
                    reminderEnabled={reminderEnabled}
                    onToggleReminder={toggleReminder}
                  />
                )}
              </div>

              {!readerItem ? (
                <BottomTabBar activeTab={activeTab} onChange={handleTabChange} />
              ) : null}

              <AnnotationLayer
                annotations={annotations}
                draft={annotationDraft}
                annotationMode={annotationMode}
                showAnnotations={showAnnotations}
                activeAnnotationId={activeAnnotationId}
                hoverTarget={hoverAnnotationTarget}
                screenRef={appScreenRef}
                viewKey={currentViewKey}
                currentViewLabel={currentViewLabel}
                layoutVersion={annotationLayoutVersion}
                onEdit={editAnnotation}
                onDraftTextChange={(text) =>
                  setAnnotationDraft((currentDraft) =>
                    currentDraft ? { ...currentDraft, text } : currentDraft,
                  )
                }
                onAddDraftAttachments={addDraftAttachments}
                onRemoveDraftAttachment={removeDraftAttachment}
                onSaveDraft={saveAnnotationDraft}
                onCancelDraft={() => {
                  setAnnotationDraft(null);
                  setHoverAnnotationTarget(null);
                }}
                onDeleteDraft={() => {
                  if (annotationDraft?.id) {
                    deleteAnnotation(annotationDraft.id);
                  }
                }}
              />
            </div>
          </div>
        </div>

        {showAnnotations ? (
          <AnnotationPanel
            annotations={annotations}
            activeAnnotationId={activeAnnotationId}
            onEdit={editAnnotation}
            onDelete={deleteAnnotation}
          />
        ) : null}
      </div>
    </main>
  );
}
