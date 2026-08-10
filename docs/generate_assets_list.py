#!/usr/bin/env python3
"""Generate docs/assets-list.json, docs/assets-chord-list.json, and the
SHA-256 chord manifest docs/assets-chord-manifest.json.

The GitHub Actions workflow calls this script after changes under
docs/assets/**. It keeps the public manifests deterministic so clients can
discover hymn PDFs and chords without hardcoding the list.

Chord entries are keyed by ``bookCode:songNumber`` (from chord-sources.json),
never by file name, so renaming a title does not break clients. Every file
entry carries its byte size and lowercase SHA-256 so the Church app can
verify downloads and only re-fetch files that actually changed.

Run with --validate to check all invariants without writing files
(used by the pull_request job).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path


DOCS_DIR = Path(__file__).resolve().parent
PDF_DIR = DOCS_DIR / "assets" / "pdf"
SOURCES_FILE = DOCS_DIR / "chord-sources.json"
ASSETS_OUTPUT = DOCS_DIR / "assets-list.json"
CHORD_LIST_OUTPUT = DOCS_DIR / "assets-chord-list.json"
CHORD_MANIFEST_OUTPUT = DOCS_DIR / "assets-chord-manifest.json"

MANIFEST_SCHEMA_VERSION = 1
SOURCES_SCHEMA_VERSION = 1

_TOKEN_RE = re.compile(r"(\d+|[A-Za-z]+)")
_NUMBER_RE = re.compile(r"^(\d+)\s*([_\-.\s])")
_COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")


class ValidationError(Exception):
    """Raised when an asset fails a manifest invariant."""


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


def load_chord_sources() -> list[dict[str, str]]:
    if SOURCES_FILE.is_file():
        data = json.loads(SOURCES_FILE.read_text(encoding="utf-8"))
        if not isinstance(data, dict) or data.get("schemaVersion") != SOURCES_SCHEMA_VERSION:
            raise ValidationError(
                f"{SOURCES_FILE.name}: unsupported schemaVersion; "
                f"expected {SOURCES_SCHEMA_VERSION}"
            )
        sources = data.get("sources", [])
    else:
        sources = [{"bookCode": "KR", "path": "assets/chord"}]

    if not isinstance(sources, list) or not sources:
        raise ValidationError("chord-sources.json: 'sources' must be a non-empty list")

    normalized = []
    for index, source in enumerate(sources):
        if not isinstance(source, dict):
            raise ValidationError(f"chord-sources.json: source #{index} is not an object")
        book_code = source.get("bookCode")
        rel_path = source.get("path")
        if not isinstance(book_code, str) or not re.fullmatch(r"[A-Z0-9-]{1,16}", book_code):
            raise ValidationError(
                f"chord-sources.json: source #{index} has invalid bookCode {book_code!r}"
            )
        if not isinstance(rel_path, str) or rel_path in ("", ".", ".."):
            raise ValidationError(
                f"chord-sources.json: source #{index} has invalid path {rel_path!r}"
            )
        normalized.append({"bookCode": book_code, "path": rel_path})
    return normalized


def extract_song_number(stem: str, rel_path: str) -> str:
    match = _NUMBER_RE.match(stem)
    if not match:
        raise ValidationError(f"{rel_path}: file name must start with the song number")
    number = match.group(1)
    if not (1 <= len(number) <= 4):
        raise ValidationError(f"{rel_path}: song number {number!r} has an invalid length")
    return number


def extract_title(stem: str) -> str:
    match = _NUMBER_RE.match(stem)
    rest = stem[match.end():] if match else stem
    title = re.sub(r"\s+", " ", rest.replace("_", " ")).strip(" -_.")
    return title


def validate_chord_json(raw: bytes, rel_path: str) -> int:
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValidationError(f"{rel_path}: invalid JSON: {error}") from error
    if not isinstance(data, dict):
        raise ValidationError(f"{rel_path}: chord JSON must be an object")
    version = data.get("version")
    if not isinstance(version, int):
        raise ValidationError(f"{rel_path}: missing integer 'version' field")
    for field in ("type", "pages"):
        if field not in data:
            raise ValidationError(f"{rel_path}: missing '{field}' field")
    if not isinstance(data.get("type"), str):
        raise ValidationError(f"{rel_path}: 'type' must be a string")
    if not isinstance(data.get("pages"), dict):
        raise ValidationError(f"{rel_path}: 'pages' must be an object")
    return version


def current_commit() -> str:
    """The immutable commit the manifest describes, so clients can download
    files from that commit instead of a mutable branch."""
    sha = os.environ.get("GITHUB_SHA", "").strip()
    if _COMMIT_RE.fullmatch(sha):
        return sha
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=DOCS_DIR.parent,
            capture_output=True,
            text=True,
            check=True,
        )
        sha = result.stdout.strip()
        if _COMMIT_RE.fullmatch(sha):
            return sha
    except (OSError, subprocess.SubprocessError):
        pass
    raise ValidationError("cannot determine source commit (set GITHUB_SHA or run inside a git checkout)")


def generate_chord_manifest() -> tuple[list[dict[str, object]], list[str]]:
    """Returns (manifest entries, legacy name list)."""
    entries: list[dict[str, object]] = []
    legacy_names: list[str] = []
    seen_ids: set[str] = set()

    for source in load_chord_sources():
        book_code = source["bookCode"]
        chord_dir = (DOCS_DIR / source["path"]).resolve()
        try:
            chord_dir.relative_to(DOCS_DIR)
        except ValueError as error:
            raise ValidationError(
                f"chord-sources.json: path {source['path']!r} escapes the docs directory"
            ) from error
        if not chord_dir.is_dir():
            raise ValidationError(
                f"chord-sources.json: path {source['path']!r} does not exist"
            )

        files = sorted(chord_dir.glob("*.chord.json"), key=lambda f: natural_sort_key(f.name))
        for file in files:
            name = file.name
            rel_path = f"{source['path'].replace(os.sep, '/').rstrip('/')}/{name}"
            stem = name[: -len(".chord.json")]
            if not stem:
                raise ValidationError(f"{rel_path}: empty file name")
            number = extract_song_number(stem, rel_path)
            title = extract_title(stem)
            raw = file.read_bytes()
            format_version = validate_chord_json(raw, rel_path)
            if not raw:
                raise ValidationError(f"{rel_path}: file is empty")
            entry_id = f"{book_code}:{number}"
            if entry_id in seen_ids:
                raise ValidationError(f"{rel_path}: duplicate id {entry_id}")
            seen_ids.add(entry_id)
            entries.append(
                {
                    "id": entry_id,
                    "bookCode": book_code,
                    "songNumber": number,
                    "title": title,
                    "path": f"docs/{rel_path}",
                    "formatVersion": format_version,
                    "size": len(raw),
                    "sha256": hashlib.sha256(raw).hexdigest(),
                }
            )
            legacy_names.append(stem)

    entries.sort(key=lambda e: (e["bookCode"], int(e["songNumber"]), str(e["title"])))
    legacy_names.sort(key=natural_sort_key)
    return entries, legacy_names


def write_json(path: Path, data: object) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--validate",
        action="store_true",
        help="check every invariant and print a summary without writing files",
    )
    args = parser.parse_args()

    try:
        assets = generate_assets_list()
        entries, legacy_names = generate_chord_manifest()
        source_commit = current_commit()
        manifest = {
            "schemaVersion": MANIFEST_SCHEMA_VERSION,
            "sourceCommit": source_commit,
            "files": entries,
        }
    except (FileNotFoundError, ValidationError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        sys.exit(1)

    if args.validate:
        print(f"VALIDATE OK: {len(assets)} PDFs, {len(entries)} chords, "
              f"commit {source_commit[:12]}")
        sys.exit(0)

    write_json(ASSETS_OUTPUT, assets)
    write_json(CHORD_LIST_OUTPUT, legacy_names)
    write_json(CHORD_MANIFEST_OUTPUT, manifest)

    print(f"Generated {ASSETS_OUTPUT.relative_to(DOCS_DIR.parent).as_posix()} with {len(assets)} PDF assets")
    print(f"Generated {CHORD_LIST_OUTPUT.relative_to(DOCS_DIR.parent).as_posix()} with {len(legacy_names)} chord assets")
    print(f"Generated {CHORD_MANIFEST_OUTPUT.relative_to(DOCS_DIR.parent).as_posix()} with {len(entries)} chord entries (sha256 verified)")


if __name__ == "__main__":
    main()
