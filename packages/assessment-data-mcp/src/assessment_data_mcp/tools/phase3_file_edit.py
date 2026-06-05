"""Phase 3: Edit student files — insert/remove annotation markers.

Provides fine-grained editing of Phase 3 annotated files in
03_material/student_answers/. Uses permanent line indices as stable
anchors so multiple edits in a single call never interfere.

Designed for manual annotation corrections after phase3_annotate,
or as the primary annotation tool when auto-annotation cannot handle
a student's file layout.

See: RFC-034
"""

import re
import sys
import time
from pathlib import Path
from typing import Any

from ..validators import validate_path_security
from ..utils.state_manager import log_workflow_action
from ..constants.folders import PHASE3_MATERIAL
from .phase3_helpers import LINE_INDEX_RE, PHASE3_MARKER_PREFIX


def log(msg: str) -> None:
    """Print to stderr to avoid corrupting MCP JSON-RPC stdout."""
    print(msg, file=sys.stderr)


# ---------------------------------------------------------------------------
# Line-index map
# ---------------------------------------------------------------------------

def _build_line_index_map(lines: list[str]) -> tuple[dict[str, int], list[str]]:
    """Build mapping from line-index prefix to position in lines list.

    Returns:
        (index_map, warnings)
        index_map: {"0001": 0, "0003": 2, ...}
        warnings: list of warning strings (e.g. duplicate indices)
    """
    index_map: dict[str, int] = {}
    warnings: list[str] = []
    for pos, line in enumerate(lines):
        m = LINE_INDEX_RE.match(line)
        if m:
            idx_str = m.group(0).strip()
            if idx_str in index_map:
                warnings.append(
                    f"Duplicate line index '{idx_str}' at positions "
                    f"{index_map[idx_str]} and {pos}"
                )
            else:
                index_map[idx_str] = pos
    return index_map, warnings


# ---------------------------------------------------------------------------
# Edit application
# ---------------------------------------------------------------------------

_VALID_ACTIONS = {
    "insert_before_line",
    "insert_after_line",
    "remove_marker",
    "insert_at_end",
}


def _apply_edits(
    lines: list[str],
    index_map: dict[str, int],
    edits: list[dict],
) -> tuple[list[str], list[dict], list[dict], list[str]]:
    """Validate edits and apply them in a single pass.

    Returns:
        (result_lines, applied, errors, warnings)
    """
    insertions_before: dict[int, list[str]] = {}
    insertions_after: dict[int, list[str]] = {}
    append_at_end: list[str] = []
    removals: set[int] = set()
    applied: list[dict] = []
    errors: list[dict] = []
    warnings: list[str] = []

    for i, edit in enumerate(edits):
        action = edit.get("action", "")

        if action not in _VALID_ACTIONS:
            errors.append({
                "edit_index": i,
                "action": action,
                "error": f"Unknown action '{action}'. Valid: {sorted(_VALID_ACTIONS)}",
            })
            continue

        if action == "insert_before_line":
            line_index = edit.get("line_index", "")
            text = edit.get("text", "")
            if not line_index:
                errors.append({"edit_index": i, "action": action, "error": "Missing 'line_index'"})
                continue
            if not text:
                errors.append({"edit_index": i, "action": action, "error": "Missing 'text'"})
                continue
            if line_index not in index_map:
                errors.append({
                    "edit_index": i, "action": action,
                    "error": f"Line index '{line_index}' not found in file",
                })
                continue
            pos = index_map[line_index]
            insertions_before.setdefault(pos, []).append(text)
            applied.append(edit)

        elif action == "insert_after_line":
            line_index = edit.get("line_index", "")
            text = edit.get("text", "")
            if not line_index:
                errors.append({"edit_index": i, "action": action, "error": "Missing 'line_index'"})
                continue
            if not text:
                errors.append({"edit_index": i, "action": action, "error": "Missing 'text'"})
                continue
            if line_index not in index_map:
                errors.append({
                    "edit_index": i, "action": action,
                    "error": f"Line index '{line_index}' not found in file",
                })
                continue
            pos = index_map[line_index]
            insertions_after.setdefault(pos, []).append(text)
            applied.append(edit)

        elif action == "remove_marker":
            marker = edit.get("marker", "")
            if not marker:
                errors.append({"edit_index": i, "action": action, "error": "Missing 'marker'"})
                continue
            found = False
            for pos, line in enumerate(lines):
                if line.strip() == marker.strip():
                    removals.add(pos)
                    applied.append(edit)
                    found = True
                    break  # Remove first occurrence only
            if not found:
                warnings.append(f"Marker not found (may already be removed): {marker}")

        elif action == "insert_at_end":
            text = edit.get("text", "")
            if not text:
                errors.append({"edit_index": i, "action": action, "error": "Missing 'text'"})
                continue
            # Support multi-line text (e.g. multiple markers at once)
            for line in text.split('\n'):
                append_at_end.append(line)
            applied.append(edit)

    # Single-pass reconstruction
    result_lines: list[str] = []
    for pos, line in enumerate(lines):
        if pos in insertions_before:
            result_lines.extend(insertions_before[pos])
        if pos not in removals:
            result_lines.append(line)
        if pos in insertions_after:
            result_lines.extend(insertions_after[pos])

    # Append at end
    if append_at_end:
        result_lines.extend(append_at_end)

    return result_lines, applied, errors, warnings


# ---------------------------------------------------------------------------
# Tool entry point
# ---------------------------------------------------------------------------

async def phase3_file_edit_tool(
    project_path: str,
    student_id: str,
    edits: list[dict],
) -> dict[str, Any]:
    """Edit a Phase 3 student file: insert/remove annotation markers.

    Uses permanent line indices (0001, 0002...) as stable anchors.
    Inserting/removing markers never changes line indices, so multiple
    edits in a single call are safe.

    Args:
        project_path: Path to project root directory
        student_id: Student ID (e.g. 'stu1')
        edits: List of edit operations:
            - insert_before_line: {action, line_index, text}
            - insert_after_line:  {action, line_index, text}
            - remove_marker:      {action, marker}
            - insert_at_end:      {action, text}

    Returns:
        dict with success, edits_applied, edits_failed, etc.
    """
    start_time = time.time()

    # Security
    is_safe, security_error = validate_path_security(project_path)
    if not is_safe:
        return {"success": False, "error": f"Security: {security_error}"}

    project = Path(project_path).resolve()

    # Security: validate student_id doesn't contain path traversal
    if "/" in student_id or "\\" in student_id or ".." in student_id:
        return {"success": False, "error": f"Invalid student_id: {student_id}"}

    # Locate file
    filepath = project / PHASE3_MATERIAL / "student_answers" / f"{student_id}.md"
    expected_dir = (project / PHASE3_MATERIAL / "student_answers").resolve()
    if not filepath.resolve().is_relative_to(expected_dir):
        return {"success": False, "error": f"Invalid student_id: path escapes expected directory"}
    if not filepath.exists():
        return {
            "success": False,
            "error": f"File not found: {filepath}. Run phase3_prepare first.",
        }

    # Handle empty edits
    if not edits:
        return {
            "success": True,
            "phase": 3,
            "phase_name": "File Edit",
            "student_id": student_id,
            "edits_requested": 0,
            "edits_applied": 0,
            "note": "No edits requested",
        }

    # Read file
    content = filepath.read_text(encoding='utf-8')
    lines = content.split('\n')
    lines_before = len(lines)

    # Build index map
    index_map, map_warnings = _build_line_index_map(lines)

    # Apply edits
    result_lines, applied, errors, edit_warnings = _apply_edits(
        lines, index_map, edits,
    )
    all_warnings = map_warnings + edit_warnings

    # Write if any edits were applied
    if applied:
        new_content = '\n'.join(result_lines)
        filepath.write_text(new_content, encoding='utf-8')

    lines_after = len(result_lines)
    markers_count = sum(
        1 for line in result_lines
        if PHASE3_MARKER_PREFIX.match(line.strip())
    )

    duration = round(time.time() - start_time, 4)
    success = len(applied) > 0

    # Log workflow action
    try:
        log_workflow_action(
            project,
            phase=3,
            tool="phase3_file_edit",
            action="edit_markers",
            input_data={
                "project_path": project_path,
                "student_id": student_id,
                "edits_count": len(edits),
            },
            output_data={
                "success": success,
                "applied": len(applied),
                "failed": len(errors),
            },
            duration_seconds=duration,
        )
    except Exception as log_error:
        log(f"Warning: Could not log workflow action: {log_error}")

    result: dict[str, Any] = {
        "success": success,
        "phase": 3,
        "phase_name": "File Edit",
        "student_id": student_id,
        "file_path": str(filepath),
        "edits_requested": len(edits),
        "edits_applied": len(applied),
        "edits_failed": len(errors),
        "lines_before": lines_before,
        "lines_after": lines_after,
        "markers_in_file": markers_count,
        "duration_seconds": duration,
    }

    if applied:
        result["applied"] = applied
    if errors:
        result["errors"] = errors
    if all_warnings:
        result["warnings"] = all_warnings

    if success:
        result["next_step"] = {
            "phase": "3 (validate)",
            "name": "Validate Annotations",
            "instruction": (
                f"Run phase3_validate for student '{student_id}' to verify "
                "marker completeness, placement, nesting, and text preservation."
            ),
        }

    return result
