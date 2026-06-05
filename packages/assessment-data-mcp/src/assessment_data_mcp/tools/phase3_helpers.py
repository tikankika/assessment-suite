"""Shared helpers for Phase 3 prepare and annotate tools.

Contains boundary loading, line finding (escape-aware + line-index-aware),
content-end detection, and markdown escape normalization.
"""

import re
from pathlib import Path
from typing import Optional

import yaml


# ---------------------------------------------------------------------------
# Markdown escape normalization
# ---------------------------------------------------------------------------

MD_ESCAPE_RE = re.compile(r'\\([.)\[\]{}*_~`#|>!])')


def _normalize_md_escapes(text: str) -> str:
    """Strip markdown escape backslashes: \\. -> ., \\) -> ) etc."""
    return MD_ESCAPE_RE.sub(r'\1', text)


# ---------------------------------------------------------------------------
# Line-index prefix handling
# ---------------------------------------------------------------------------

LINE_INDEX_RE = re.compile(r'^\d{4,}\s')

PHASE3_MARKER_PREFIX = re.compile(r'^<!--\s*phase3_q')


# ---------------------------------------------------------------------------
# Trailing metadata
# ---------------------------------------------------------------------------

TRAILING_METADATA_RE = re.compile(
    r'^(Ord:\s*\d+|Words?:\s*\d+|Besvarad\.?|Ej besvarad\.?|Answered\.?|Not answered\.?)$',
    re.IGNORECASE,
)


def _is_trailing_metadata(line: str) -> bool:
    """Check if a line is trailing exam metadata (not student answer content)."""
    stripped = line.strip()
    if not stripped:
        return True  # trailing empty lines
    return bool(TRAILING_METADATA_RE.match(stripped))


# ---------------------------------------------------------------------------
# Line finding (escape-aware + line-index-aware)
# ---------------------------------------------------------------------------

def _find_line(
    lines: list,
    text: str,
    start: int = 0,
    match_mode: str = 'endswith',
) -> Optional[int]:
    """Find line index matching text.

    Handles markdown escapes (``3\\.`` matches ``3.``) and line-index
    prefixes (``0005 1.`` matches ``1.`` in endswith mode).

    match_mode:
        'endswith'   — normalized stripped line ends with text
        'contains'   — text appears anywhere in normalized line
        'startswith' — normalized, lstripped (and index-stripped) line
                       starts with text
    """
    for i in range(start, len(lines)):
        stripped = lines[i].rstrip()
        normalized = _normalize_md_escapes(stripped)

        if match_mode == 'endswith' and normalized.endswith(text):
            return i
        elif match_mode == 'contains' and text in _normalize_md_escapes(lines[i]):
            return i
        elif match_mode == 'startswith':
            # Strip line-index prefix first, then lstrip whitespace
            content = LINE_INDEX_RE.sub('', stripped).lstrip()
            content = _normalize_md_escapes(content)
            if content.startswith(text):
                return i
    return None


# ---------------------------------------------------------------------------
# Content-end detection
# ---------------------------------------------------------------------------

def _find_content_end(lines: list, start: int, end: int) -> int:
    """Find index after the last non-metadata line in range [start, end).

    Scans backwards from end, skipping trailing empty lines and
    exam metadata (Ord:, Besvarad., etc.).
    """
    for i in range(end - 1, start - 1, -1):
        if not _is_trailing_metadata(lines[i]):
            return i + 1
    return start  # all metadata or empty


# ---------------------------------------------------------------------------
# Boundary loading
# ---------------------------------------------------------------------------

def _load_answer_boundaries(project: Path) -> Optional[dict]:
    """Load answer_boundaries from exam_config.yaml, or None if not available."""
    config_path = project / "exam_config.yaml"
    if not config_path.exists():
        return None
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        boundaries = config.get('answer_boundaries')
        if boundaries and boundaries.get('questions'):
            return boundaries
    except Exception:
        pass
    return None
