#!/usr/bin/env python3
"""把本地导出的内容库存同步到 Supabase。"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


DEFAULT_EXPORT_PATH = Path("/Users/andreas/vibe coding/shortvideo/public/content-items.json")
BATCH_SIZE = 100


def read_env_file(path: Path) -> None:
    if not path.exists():
        return

    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"缺少环境变量：{name}")
    return value


def normalize_source_type(source_type: str) -> str:
    if source_type.startswith("wechat"):
        return "wechat"
    if source_type == "substack":
        return "substack"
    return "manual"


def infer_content_kind(source_type: str) -> str:
    if source_type == "wechat_video":
        return "video"
    return "article"


def first_markdown_image(markdown: str) -> str | None:
    match = re.search(r"!\[[^\]]*\]\(([^)]+)\)", markdown or "")
    return match.group(1) if match else None


def build_row(item: dict, user_id: str) -> dict:
    source_type = item.get("sourceType", "manual")
    metadata = {
        "localFilePath": item.get("filePath"),
        "visual": item.get("visual"),
        "savedAtLabel": item.get("savedAt"),
        "sourceSubtype": source_type,
    }
    metadata = {key: value for key, value in metadata.items() if value}

    return {
        "user_id": user_id,
        "source_type": normalize_source_type(source_type),
        "source_subtype": source_type,
        "external_id": item["id"],
        "content_kind": infer_content_kind(source_type),
        "title": item.get("title") or "未命名内容",
        "source_name": item.get("sourceName"),
        "author": item.get("author"),
        "original_url": item.get("url"),
        "canonical_url": item.get("url"),
        "saved_at": item.get("savedAtRaw") or None,
        "markdown": item.get("markdown"),
        "plain_text": item.get("plainText"),
        "excerpt": item.get("excerpt"),
        "cover_image_url": first_markdown_image(item.get("markdown", "")),
        "estimated_minutes": item.get("estimatedMinutes") or 1,
        "word_count": item.get("wordCount") or 0,
        "status": item.get("status") or "unread",
        "metadata": metadata,
    }


def supabase_request(supabase_url: str, service_role_key: str, path: str, payload: list[dict]) -> None:
    query = urlencode({"on_conflict": "user_id,source_type,external_id"})
    request = Request(
        f"{supabase_url.rstrip('/')}/rest/v1/{path}?{query}",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
    )

    try:
        with urlopen(request, timeout=30) as response:
            if response.status not in {200, 201, 204}:
                raise RuntimeError(f"Supabase 返回异常状态码：{response.status}")
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase 同步失败：HTTP {error.code}\n{detail}") from error
    except URLError as error:
        raise RuntimeError(f"无法连接 Supabase：{error.reason}") from error


def chunks(rows: list[dict], size: int) -> list[list[dict]]:
    return [rows[index : index + size] for index in range(0, len(rows), size)]


def main() -> None:
    parser = argparse.ArgumentParser(description="同步 WorthyScroll 内容库存到 Supabase")
    parser.add_argument("--input", type=Path, default=DEFAULT_EXPORT_PATH)
    parser.add_argument("--env-file", type=Path, default=Path(".env"))
    args = parser.parse_args()

    read_env_file(args.env_file)
    supabase_url = require_env("SUPABASE_URL")
    service_role_key = require_env("SUPABASE_SERVICE_ROLE_KEY")
    user_id = require_env("WORTHYSCROLL_USER_ID")

    items = json.loads(args.input.read_text(encoding="utf-8"))
    rows = [build_row(item, user_id) for item in items]

    for batch in chunks(rows, BATCH_SIZE):
        supabase_request(supabase_url, service_role_key, "content_items", batch)

    print(json.dumps({"synced_count": len(rows), "input": str(args.input)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
