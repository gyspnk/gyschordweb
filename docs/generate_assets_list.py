#!/usr/bin/env python3
"""Generate docs/assets-list.json from PDF assets.

The GitHub Actions workflow calls this script after changes under docs/assets/**.
It keeps the public manifest deterministic so the client can discover hymn PDFs
without hardcoding the list in JavaScript.
"""

from __future__ import annotations

import json
import re
from pathlib import Path


DOCS_DIR = Path(__file__).resolve().parent
PDF_DIR = DOCS_DIR / "assets" / "pdf"
OUTPUT_FILE = DOCS_DIR / "assets-list.json"


_TOKEN_RE = re.compile(r"(\d+|[A-Za-z]+)")


def natural_sort_key(name: str) -> tuple[object, ...]:
    """Sort hymn names by number first, then optional letter suffix/title."""
    parts: list[object] = []
    for token in _TOKEN_RE.findall(name):
        if token.isdigit():
            parts.append(int(token))
        else:
            parts.append(token.casefold())
    parts.append(name.casefold())
    return tuple(parts)


def generate_assets_list() -> list[str]:
    if not PDF_DIR.is_dir():
        raise FileNotFoundError(f"PDF assets directory not found: {PDF_DIR}")

    pdf_files = [path.name for path in PDF_DIR.glob("*.pdf") if path.is_file()]
    return sorted(pdf_files, key=natural_sort_key)


def generate_chord_list() -> list[str]:
    chord_dir = DOCS_DIR / "assets" / "chord"
    if not chord_dir.is_dir():
        return []

    chord_files = [
        path.name[: -len(".chord.json")]
        for path in chord_dir.glob("*.chord.json")
        if path.is_file()
    ]
    return sorted(chord_files, key=natural_sort_key)


def main() -> None:
    assets = generate_assets_list()
    OUTPUT_FILE.write_text(
        json.dumps(assets, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Generated {OUTPUT_FILE.relative_to(DOCS_DIR.parent).as_posix()} with {len(assets)} PDF assets")

    chords = generate_chord_list()
    chord_output = DOCS_DIR / "assets-chord-list.json"
    chord_output.write_text(
        json.dumps(chords, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Generated {chord_output.relative_to(DOCS_DIR.parent).as_posix()} with {len(chords)} chord assets")


if __name__ == "__main__":
    main()
