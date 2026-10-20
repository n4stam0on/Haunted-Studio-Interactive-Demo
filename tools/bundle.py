#!/usr/bin/env python3
"""
Bundle the site into one self-contained HTML file.

Reads app.html (the development page that links css/ and js/ separately),
inlines css/style.css and every local <script src="js/..."> into one file,
and writes it to:

    index.html                 the page GitHub Pages serves
    dist/haunted-studio.html   an offline copy for the event laptop

Because index.html carries everything inside it, the live site keeps working
even if a folder is missing. (Web fonts fall back to system fonts offline.)

Usage:
    python tools/build_cases.py && python tools/bundle.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main():
    html = (ROOT / "app.html").read_text(encoding="utf-8")

    css = (ROOT / "css/style.css").read_text(encoding="utf-8")
    html = html.replace('<link rel="stylesheet" href="css/style.css">', "<style>\n" + css + "</style>")

    def inline(match):
        src = (ROOT / match.group(1)).read_text(encoding="utf-8")
        return "<script>\n" + src.replace("</script", "<\\/script") + "\n</script>"

    html = re.sub(r'<script src="(js/[^"]+)"></script>', inline, html)
    out = ROOT / "dist"
    out.mkdir(exist_ok=True)
    (out / "haunted-studio.html").write_text(html, encoding="utf-8")
    (ROOT / "index.html").write_text(html, encoding="utf-8")
    print(f"Wrote index.html and dist/haunted-studio.html ({len(html) // 1024} KB each)")


if __name__ == "__main__":
    main()
