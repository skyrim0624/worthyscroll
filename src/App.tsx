import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  Clipboard,
  Clock3,
  Download,
  Eye,
  EyeOff,
  Grid2X2,
  Heart,
  List,
  MoreHorizontal,
  PenLine,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { ContentItem, contentItems } from "./content-items";

type ViewMode = "grid" | "list";
type SourceFilter = "all" | ContentItem["sourceType"];
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

const LAST_PICK_KEY = "shortvideo-last-pick";
const ANNOTATION_STORAGE_KEY = "worthyscroll-annotations";

async function loadContentItems(): Promise<ContentItem[]> {
  const response = await fetch(`/content-items.json?ts=${Date.now()}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`内容库存读取失败：${response.status}`);
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

function DetailSheet({
  item,
  onClose,
  onMarkRead,
  onStartRead,
}: {
  item: ContentItem | null;
  onClose: () => void;
  onMarkRead: (item: ContentItem) => void;
  onStartRead: (item: ContentItem) => void;
}) {
  if (!item) {
    return null;
  }

  return (
    <div className="detail-backdrop" onClick={onClose}>
      <section className="detail-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <button className="sheet-close" onClick={onClose} aria-label="关闭">
          <X size={18} />
        </button>
        <PreviewArtwork item={item} />
        <p className="detail-source">
          {sourceLabel[item.sourceType]} · {item.savedAt}
          {item.estimatedMinutes ? ` · ${item.estimatedMinutes} 分钟` : ""}
        </p>
        <h2>{item.title}</h2>
        <p className="detail-excerpt">{item.excerpt}</p>
        <div className="detail-actions">
          <button className="primary-action" onClick={() => onStartRead(item)}>
            <BookOpen size={18} />
            在 App 内阅读
          </button>
          <button>
            <Heart size={18} />
          </button>
          <button onClick={() => onMarkRead(item)}>
            <Check size={18} />
          </button>
        </div>
      </section>
    </div>
  );
}

function ReaderView({
  item,
  onClose,
  onMarkRead,
}: {
  item: ContentItem;
  onClose: () => void;
  onMarkRead: (item: ContentItem) => void;
}) {
  const blocks = useMemo(() => parseReaderBlocks(item), [item]);

  return (
    <article className="reader-view">
      <header className="reader-nav">
        <button onClick={onClose} aria-label="返回库存">
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
        {showAnnotations ? "显示中" : "已隐藏"}
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
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [readerItem, setReaderItem] = useState<ContentItem | null>(null);
  const [annotationMode, setAnnotationMode] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [annotations, setAnnotations] = useState<Annotation[]>(loadAnnotations);
  const [annotationDraft, setAnnotationDraft] = useState<AnnotationDraft | null>(null);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [copiedAnnotations, setCopiedAnnotations] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("shortvideo-read-ids") || "[]"));
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    loadContentItems()
      .then((nextItems) => {
        setItems(nextItems.length > 0 ? nextItems : contentItems);
        setLoadError("");
      })
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : "内容库存读取失败");
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    screenRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [readerItem]);

  useEffect(() => {
    localStorage.setItem(ANNOTATION_STORAGE_KEY, JSON.stringify(annotations));
  }, [annotations]);

  const currentViewLabel = readerItem ? `阅读页：${readerItem.title}` : "库存页";

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSource = sourceFilter === "all" || item.sourceType === sourceFilter;
      const searchText = `${item.title} ${item.sourceName} ${item.excerpt}`.toLowerCase();
      const isUnread = !readIds.has(item.id);
      return isUnread && matchesSource && searchText.includes(query.trim().toLowerCase());
    });
  }, [items, query, readIds, sourceFilter]);

  const sourceOptions = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.sourceType)));
  }, [items]);

  const totalMinutes = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + item.estimatedMinutes, 0);
  }, [filteredItems]);

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
    localStorage.setItem("shortvideo-read-ids", JSON.stringify(Array.from(nextReadIds)));
    setSelectedItem(null);
    setReaderItem(null);
  }

  function startReading(item: ContentItem) {
    setSelectedItem(null);
    setReaderItem(item);
  }

  function pickNext() {
    if (filteredItems.length === 0) {
      return;
    }
    const lastPick = Number(localStorage.getItem(LAST_PICK_KEY) || "-1");
    const nextIndex = (lastPick + 1) % Math.min(filteredItems.length, 12);
    localStorage.setItem(LAST_PICK_KEY, String(nextIndex));
    setSelectedItem(filteredItems[nextIndex]);
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
            <div className="app-screen" ref={screenRef}>
              <PhoneStatusBar />

              {readerItem ? (
                <ReaderView
                  item={readerItem}
                  onClose={() => setReaderItem(null)}
                  onMarkRead={markRead}
                />
              ) : (
                <>
                  <header className="top-nav">
                    <button aria-label="返回">
                      <ArrowLeft size={30} strokeWidth={2.3} />
                    </button>
                    <h1>未读库存</h1>
                    <button aria-label="更多">
                      <MoreHorizontal size={30} strokeWidth={2.5} />
                    </button>
                  </header>

                  <label className="search-box">
                    <Search size={24} strokeWidth={2.4} />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="搜索..."
                    />
                  </label>

                  <div className="filter-bar">
                    <button
                      className={sourceFilter === "all" ? "active-filter" : ""}
                      onClick={cycleSourceFilter}
                    >
                      {sourceFilter === "all" ? "全部内容" : sourceLabel[sourceFilter]}
                      <ChevronDown size={20} strokeWidth={2.4} />
                    </button>
                    <button>
                      最近同步
                      <ChevronDown size={20} strokeWidth={2.4} />
                    </button>
                    <div className="view-toggle" role="group" aria-label="视图切换">
                      <button
                        className={viewMode === "list" ? "selected" : ""}
                        onClick={() => setViewMode("list")}
                        aria-label="列表视图"
                      >
                        <List size={22} />
                      </button>
                      <button
                        className={viewMode === "grid" ? "selected" : ""}
                        onClick={() => setViewMode("grid")}
                        aria-label="网格视图"
                      >
                        <Grid2X2 size={22} />
                      </button>
                    </div>
                  </div>

                  <section className="daily-rail" aria-label="今日推荐">
                    <Sparkles size={16} />
                    <span>{isLoading ? "同步中" : `${filteredItems.length} 条可读`}</span>
                    <span>{loadError || "从你的公众号库存里挑选"}</span>
                  </section>

                  <section className="shelf-hero">
                    <div>
                      <p>现在刷点好的</p>
                      <h2>从已收藏但没看的内容里挑一条</h2>
                    </div>
                    <button onClick={pickNext}>帮我挑</button>
                  </section>

                  <section className={`content-grid ${viewMode}`}>
                    {filteredItems.map((item) => (
                      <ContentCard
                        key={item.id}
                        item={item}
                        viewMode={viewMode}
                        onOpen={setSelectedItem}
                      />
                    ))}
                  </section>

                  <div className="floating-read-state">
                    <Clock3 size={18} />
                    <span>库存 {totalMinutes} 分钟</span>
                  </div>
                </>
              )}
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

        <AnnotationPanel
          annotations={annotations}
          activeAnnotationId={activeAnnotationId}
          onEdit={editAnnotation}
          onDelete={deleteAnnotation}
        />
      </div>

      <DetailSheet
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onMarkRead={markRead}
        onStartRead={startReading}
      />
    </main>
  );
}
