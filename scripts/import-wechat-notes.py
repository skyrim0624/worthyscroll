#!/usr/bin/env python3
"""把 Obsidian 笔记同步助手目录里的公众号内容导入本地内容货架数据库。"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE_ROOT = Path(os.environ.get("WORTHYSCROLL_SOURCE_ROOT", PROJECT_ROOT / "data/source-notes"))
DEFAULT_DB_PATH = Path(os.environ.get("WORTHYSCROLL_DB_PATH", PROJECT_ROOT / "data/content-shelf.sqlite"))
DEFAULT_EXPORT_PATH = Path(os.environ.get("WORTHYSCROLL_EXPORT_PATH", PROJECT_ROOT / "public/content-items.json"))
AGGREGATE_FILE_PATTERN = re.compile(r"^同步助手_\d{4}-\d{2}-\d{2}\.md$")
OBSIDIAN_IMAGE_PATTERN = re.compile(r"!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]")
MARKDOWN_IMAGE_PATTERN = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")


@dataclass
class ParsedNote:
    item_id: str
    title: str
    source_type: str
    source_name: str
    author: str
    url: str
    saved_at: str
    file_path: Path
    date_folder: str
    markdown: str
    plain_text: str
    excerpt: str
    word_count: int
    estimated_minutes: int
    content_hash: str


def split_frontmatter(raw_text: str) -> tuple[dict[str, str], str]:
    if not raw_text.startswith("---\n"):
        return {}, raw_text

    end_index = raw_text.find("\n---\n", 4)
    if end_index == -1:
        return {}, raw_text

    frontmatter_text = raw_text[4:end_index]
    body = raw_text[end_index + 5 :]
    frontmatter: dict[str, str] = {}

    current_key: str | None = None
    for line in frontmatter_text.splitlines():
        if not line.strip() or line.lstrip().startswith("-"):
            continue
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        current_key = key.strip()
        frontmatter[current_key] = value.strip().strip('"').strip("'")

    return frontmatter, body


def strip_markdown(markdown: str) -> str:
    text = re.sub(r"!\[\[[^\]]+\]\]", " ", markdown)
    text = re.sub(r"!\[[^\]]*\]\([^)]+\)", " ", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"`{1,3}[^`]*`{1,3}", " ", text)
    text = re.sub(r"[*_>#-]+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def extract_title(body: str, fallback: str) -> str:
    for line in body.splitlines():
        line = line.strip()
        if line.startswith("# "):
            return line[2:].strip() or fallback
    return fallback


def classify_source(source_name: str, url: str) -> str:
    source = f"{source_name} {url}"
    if "视频号" in source or "sph/" in source:
        return "wechat_video"
    if "微信" in source or "公众号" in source or "weixin.qq.com" in source:
        return "wechat_article"
    return "wechat_note"


def estimate_reading_minutes(plain_text: str) -> tuple[int, int]:
    # 中文内容按字符更接近真实阅读负担；夹杂英文时也能稳定估算。
    word_count = len(re.sub(r"\s+", "", plain_text))
    minutes = max(1, round(word_count / 600)) if word_count else 1
    return word_count, minutes


def parse_note(file_path: Path, source_root: Path) -> ParsedNote | None:
    if AGGREGATE_FILE_PATTERN.match(file_path.name):
        return None

    raw_text = file_path.read_text(encoding="utf-8", errors="replace")
    frontmatter, body = split_frontmatter(raw_text)

    if "syncedIds" in frontmatter and "id" not in frontmatter:
        return None

    fallback_title = file_path.stem
    title = extract_title(body, fallback_title)
    source_name = frontmatter.get("source", "")
    author = frontmatter.get("author", "")
    url = frontmatter.get("url", "")
    saved_at = frontmatter.get("saved", "")
    item_id = frontmatter.get("id", "")
    if not item_id:
        item_id = hashlib.sha256(str(file_path).encode("utf-8")).hexdigest()[:32]

    plain_text = strip_markdown(body)
    excerpt = plain_text[:260]
    word_count, estimated_minutes = estimate_reading_minutes(plain_text)
    content_hash = hashlib.sha256(raw_text.encode("utf-8")).hexdigest()

    try:
        relative_path = file_path.relative_to(source_root)
        date_folder = relative_path.parts[0] if len(relative_path.parts) > 1 else ""
    except ValueError:
        date_folder = ""

    return ParsedNote(
        item_id=item_id,
        title=title,
        source_type=classify_source(source_name, url),
        source_name=source_name,
        author=author,
        url=url,
        saved_at=saved_at,
        file_path=file_path,
        date_folder=date_folder,
        markdown=body.strip(),
        plain_text=plain_text,
        excerpt=excerpt,
        word_count=word_count,
        estimated_minutes=estimated_minutes,
        content_hash=content_hash,
    )


def ensure_schema(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS content_items (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            source_type TEXT NOT NULL,
            source_name TEXT,
            author TEXT,
            url TEXT,
            saved_at TEXT,
            file_path TEXT NOT NULL UNIQUE,
            date_folder TEXT,
            markdown TEXT NOT NULL,
            plain_text TEXT NOT NULL,
            excerpt TEXT,
            word_count INTEGER NOT NULL,
            estimated_minutes INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'unread',
            rating TEXT,
            feedback_note TEXT,
            content_hash TEXT NOT NULL,
            imported_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_content_items_status
            ON content_items(status);

        CREATE INDEX IF NOT EXISTS idx_content_items_saved_at
            ON content_items(saved_at);

        CREATE TABLE IF NOT EXISTS import_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            started_at TEXT NOT NULL,
            source_root TEXT NOT NULL,
            scanned_files INTEGER NOT NULL,
            imported_count INTEGER NOT NULL,
            updated_count INTEGER NOT NULL,
            unchanged_count INTEGER NOT NULL,
            skipped_count INTEGER NOT NULL
        );
        """
    )


def upsert_note(connection: sqlite3.Connection, note: ParsedNote, now: str) -> str:
    existing = connection.execute(
        "SELECT content_hash FROM content_items WHERE id = ? OR file_path = ?",
        (note.item_id, str(note.file_path)),
    ).fetchone()

    if existing is None:
        connection.execute(
            """
            INSERT INTO content_items (
                id, title, source_type, source_name, author, url, saved_at,
                file_path, date_folder, markdown, plain_text, excerpt,
                word_count, estimated_minutes, status, content_hash,
                imported_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unread', ?, ?, ?)
            """,
            (
                note.item_id,
                note.title,
                note.source_type,
                note.source_name,
                note.author,
                note.url,
                note.saved_at,
                str(note.file_path),
                note.date_folder,
                note.markdown,
                note.plain_text,
                note.excerpt,
                note.word_count,
                note.estimated_minutes,
                note.content_hash,
                now,
                now,
            ),
        )
        return "imported"

    if existing[0] == note.content_hash:
        return "unchanged"

    connection.execute(
        """
        UPDATE content_items
        SET title = ?,
            source_type = ?,
            source_name = ?,
            author = ?,
            url = ?,
            saved_at = ?,
            file_path = ?,
            date_folder = ?,
            markdown = ?,
            plain_text = ?,
            excerpt = ?,
            word_count = ?,
            estimated_minutes = ?,
            content_hash = ?,
            updated_at = ?
        WHERE id = ? OR file_path = ?
        """,
        (
            note.title,
            note.source_type,
            note.source_name,
            note.author,
            note.url,
            note.saved_at,
            str(note.file_path),
            note.date_folder,
            note.markdown,
            note.plain_text,
            note.excerpt,
            note.word_count,
            note.estimated_minutes,
            note.content_hash,
            now,
            note.item_id,
            str(note.file_path),
        ),
    )
    return "updated"


def import_notes(source_root: Path, db_path: Path) -> dict[str, int | str]:
    if not source_root.exists():
        raise FileNotFoundError(f"同步目录不存在：{source_root}")

    db_path.parent.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat()

    counts = {
        "scanned_files": 0,
        "imported_count": 0,
        "updated_count": 0,
        "unchanged_count": 0,
        "skipped_count": 0,
    }

    with sqlite3.connect(db_path) as connection:
        ensure_schema(connection)

        for file_path in sorted(source_root.glob("*/*.md")):
            counts["scanned_files"] += 1
            note = parse_note(file_path, source_root)
            if note is None:
                counts["skipped_count"] += 1
                continue

            result = upsert_note(connection, note, now)
            counts[f"{result}_count"] += 1

        connection.execute(
            """
            INSERT INTO import_runs (
                started_at, source_root, scanned_files, imported_count,
                updated_count, unchanged_count, skipped_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                now,
                str(source_root),
                counts["scanned_files"],
                counts["imported_count"],
                counts["updated_count"],
                counts["unchanged_count"],
                counts["skipped_count"],
            ),
        )

    return {
        "db_path": str(db_path),
        "source_root": str(source_root),
        **counts,
    }


def format_saved_at(saved_at: str) -> str:
    if not saved_at:
        return ""

    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%dT%H:%M:%S%z"):
        try:
            dt = datetime.strptime(saved_at, fmt)
            return f"{dt.month} 月 {dt.day} 日"
        except ValueError:
            continue
    return saved_at


def choose_visual(source_type: str, title: str, estimated_minutes: int) -> str:
    if source_type == "wechat_video":
        return "video"
    if "活动" in title or "工作坊" in title or "分享会" in title:
        return "poster"
    if "Harness" in title or "Agent" in title or "Claude" in title:
        return "note"
    if estimated_minutes <= 2:
        return "stack"
    return "document"


def resolve_local_asset(reference: str, note_file_path: Path, source_root: Path) -> Path | None:
    reference = reference.strip()
    if not reference:
        return None

    reference_path = Path(reference)
    candidates = []
    if reference_path.is_absolute():
        candidates.append(reference_path)
    else:
        candidates.extend(
            [
                note_file_path.parent / reference_path,
                source_root / reference_path,
                source_root.parent / reference_path,
            ]
        )

    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return candidate
    return None


def copy_asset_to_public(asset_path: Path, asset_dir: Path) -> str:
    asset_dir.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256(str(asset_path).encode("utf-8")).hexdigest()[:10]
    target_path = asset_dir / f"{digest}-{asset_path.name}"
    if not target_path.exists():
        shutil.copy2(asset_path, target_path)
    return f"/note-assets/{target_path.name}"


def rewrite_markdown_assets(markdown: str, note_file_path: Path, source_root: Path, asset_dir: Path) -> str:
    def replace_obsidian_image(match: re.Match[str]) -> str:
        asset_path = resolve_local_asset(match.group(1), note_file_path, source_root)
        if asset_path is None:
            return ""
        return f"![图片]({copy_asset_to_public(asset_path, asset_dir)})"

    def replace_markdown_image(match: re.Match[str]) -> str:
        alt_text = match.group(1) or "图片"
        reference = match.group(2).strip()
        if reference.startswith(("http://", "https://", "/note-assets/")):
            return match.group(0)
        asset_path = resolve_local_asset(reference, note_file_path, source_root)
        if asset_path is None:
            return ""
        return f"![{alt_text}]({copy_asset_to_public(asset_path, asset_dir)})"

    markdown = OBSIDIAN_IMAGE_PATTERN.sub(replace_obsidian_image, markdown)
    return MARKDOWN_IMAGE_PATTERN.sub(replace_markdown_image, markdown)


def export_frontend_json(db_path: Path, export_path: Path, source_root: Path) -> int:
    export_path.parent.mkdir(parents=True, exist_ok=True)
    asset_dir = export_path.parent / "note-assets"

    with sqlite3.connect(db_path) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            """
            SELECT
                id, title, source_type, source_name, author, url, saved_at,
                file_path, markdown, plain_text, excerpt, word_count, estimated_minutes, status
            FROM content_items
            ORDER BY
                CASE WHEN saved_at IS NULL OR saved_at = '' THEN 1 ELSE 0 END,
                saved_at DESC,
                imported_at DESC
            """
        ).fetchall()

    items = []
    for row in rows:
        estimated_minutes = int(row["estimated_minutes"])
        file_path = Path(row["file_path"])
        items.append(
            {
                "id": row["id"],
                "title": row["title"],
                "sourceType": row["source_type"],
                "sourceName": row["source_name"],
                "author": row["author"],
                "url": row["url"],
                "savedAt": format_saved_at(row["saved_at"]),
                "savedAtRaw": row["saved_at"],
                "filePath": row["file_path"],
                "estimatedMinutes": estimated_minutes,
                "wordCount": int(row["word_count"]),
                "markdown": rewrite_markdown_assets(row["markdown"], file_path, source_root, asset_dir),
                "plainText": row["plain_text"],
                "excerpt": row["excerpt"],
                "status": row["status"],
                "visual": choose_visual(row["source_type"], row["title"], estimated_minutes),
            }
        )

    export_path.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    return len(items)


def main() -> None:
    parser = argparse.ArgumentParser(description="导入公众号未读库存到内容货架数据库")
    parser.add_argument("--source-root", type=Path, default=DEFAULT_SOURCE_ROOT)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH)
    parser.add_argument("--export-json", type=Path, default=DEFAULT_EXPORT_PATH)
    args = parser.parse_args()

    result = import_notes(args.source_root, args.db)
    result["exported_count"] = export_frontend_json(args.db, args.export_json, args.source_root)
    result["export_path"] = str(args.export_json)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
