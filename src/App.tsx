import {
  Archive,
  ArrowLeft,
  Bell,
  BookMarked,
  Check,
  ChevronDown,
  Clipboard,
  Download,
  Eye,
  EyeOff,
  Grid2X2,
  Hand,
  List,
  MoreHorizontal,
  PenLine,
  RotateCcw,
  Search,
  Settings,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { ContentItem, contentItems } from "./content-items";

type ViewMode = "grid" | "list";
type SourceFilter = "all" | ContentItem["sourceType"];
type AppTab = "content" | "blocking" | "profile";
type FeedbackSignal = "liked" | "disliked";
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
  viewLabel: string;
  createdAt: string;
};
type AnnotationDraft = {
  id?: string;
  x: number;
  y: number;
  text: string;
};

const sourceLabel: Record<ContentItem["sourceType"], string> = {
  wechat_article: "公众号",
  wechat_video: "视频号",
  wechat_note: "微信笔记",
  substack: "Substack",
};

const ANNOTATION_STORAGE_KEY = "worthyscroll-annotations";
const READ_IDS_KEY = "shortvideo-read-ids";
const LIKED_IDS_KEY = "worthyscroll-liked-ids";
const DISLIKED_IDS_KEY = "worthyscroll-disliked-ids";
const HIDDEN_IDS_KEY = "worthyscroll-hidden-ids";
const BLOCK_TARGETS_KEY = "worthyscroll-block-targets";
const BLOCK_ACTIVE_KEY = "worthyscroll-block-active";
const REMINDER_ENABLED_KEY = "worthyscroll-reminder-enabled";

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

function loadAnnotations(): Annotation[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(ANNOTATION_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
      `- 位置：x=${annotation.x.toFixed(1)}%, y=${annotation.y.toFixed(1)}%`,
      `- 内容：${annotation.text}`,
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
  if (item.visual === "note") {
    return (
      <div className="preview note-preview">
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
      <div className="preview poster-preview">
        <div className="poster-couch" />
        <div className="poster-line" />
        <strong>CMI</strong>
        <span>即兴 · 戏剧 · 声音</span>
      </div>
    );
  }

  if (item.visual === "video") {
    return (
      <div className="preview video-preview">
        <div className="video-strip strip-one" />
        <div className="video-strip strip-two" />
        <div className="play-mark">▶</div>
        <span>AI MV</span>
      </div>
    );
  }

  if (item.visual === "stack") {
    return (
      <div className="preview stack-preview">
        <div className="small-paper one" />
        <div className="small-paper two" />
        <div className="small-paper three" />
        <span>AI Tarot</span>
      </div>
    );
  }

  return (
    <div className="preview document-preview">
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
  onOpen,
}: {
  item: ContentItem;
  viewMode: ViewMode;
  onOpen: (item: ContentItem) => void;
}) {
  return (
    <button className={`content-card ${viewMode}`} onClick={() => onOpen(item)}>
      <div className="card-header">
        <div>
          <h2>{item.title}</h2>
          <p>{item.savedAt}</p>
        </div>
        <MoreHorizontal size={22} strokeWidth={2.6} />
      </div>
      <PreviewArtwork item={item} />
      <div className="card-meta">
        <span>{sourceLabel[item.sourceType]}</span>
        <span>{item.estimatedMinutes} 分钟</span>
      </div>
    </button>
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
    <article className="reader-view">
      <header className="reader-nav">
        <button onClick={onClose} aria-label="返回内容页">
          <ArrowLeft size={25} strokeWidth={2.4} />
        </button>
        <span>阅读中</span>
        <button onClick={() => onMarkRead(item)} aria-label="标为已读">
          <Check size={23} strokeWidth={2.5} />
        </button>
      </header>

      <div className="reader-meta">
        <span>{sourceLabel[item.sourceType]}</span>
        <span>{item.savedAt}</span>
        <span>{item.estimatedMinutes} 分钟</span>
      </div>

      <h1>{item.title}</h1>

      {item.author || item.sourceName ? (
        <p className="reader-byline">
          {[item.sourceName, item.author].filter(Boolean).join(" · ")}
        </p>
      ) : null}

      <div className="reader-actions-bar">
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
            return <h2 key={`${block.type}-${index}`}>{block.text}</h2>;
          }
          if (block.type === "section") {
            return (
              <div className="reader-section-marker" key={`${block.type}-${index}`}>
                {block.text}
              </div>
            );
          }
          if (block.type === "image") {
            return (
              <figure key={`${block.type}-${index}`}>
                <img src={block.src} alt={block.alt} loading="lazy" />
              </figure>
            );
          }
          return <p key={`${block.type}-${index}`}>{block.text}</p>;
        })}
      </div>
    </article>
  );
}

function ContentHome({
  items,
  isLoading,
  loadError,
  query,
  sourceFilter,
  viewMode,
  onQueryChange,
  onCycleSourceFilter,
  onViewModeChange,
  onOpenItem,
  onOpenProfile,
}: {
  items: ContentItem[];
  isLoading: boolean;
  loadError: string;
  query: string;
  sourceFilter: SourceFilter;
  viewMode: ViewMode;
  onQueryChange: (query: string) => void;
  onCycleSourceFilter: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  onOpenItem: (item: ContentItem) => void;
  onOpenProfile: () => void;
}) {
  return (
    <section className="app-page content-page">
      <header className="brand-header">
        <div>
          <p>WorthyScroll</p>
          <h1>值得刷</h1>
        </div>
        <button aria-label="打开我的" onClick={onOpenProfile}>
          <MoreHorizontal size={28} strokeWidth={2.5} />
        </button>
      </header>

      <label className="search-box">
        <Search size={24} strokeWidth={2.4} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索内容"
        />
      </label>

      <div className="filter-bar">
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

      <div className="content-summary">
        <strong>{isLoading ? "整理中" : `${items.length} 条内容`}</strong>
        <span>{loadError || "把保存过的内容整理成可读内容流"}</span>
      </div>

      <section className={`content-grid ${viewMode}`}>
        {items.map((item) => (
          <ContentCard key={item.id} item={item} viewMode={viewMode} onOpen={onOpenItem} />
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

  return (
    <section className="app-page blocking-page">
      <header className="section-header">
        <p>防沉迷</p>
        <h1>把低质量入口挡住</h1>
      </header>

      <div className={blockActive ? "block-status active" : "block-status"}>
        <Shield size={24} />
        <div>
          <strong>{blockActive ? "屏蔽中" : "未开启"}</strong>
          <span>{selectedTargets.size} 个目标应用</span>
        </div>
      </div>

      <div className="target-list">
        {targets.map((target) => {
          const selected = selectedTargets.has(target.id);
          return (
            <button
              key={target.id}
              className={selected ? "target-row selected" : "target-row"}
              onClick={() => onToggleTarget(target.id)}
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
  onResetReading,
  onResetFeedback,
  reminderEnabled,
  onToggleReminder,
}: {
  readCount: number;
  likedCount: number;
  dislikedCount: number;
  onResetReading: () => void;
  onResetFeedback: () => void;
  reminderEnabled: boolean;
  onToggleReminder: () => void;
}) {
  return (
    <section className="app-page profile-page">
      <header className="section-header">
        <p>我的</p>
        <h1>阅读记录</h1>
      </header>

      <div className="stats-grid">
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

      <div className="settings-list">
        <button onClick={onToggleReminder}>
          <Bell size={18} />
          <span>每天提醒我读一点</span>
          <i>{reminderEnabled ? "开" : "关"}</i>
        </button>
        <button onClick={onResetReading}>
          <RotateCcw size={18} />
          <span>恢复已读内容</span>
        </button>
        <button onClick={onResetFeedback}>
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
    { id: "blocking", label: "屏蔽", icon: Hand },
    { id: "profile", label: "我的", icon: Settings },
  ];

  return (
    <nav className="bottom-tab-bar" aria-label="主导航">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => onChange(tab.id)}
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
      <p>{annotationMode ? "点预览里的任意位置，连续留下多条意见。" : "批注会保存在本机浏览器里。"}</p>
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
      <div>
        <p>批注</p>
        <strong>{annotations.length}</strong>
      </div>

      {annotations.length === 0 ? (
        <p className="annotation-empty">打开批注模式后，在手机预览上点一下就能写意见。</p>
      ) : (
        <ol>
          {annotations.map((annotation, index) => (
            <li
              key={annotation.id}
              className={activeAnnotationId === annotation.id ? "active" : ""}
            >
              <button onClick={() => onEdit(annotation)}>
                <span>{index + 1}</span>
                <small>{annotation.viewLabel}</small>
                <b>{annotation.text}</b>
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
  onCreateDraft,
  onEdit,
  onDraftTextChange,
  onSaveDraft,
  onCancelDraft,
  onDeleteDraft,
}: {
  annotations: Annotation[];
  draft: AnnotationDraft | null;
  annotationMode: boolean;
  showAnnotations: boolean;
  activeAnnotationId: string | null;
  onCreateDraft: (x: number, y: number) => void;
  onEdit: (annotation: Annotation) => void;
  onDraftTextChange: (text: string) => void;
  onSaveDraft: () => void;
  onCancelDraft: () => void;
  onDeleteDraft: () => void;
}) {
  const visibleAnnotations = showAnnotations ? annotations : [];
  const draftStyle = draft
    ? {
        left: `${Math.min(draft.x, 66)}%`,
        top: `${Math.min(draft.y, 78)}%`,
      }
    : undefined;

  function handleLayerClick(event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    onCreateDraft(
      ((event.clientX - rect.left) / rect.width) * 100,
      ((event.clientY - rect.top) / rect.height) * 100,
    );
  }

  return (
    <div className={annotationMode ? "annotation-layer enabled" : "annotation-layer"}>
      {annotationMode ? (
        <button
          className="annotation-hit-area"
          aria-label="添加批注"
          onClick={handleLayerClick}
        />
      ) : null}

      {visibleAnnotations.map((annotation, index) => (
        <button
          key={annotation.id}
          className={activeAnnotationId === annotation.id ? "annotation-pin active" : "annotation-pin"}
          style={{ left: `${annotation.x}%`, top: `${annotation.y}%` }}
          onClick={() => onEdit(annotation)}
          aria-label={`编辑批注 ${index + 1}`}
        >
          {index + 1}
        </button>
      ))}

      {draft ? (
        <form
          className="annotation-popover"
          style={draftStyle}
          onSubmit={(event) => {
            event.preventDefault();
            onSaveDraft();
          }}
        >
          <label>
            <span>{draft.id ? "编辑批注" : "新增批注"}</span>
            <textarea
              value={draft.text}
              onChange={(event) => onDraftTextChange(event.target.value)}
              placeholder="写下你不满意的地方，或想怎么改..."
              autoFocus
            />
          </label>
          <div>
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
  const [items, setItems] = useState<ContentItem[]>(contentItems);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [activeTab, setActiveTab] = useState<AppTab>("content");
  const [readerItem, setReaderItem] = useState<ContentItem | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(() => loadIdSet(LIKED_IDS_KEY));
  const [dislikedIds, setDislikedIds] = useState<Set<string>>(() => loadIdSet(DISLIKED_IDS_KEY));
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
  const [copiedAnnotations, setCopiedAnnotations] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => loadIdSet(READ_IDS_KEY));

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
    screenRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [readerItem]);

  useEffect(() => {
    localStorage.setItem(ANNOTATION_STORAGE_KEY, JSON.stringify(annotations));
  }, [annotations]);

  const currentViewLabel = readerItem
    ? `阅读页：${readerItem.title}`
    : activeTab === "blocking"
      ? "屏蔽页"
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

  function createAnnotationDraft(x: number, y: number) {
    setCopiedAnnotations(false);
    setActiveAnnotationId(null);
    setAnnotationDraft({ x, y, text: "" });
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
    });
  }

  function saveAnnotationDraft() {
    if (!annotationDraft) {
      return;
    }

    const text = annotationDraft.text.trim();
    if (!text) {
      return;
    }

    if (annotationDraft.id) {
      setAnnotations((currentAnnotations) =>
        currentAnnotations.map((annotation) =>
          annotation.id === annotationDraft.id
            ? { ...annotation, text, x: annotationDraft.x, y: annotationDraft.y }
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
        viewLabel: currentViewLabel,
        createdAt: new Date().toISOString(),
      };
      setAnnotations((currentAnnotations) => [...currentAnnotations, annotation]);
      setActiveAnnotationId(annotation.id);
    }

    setAnnotationDraft(null);
  }

  function deleteAnnotation(id: string) {
    setAnnotations((currentAnnotations) =>
      currentAnnotations.filter((annotation) => annotation.id !== id),
    );
    setAnnotationDraft((currentDraft) => (currentDraft?.id === id ? null : currentDraft));
    setActiveAnnotationId((currentId) => (currentId === id ? null : currentId));
  }

  function clearAnnotations() {
    if (annotations.length === 0) {
      return;
    }
    setAnnotations([]);
    setAnnotationDraft(null);
    setActiveAnnotationId(null);
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
        }}
        onToggleVisibility={() => setShowAnnotations((currentValue) => !currentValue)}
        onCopy={copyAnnotationsForCodex}
        onDownload={downloadAnnotations}
        onClear={clearAnnotations}
      />

      <div className="prototype-workbench">
        <div className="preview-surface">
          <div className="phone-shell">
            <div className="app-screen">
              <PhoneStatusBar />

              <div className="app-viewport" ref={screenRef}>
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
                    loadError={loadError}
                    query={query}
                    sourceFilter={sourceFilter}
                    viewMode={viewMode}
                    onQueryChange={setQuery}
                    onCycleSourceFilter={cycleSourceFilter}
                    onViewModeChange={setViewMode}
                    onOpenItem={setReaderItem}
                    onOpenProfile={() => handleTabChange("profile")}
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
            </div>
          </div>

          <AnnotationLayer
            annotations={annotations}
            draft={annotationDraft}
            annotationMode={annotationMode}
            showAnnotations={showAnnotations}
            activeAnnotationId={activeAnnotationId}
            onCreateDraft={createAnnotationDraft}
            onEdit={editAnnotation}
            onDraftTextChange={(text) =>
              setAnnotationDraft((currentDraft) =>
                currentDraft ? { ...currentDraft, text } : currentDraft,
              )
            }
            onSaveDraft={saveAnnotationDraft}
            onCancelDraft={() => setAnnotationDraft(null)}
            onDeleteDraft={() => {
              if (annotationDraft?.id) {
                deleteAnnotation(annotationDraft.id);
              }
            }}
          />
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
