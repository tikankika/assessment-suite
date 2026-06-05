"""Phase 3: Prepare student material for assessment.

Copies student markdown files from 02_markdown/student_answers/ to
03_material/student_answers/, adding a student header comment and
permanent line indices to each line.

Auto-annotation is handled separately by ``phase3_annotate_tool``
(see ``phase3_annotate.py``).

Workflow:
    02_markdown/student_answers/*.md -> 03_material/student_answers/*.md

See: RFC-034
"""

import re
import sys
import time
from pathlib import Path

from ..validators import validate_path_security
from ..utils.state_manager import (
    update_project_state,
    log_workflow_action,
)
from ..constants.folders import PHASE2_MARKDOWN, PHASE3_MATERIAL

# Re-export helpers so existing callers (tests, phase5) still work
from .phase3_helpers import (  # noqa: F401
    PHASE3_MARKER_PREFIX,
    TRAILING_METADATA_RE,
    MD_ESCAPE_RE,
    _normalize_md_escapes,
    _find_line,
    _find_content_end,
    _is_trailing_metadata,
    _load_answer_boundaries,
)


def log(msg: str) -> None:
    """Print to stderr to avoid corrupting MCP JSON-RPC stdout."""
    print(msg, file=sys.stderr)


def _add_line_indices(content: str) -> str:
    """Add zero-padded line indices to each line.

    Format: '0001 first line', '0002 second line', ...
    Minimum 4 digits, scales up for files with 10000+ lines.
    Phase 3 marker lines are left without indices so they stay
    on their own clean lines (never mixed with indexed content).
    """
    lines = content.split('\n')
    content_count = sum(
        1 for line in lines if not PHASE3_MARKER_PREFIX.match(line.strip())
    )
    digits = max(4, len(str(content_count)))
    indexed_lines = []
    content_idx = 0
    for line in lines:
        if PHASE3_MARKER_PREFIX.match(line.strip()):
            indexed_lines.append(line)
        else:
            content_idx += 1
            idx = str(content_idx).zfill(digits)
            indexed_lines.append(f"{idx} {line}")
    return '\n'.join(indexed_lines)


def _try_auto_annotate(
    content: str,
    answer_boundaries: dict,
) -> tuple:
    """Try to auto-insert Phase 3 markers using 2C boundary config.

    Works on raw content (with student header, BEFORE line indices).
    Inserts HTML comment markers around STUDENT ANSWERS ONLY — question
    text, prompts ("Enter your answer here..."), and exam metadata
    (Ord:, Besvarad.) are left outside markers.

    Args:
        content: Raw student file content (with header, no indices)
        answer_boundaries: From exam_config.yaml

    Returns:
        (annotated_content, matched_questions, failed_questions)
        annotated_content is None only if zero questions matched.
    """
    lines = content.split('\n')
    q_bounds_map = answer_boundaries.get('questions', {})
    global_cfg = answer_boundaries.get('global', {})

    # All question headers for next-question detection
    all_headers = [
        qb['question_header']
        for qb in q_bounds_map.values()
        if qb.get('question_header') and not qb.get('auto_graded')
    ]

    # Pre-compute header positions for bounding answer regions.
    # Includes ALL questions so their headers mark physical boundaries.
    ordered_headers: list[tuple[str, int]] = []
    for pre_qid in sorted(q_bounds_map.keys()):
        hdr = q_bounds_map[pre_qid].get('question_header', '')
        if hdr:
            pos = _find_line(lines, hdr, 0, 'endswith')
            if pos is not None:
                ordered_headers.append((pre_qid, pos))
    ordered_headers.sort(key=lambda x: x[1])
    next_header_pos: dict[str, int] = {}
    for idx in range(len(ordered_headers) - 1):
        next_header_pos[ordered_headers[idx][0]] = ordered_headers[idx + 1][1]

    # Collect insertions: (line_idx, marker_text)
    # Each insertion means "insert marker BEFORE line_idx"
    insertions: list[tuple[int, str]] = []
    matched: list[str] = []
    failed: list[str] = []

    for q_id in sorted(q_bounds_map.keys()):
        qb = q_bounds_map[q_id]

        if qb.get('skip_boundary_detection') or qb.get('auto_graded'):
            continue

        q_num = q_id.replace('Q', '').replace('q', '')
        q_tag = f"q{q_num}"
        header = qb.get('question_header', '')
        start_type = qb.get('answer_start_type', 'after_text')
        end_type = qb.get('answer_end_type', 'marker')
        end_marker = qb.get(
            'answer_end_marker',
            global_cfg.get('default_answer_end', ''),
        )

        # 1. Find question header
        header_idx = _find_line(lines, header, 0, 'endswith')
        if header_idx is None:
            failed.append(f"{q_id}: header '{header}' not found")
            continue

        # 2. Find answer boundary end (end_marker or next question header)
        answer_end = None
        search_start = header_idx + 1

        if end_type == 'marker' and end_marker:
            answer_end = _find_line(lines, end_marker, search_start, 'contains')

        if answer_end is None:
            # Try next question header (escape-aware)
            for i in range(search_start + 1, len(lines)):
                normalized = _normalize_md_escapes(lines[i].rstrip())
                for nh in all_headers:
                    if nh and nh != header and normalized.endswith(nh):
                        answer_end = i
                        break
                if answer_end is not None:
                    break

        if answer_end is None:
            answer_end = len(lines)

        # Cap answer_end at next question's header to prevent cross-question
        # scanning when end-marker detection overshoots (clustered markers bug)
        if q_id in next_header_pos:
            answer_end = min(answer_end, next_header_pos[q_id])

        if start_type == 'sub_question':
            # --- Sub-question type ---
            # Find sub-question labels in the answer region
            sub_qs = qb.get('sub_questions', {})
            sub_labels = sorted(sub_qs.keys()) if sub_qs else []

            if not sub_labels:
                # Auto-detect from content (escape-aware: a) and a\))
                sub_pattern = re.compile(r'^([a-zA-Z])\\?\)')
                seen = set()
                for i in range(header_idx + 1, answer_end):
                    m = sub_pattern.match(lines[i].strip())
                    if m:
                        label = m.group(1).lower()
                        if label not in seen:
                            sub_labels.append(label)
                            seen.add(label)

            # First pass: find all sub-question positions
            sub_positions: list[tuple[str, int, int]] = []
            q_ok = True

            for si, label in enumerate(sub_labels):
                sub_start = None
                for i in range(header_idx + 1, answer_end):
                    norm = _normalize_md_escapes(lines[i].strip())
                    if (norm.startswith(f'{label})')
                            or norm.startswith(f'{label.upper()})')):
                        sub_start = i
                        break

                if sub_start is None:
                    failed.append(f"{q_id}{label}: sub-question not found")
                    q_ok = False
                    continue

                # Find sub-question end boundary
                sub_end = None
                if si < len(sub_labels) - 1:
                    next_label = sub_labels[si + 1]
                    for i in range(sub_start + 1, answer_end):
                        norm = _normalize_md_escapes(lines[i].strip())
                        if (norm.startswith(f'{next_label})')
                                or norm.startswith(f'{next_label.upper()})')):
                            sub_end = i
                            break

                if sub_end is None:
                    sub_end = answer_end

                # Find last content line (skip trailing metadata/empty)
                sub_content_end = _find_content_end(lines, sub_start, sub_end)
                sub_positions.append((label, sub_start, sub_content_end))

            if q_ok:
                matched.append(q_id)

            # Second pass: insert markers in correct order
            if sub_positions:
                first_sub_start = sub_positions[0][1]
                last_sub_end = sub_positions[-1][2]

                # Question start before first sub-label
                insertions.append(
                    (first_sub_start, f'<!-- phase3_{q_tag}_start -->')
                )

                # Sub-question markers
                for label, sub_start, sub_content_end in sub_positions:
                    insertions.append(
                        (sub_start, f'<!-- phase3_{q_tag}{label}_start -->')
                    )
                    insertions.append(
                        (sub_content_end, f'<!-- phase3_{q_tag}{label}_end -->')
                    )

                # Question end after last sub content
                insertions.append(
                    (last_sub_end, f'<!-- phase3_{q_tag}_end -->')
                )
        else:
            # --- after_text: single answer block (no sub-questions) ---
            # Find where the actual answer starts
            start_marker_text = qb.get('answer_start_marker', '')
            answer_start_line = header_idx + 1  # default: line after header

            if start_marker_text:
                found = _find_line(
                    lines, start_marker_text, header_idx + 1, 'contains',
                )
                if found is not None:
                    answer_start_line = found + 1  # line AFTER the start marker

            # Skip leading blank lines to the first real content
            while (answer_start_line < answer_end
                   and not lines[answer_start_line].strip()):
                answer_start_line += 1

            # Find content end (before trailing metadata)
            actual_end = _find_content_end(lines, answer_start_line, answer_end)

            matched.append(q_id)
            insertions.append(
                (answer_start_line, f'<!-- phase3_{q_tag}_start -->')
            )
            insertions.append(
                (actual_end, f'<!-- phase3_{q_tag}_end -->')
            )

    if not matched:
        return None, matched, failed

    # Apply insertions: group by line index, insert before each line
    before: dict[int, list[str]] = {}
    for line_idx, marker in insertions:
        before.setdefault(line_idx, []).append(marker)

    result_lines: list[str] = []
    for i, line in enumerate(lines):
        if i in before:
            result_lines.extend(before[i])
        result_lines.append(line)

    # Handle markers at end of file
    n = len(lines)
    if n in before:
        result_lines.extend(before[n])

    return '\n'.join(result_lines), matched, failed


async def phase3_prepare_tool(
    project_path: str,
    force: bool = False,
    force_overwrite_annotations: bool = False,
) -> dict:
    """
    Phase 3: Prepare student material for assessment.

    Copies student markdown files from 02_markdown/student_answers/ to
    03_material/student_answers/, prepending a student ID header comment
    and adding permanent line indices to each line.

    Auto-annotation is NOT performed here — run ``phase3_annotate`` next.

    Args:
        project_path: Path to the project root directory
        force: Overwrite existing files in 03_material/ (default: False)
        force_overwrite_annotations: Allow force to overwrite files that
            already contain Phase 3 annotation markers (default: False).
            Without this flag, annotated files are protected from
            accidental overwrite.

    Returns:
        dict with success, files_copied, skipped, errors, etc.
    """
    start_time = time.time()

    # Security: validate path before any file operations
    is_safe, security_error = validate_path_security(project_path)
    if not is_safe:
        return {"success": False, "error": f"Security: {security_error}"}

    project = Path(project_path).resolve()

    # Validate project exists and has state
    state_file = project / "project_state.json"
    if not state_file.exists():
        return {
            "success": False,
            "error": f"No project_state.json found at {project}. Run Phase 1 first.",
        }

    # Source: 02_markdown/student_answers/
    source_dir = project / PHASE2_MARKDOWN / "student_answers"
    if not source_dir.exists():
        return {
            "success": False,
            "error": f"Source directory not found: {source_dir}. Run Phase 2 first.",
        }

    # Find student markdown files
    source_files = sorted(source_dir.glob("*.md"))
    if not source_files:
        return {
            "success": False,
            "error": f"No .md files found in {source_dir}.",
        }

    # Destination: 03_material/student_answers/
    dest_dir = project / PHASE3_MATERIAL / "student_answers"
    dest_dir.mkdir(parents=True, exist_ok=True)

    files_copied = []
    files_skipped = []
    files_protected = []
    errors = []

    for source_file in source_files:
        dest_file = dest_dir / source_file.name

        try:
            # Idempotent: skip existing files unless force=True
            if dest_file.exists() and not force:
                files_skipped.append(source_file.name)
                log(f"Skipped (already exists): {source_file.name}")
                continue

            # Force-protection: refuse to overwrite annotated files
            if dest_file.exists() and force and not force_overwrite_annotations:
                existing = dest_file.read_text(encoding='utf-8')
                if '<!-- phase3_q' in existing:
                    files_protected.append(source_file.name)
                    log(f"Protected (has annotations): {source_file.name}")
                    continue

            # Read source content
            content = source_file.read_text(encoding='utf-8')

            # Extract student ID from filename (e.g. stu1.md -> stu1)
            student_id = source_file.stem

            # Prepend student header
            content_with_header = f"<!-- student: {student_id} -->\n\n{content}"

            # Add line indices and write (no auto-annotation — use phase3_annotate)
            indexed_content = _add_line_indices(content_with_header)
            dest_file.write_text(indexed_content, encoding='utf-8')

            files_copied.append(source_file.name)

        except Exception as e:
            errors.append(f"{source_file.name}: {e}")
            log(f"Error preparing {source_file.name}: {e}")

    # Determine overall success
    duration = round(time.time() - start_time, 2)
    success = len(files_copied) > 0 or (len(files_skipped) > 0 and not errors)
    status = "complete" if success and not errors else "incomplete"

    # Update project state
    try:
        update_project_state(
            project,
            phase=3,
            status=status,
            phase_name="3_prepare",
            files_copied=len(files_copied),
            files_skipped=len(files_skipped),
            output_directory=str(dest_dir),
            **({"partial_errors": errors} if errors else {}),
        )
    except Exception as state_error:
        log(f"Warning: Could not update project state: {state_error}")

    # Log workflow action
    try:
        log_workflow_action(
            project,
            phase=3,
            tool="phase3_prepare",
            action="prepare_student_material",
            input_data={
                "project_path": project_path,
                "force": force,
                "force_overwrite_annotations": force_overwrite_annotations,
                "source_dir": str(source_dir),
                "total_source_files": len(source_files),
            },
            output_data={
                "success": success,
                "files_copied": len(files_copied),
                "files_skipped": len(files_skipped),
                "files_protected": len(files_protected),
                "errors": errors if errors else None,
            },
            duration_seconds=duration,
        )
    except Exception as log_error:
        log(f"Warning: Could not log workflow action: {log_error}")

    # Build response
    result = {
        "success": success,
        "phase": 3,
        "phase_name": "Prepare Student Material",
        "files_copied": len(files_copied),
        "files_skipped": len(files_skipped),
        "copied_files": files_copied,
        "skipped_files": files_skipped,
        "output_directory": str(dest_dir),
        "duration_seconds": duration,
    }

    if files_protected:
        result["files_protected"] = len(files_protected)
        result["protected_files"] = files_protected
        result["protection_note"] = (
            "These files already have Phase 3 annotations and were NOT overwritten. "
            "Use force_overwrite_annotations=True to overwrite them."
        )

    if errors:
        result["errors"] = errors
        if not files_copied:
            result["error"] = f"All file preparation failed: {'; '.join(errors)}"

    if success:
        result["next_step"] = {
            "phase": "3 (annotate)",
            "name": "Auto-Annotate Student Answers",
            "instruction": (
                "Run phase3_annotate to auto-insert Phase 3 markers "
                "using answer_boundaries from exam_config.yaml. "
                "Then run phase3_validate to verify."
            ),
        }

    return result
