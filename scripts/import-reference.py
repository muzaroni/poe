"""One-time importer for Muzaroni's existing HTML guide.

Run with `python -m pip install beautifulsoup4` then `python scripts/import-reference.py`.
The source URL remains untouched. Review imported content in the visual editor.
"""
from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString, Tag

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "https://muzaroni.github.io/328_sunder_rf.html"
GEMS = "https://repoe-fork.github.io/gems_minimal.json"
IMAGE_DIR = ROOT / "public" / "images" / "sunder-rf"


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=30) as response:
        return response.read()


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text)


def inline(parent: Tag, catalog: dict[str, str]) -> list[dict]:
    result: list[dict] = []
    for child in parent.children:
        if isinstance(child, NavigableString):
            value = clean(str(child))
            if value:
                result.append({"type": "text", "text": value})
        elif isinstance(child, Tag):
            if child.name == "img":
                result.append({"type": "icon", "attrs": {"src": image_path(child.get("src", ""))}})
            elif child.name == "br":
                result.append({"type": "hardBreak"})
            elif child.name == "a":
                label = clean(child.get_text(" ", strip=True))
                href = child.get("href", "")
                if href in ("gemred", "gemgreen", "gemblue") and label and not re.fullmatch(r"[rgbRGB-]+", label):
                    result.append({"type": "gem", "attrs": {"name": label, "color": catalog.get(label.lower(), href.removeprefix("gem"))}})
                elif href.startswith(("https://", "http://")):
                    result.append({"type": "text", "text": label, "marks": [{"type": "link", "attrs": {"href": href, "target": "_blank"}}]})
                else:
                    result.append({"type": "text", "text": label})
            else:
                items = inline(child, catalog)
                mark = {"strong": "bold", "b": "bold", "em": "italic", "i": "italic", "code": "code"}.get(child.name)
                if mark:
                    for item in items:
                        if item["type"] == "text":
                            item.setdefault("marks", []).append({"type": mark})
                result.extend(items)
    return result


def image_path(src: str) -> str:
    name = Path(urllib.parse.urlparse(src).path).name
    return f"/images/sunder-rf/{name}"


def list_node(tag: Tag, catalog: dict[str, str]) -> dict:
    checked = "checklist" in tag.get("class", [])
    children = []
    for li in tag.find_all("li"):
        if li.find("li"):
            continue
        content = inline(li, catalog)
        if not content:
            continue
        paragraph = {"type": "paragraph", "content": content}
        children.append({"type": "taskItem" if checked else "listItem", "attrs": {"checked": False} if checked else {}, "content": [paragraph]})
    return {"type": "taskList" if checked else "bulletList", "content": children}


def gem_setup_content(container: Tag, catalog: dict[str, str]) -> list[dict]:
    """Keep the level breakpoints embedded in the old link-block markup."""
    result: list[dict] = []
    for child in container.children:
        if not isinstance(child, Tag):
            continue
        if child.name in ("h3", "h4"):
            result.extend(blocks(child, catalog))
        elif child.name in ("ul", "ol"):
            direct_items = child.find_all("li", recursive=False)
            if direct_items:
                kind = "taskList" if "checklist" in container.get("class", []) or "contains-task-list" in child.get("class", []) else "bulletList"
                result.append({"type": kind, "content": [{"type": "taskItem" if kind == "taskList" else "listItem", "attrs": {"checked": False} if kind == "taskList" else {}, "content": [{"type": "paragraph", "content": inline(li, catalog)}]} for li in direct_items]})
            result.extend(gem_setup_content(child, catalog))
        else:
            result.extend(blocks(child, catalog))
    return result


def blocks(tag: Tag, catalog: dict[str, str]) -> list[dict]:
    if tag.name in ("h2", "h3", "h4"):
        return [{"type": "heading", "attrs": {"level": int(tag.name[1])}, "content": inline(tag, catalog)}]
    if tag.name == "p":
        return [{"type": "paragraph", "content": inline(tag, catalog)}]
    if tag.name == "img":
        return [{"type": "image", "attrs": {"src": image_path(tag.get("src", "")), "alt": tag.get("alt", "Guide screenshot")}}]
    if tag.name == "hr":
        return [{"type": "horizontalRule"}]
    if tag.name in ("ul", "ol"):
        result = list_node(tag, catalog)
        return [result] if result["content"] else []
    if tag.name == "div":
        classes = tag.get("class", [])
        if "code-container" in classes:
            label = tag.select_one(".code-header span")
            value = tag.select_one("code")
            return [{"type": "regex", "attrs": {"label": label.get_text(" ", strip=True) if label else "Regex", "value": value.get_text() if value else ""}}]
        if any(c in classes for c in ("note-block", "imp-block", "link-block")):
            kind = "gemSetup" if "link-block" in classes else "callout"
            inner: list[dict] = gem_setup_content(tag, catalog) if kind == "gemSetup" else []
            if kind != "gemSetup":
                for child in tag.children:
                    if isinstance(child, Tag):
                        inner.extend(blocks(child, catalog))
            if not inner:
                inner = [{"type": "paragraph"}]
            return [{"type": kind, "attrs": {"tone": "important" if "imp-block" in classes else "note"} if kind == "callout" else {}, "content": inner}]
    return []


def main() -> None:
    raw = fetch(SOURCE)
    soup = BeautifulSoup(raw, "html.parser")
    article = soup.select_one("article")
    if article is None:
        raise RuntimeError("Guide article not found")

    gem_rows = json.loads(fetch(GEMS))
    catalog: dict[str, str] = {}
    display_names: dict[str, str] = {}
    for row in gem_rows:
        name = row.get("display_name")
        color = {"r": "red", "g": "green", "b": "blue"}.get(row.get("color"))
        if name and color and row.get("base_item", {}).get("release_state") == "released" and not name.startswith(("[", "...")):
            catalog[name.lower()] = color
            display_names[name.lower()] = name
    (ROOT / "src" / "data").mkdir(parents=True, exist_ok=True)
    (ROOT / "src" / "data" / "gems.json").write_text(json.dumps([{"name": display_names[k], "color": v} for k, v in sorted(catalog.items())], ensure_ascii=False, indent=2), encoding="utf-8")

    nodes: list[dict] = []
    children = [c for c in article.children if isinstance(c, Tag) and c.name != "footer"]
    index = 0
    while index < len(children):
        child = children[index]
        if child.name == "h1" or (child.name == "p" and child.get_text(strip=True).startswith("Updated:")):
            index += 1
            continue
        if child.name == "h2" and "POB Links" in child.get_text() and index + 1 < len(children):
            nodes.extend(blocks(child, catalog))
            links = []
            for li in children[index + 1].find_all("li"):
                anchors = [a for a in li.find_all("a") if a.get("href", "").startswith("https://pobb.in/")]
                if anchors:
                    a = anchors[-1]
                    links.append({"label": clean(li.get_text(" ", strip=True)), "url": a["href"]})
            nodes.append({"type": "pobLinks", "attrs": {"links": links}})
            index += 2
            continue
        nodes.extend(blocks(child, catalog))
        index += 1

    # The reference has route detail through Act 8 and a Blood Aqueduct respec in Act 9.
    # Keep the missing acts visible for the author without inventing gameplay instructions.
    respec = next((i for i, node in enumerate(nodes) if node.get("type") == "heading" and "LEVEL 52 RESPEC" in "".join(x.get("text", "") for x in node.get("content", []))), len(nodes))
    nodes[respec:respec] = [
        {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "ACT 9 PROGRESSION"}]},
        {"type": "callout", "attrs": {"tone": "note"}, "content": [{"type": "paragraph", "content": [{"type": "text", "text": "The original guide continues Sunder into Blood Aqueducts and swaps to Righteous Fire around level 52–55. Add Act 9 route details here."}]}]},
        {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "ACT 10 PROGRESSION"}]},
        {"type": "callout", "attrs": {"tone": "note"}, "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Act 10 route details were not in the original guide. Add them here."}]}]},
    ]

    guide = {
        "slug": "sunder-rf-chieftain",
        "title": "Sunder Leveling into Pohx RF Swap",
        "subtitle": "Level with Sunder, then swap to Righteous Fire at Blood Aqueducts.",
        "league": "3.28 · Chieftain",
        "updated": "2026-03-05",
        "content": {"type": "doc", "content": nodes},
    }
    target = ROOT / "src" / "content" / "builds" / f"{guide['slug']}.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(guide, ensure_ascii=False, indent=2), encoding="utf-8")

    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    image_sources = {img.get("src") for img in article.find_all("img") if img.get("src")}
    for src in sorted(image_sources):
        destination = IMAGE_DIR / Path(src).name
        if not destination.exists():
            try:
                destination.write_bytes(fetch(urllib.parse.urljoin(SOURCE, src)))
            except Exception as error:
                print(f"Could not download {src}: {error}")
    print(f"Imported {len(nodes)} guide blocks, {len(catalog)} gem names, {len(image_sources)} images")


if __name__ == "__main__":
    main()
