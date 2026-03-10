#!/usr/bin/env python3
"""Inject content-hash cache-busting query params into local asset URLs in HTML."""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / "src"
HTML_GLOB = "*.html"
ASSET_RE = re.compile(
    r'(?P<attr>(?:href|src))="(?P<url>[^"]+?\.(?:css|js|svg|woff2|png|ico|webmanifest))(?:\?v=[^"]*)?"'
)


def is_local(url: str) -> bool:
    return not (
        url.startswith(("http://", "https://", "//", "data:", "mailto:", "tel:"))
    )


def resolve_asset_path(html_path: Path, url: str) -> Path:
    clean_url = url.lstrip("/")
    if url.startswith("/"):
        return SRC_DIR / clean_url
    return (html_path.parent / clean_url).resolve()


def file_hash(path: Path) -> str:
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return digest[:10]


def process_html(html_path: Path) -> bool:
    original = html_path.read_text(encoding="utf-8")

    def replace(match: re.Match[str]) -> str:
        attr = match.group("attr")
        url = match.group("url")
        if not is_local(url):
            return match.group(0)

        asset_path = resolve_asset_path(html_path, url)
        if not asset_path.exists() or not asset_path.is_file():
            return match.group(0)

        version = file_hash(asset_path)
        return f'{attr}="{url}?v={version}"'

    updated = ASSET_RE.sub(replace, original)
    if updated == original:
        return False

    html_path.write_text(updated, encoding="utf-8")
    return True


def main() -> int:
    changed = 0
    for html_file in sorted(SRC_DIR.glob(HTML_GLOB)):
        if process_html(html_file):
            changed += 1
    print(f"cache-bust: updated {changed} html file(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
