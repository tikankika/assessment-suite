"""Phase 3: Auto-annotate student files with Phase 3 markers.

Runs _try_auto_annotate on prepared files in 03_material/student_answers/,
inserting Phase 3 HTML comment markers around student answers using
answer_boundaries from exam_config.yaml.

Designed to run AFTER phase3_prepare (which adds headers + line indices)
and BEFORE phase3_validate.

See: RFC-034
"""

import sys
import time
from pathlib import Path
from typing import Optional

from ..validators import validate_path_security
from ..utils.state_manager import (
    update_project_state,
    log_workflow_action,
)
from ..constants.folders import PHASE3_MATERIAL

from .phase3_helpers import (
    PHASE3_MARKER_PREFIX,
    LINE_INDEX_RE,
    _load_answer_boundaries,
)
from .phase3_prepare import _try_auto_annotate, _add_line_indices


def log(msg: str) -> None:
    """Print to stderr to avoid corrupting MCP JSON-RPC stdout."""
    print(msg, file=sys.stderr)


def _strip_line_indices(content: str) -> str:
    """Remove line-index prefixes from content, preserving marker lines."""
    lines = content.split('\n')
    result = []
    for line in lines:
        if PHASE3_MARKER_PREFIX.match(line.strip()):
            result.append(line)
        else:
            result.append(LINE_INDEX_RE.sub('', line))
    return '\n'.join(result)


def _strip_existing_markers(content: str) -> str:
    """Remove existing Phase 3 marker lines from content."""
    lines = content.split('\n')
    return '\n'.join(
        line for line in lines
        if not PHASE3_MARKER_PREFIX.match(line.strip())
    )


async def phase3_annotate_tool(
    project_path: str,
    student_id: Optional[str] = None,
    force: bool = False,
) -> dict:
    """
    Phase 3: Auto-annotate student files with Phase 3 markers.

    Reads prepared files from 03_material/student_answers/ (already indexed),
    strips indices, runs auto-annotation, re-indexes, and writes back in-place.

    Args:
        project_path: Path to the project root directory
        student_id: Process a single student (e.g. 'stu1'), or all if None
        force: Overwrite existing markers (default: False — skip annotated files)

    Returns:
        dict with annotated/skipped/failed counts
    """
    start_time = time.time()

    # Security
    is_safe, security_error = validate_path_security(project_path)
    if not is_safe:
        return {"success": False, "error": f"Security: {security_error}"}

    project = Path(project_path).resolve()

    # Security: validate student_id has no path traversal (mirrors phase3_file_edit)
    if student_id and ("/" in student_id or "\\" in student_id or ".." in student_id):
        return {"success": False, "error": f"Invalid student_id: {student_id}"}

    # Load answer_boundaries
    boundaries = _load_answer_boundaries(project)
    if not boundaries:
        return {
            "success": False,
            "error": (
                "No answer_boundaries in exam_config.yaml. "
                "Run Phase 2C to configure boundaries first."
            ),
        }

    # Find files to annotate
    answers_dir = project / PHASE3_MATERIAL / "student_answers"
    if not answers_dir.exists():
        return {
            "success": False,
            "error": f"Directory not found: {answers_dir}. Run phase3_prepare first.",
        }

    if student_id:
        target = answers_dir / f"{student_id}.md"
        # Defence-in-depth: ensure the resolved path stays inside the answers dir.
        if not target.resolve().is_relative_to(answers_dir.resolve()):
            return {
                "success": False,
                "error": "Invalid student_id: path escapes expected directory",
            }
        if not target.exists():
            return {
                "success": False,
                "error": f"File not found: {target}",
            }
        files = [target]
    else:
        files = sorted(answers_dir.glob("*.md"))

    if not files:
        return {
            "success": False,
            "error": f"No .md files in {answers_dir}.",
        }

    annotated_files = []
    skipped_files = []
    failed_files = []
    errors = []

    for filepath in files:
        try:
            content = filepath.read_text(encoding='utf-8')

            # Skip already-annotated files unless force
            if '<!-- phase3_q' in content and not force:
                skipped_files.append(filepath.name)
                log(f"Skipped (already annotated): {filepath.name}")
                continue

            # Strip existing markers if force re-annotating
            if force and '<!-- phase3_q' in content:
                content = _strip_existing_markers(content)

            # Strip line indices to get raw content for annotation
            raw_content = _strip_line_indices(content)

            # Run auto-annotation
            result, matched, failed = _try_auto_annotate(raw_content, boundaries)

            if result and matched:
                # Re-add line indices and write back
                indexed = _add_line_indices(result)
                filepath.write_text(indexed, encoding='utf-8')

                if failed:
                    annotated_files.append({
                        'file': filepath.name,
                        'matched': matched,
                        'failed': failed,
                    })
                    log(f"  {filepath.name}: partial ({len(matched)} ok, {len(failed)} failed)")
                else:
                    annotated_files.append({
                        'file': filepath.name,
                        'matched': matched,
                        'failed': [],
                    })
                    log(f"  {filepath.name}: annotated ({len(matched)} questions)")
            else:
                failed_files.append({
                    'file': filepath.name,
                    'matched': [],
                    'failed': failed,
                })
                log(f"  {filepath.name}: annotation failed — {failed}")

        except Exception as e:
            errors.append(f"{filepath.name}: {e}")
            log(f"Error annotating {filepath.name}: {e}")

    duration = round(time.time() - start_time, 2)
    success = len(annotated_files) > 0 or len(skipped_files) > 0

    # Log workflow action
    try:
        log_workflow_action(
            project,
            phase=3,
            tool="phase3_annotate",
            action="auto_annotate",
            input_data={
                "project_path": project_path,
                "student_id": student_id,
                "force": force,
            },
            output_data={
                "success": success,
                "annotated": len(annotated_files),
                "skipped": len(skipped_files),
                "failed": len(failed_files),
            },
            duration_seconds=duration,
        )
    except Exception as log_error:
        log(f"Warning: Could not log workflow action: {log_error}")

    result = {
        "success": success,
        "phase": 3,
        "phase_name": "Auto-Annotate Student Answers",
        "annotated": len(annotated_files),
        "skipped": len(skipped_files),
        "failed": len(failed_files),
        "duration_seconds": duration,
    }

    fully_annotated = [
        a['file'] for a in annotated_files if not a['failed']
    ]
    partially_annotated = [
        a for a in annotated_files if a['failed']
    ]

    if fully_annotated:
        result["fully_annotated_files"] = fully_annotated
    if partially_annotated:
        result["partially_annotated"] = partially_annotated
    if skipped_files:
        result["skipped_files"] = skipped_files
    if failed_files:
        result["failed_files"] = failed_files
    if errors:
        result["errors"] = errors

    needs_manual = len(failed_files) + len(partially_annotated)
    if needs_manual:
        result["next_step"] = {
            "phase": "3 (manual annotation)",
            "name": "Manual Answer Annotation",
            "instruction": (
                f"{needs_manual} file(s) need manual annotation. "
                "Read methodology/technical/phase3_student_annotation.md, "
                "then annotate each flagged file. Run phase3_validate after."
            ),
        }
    else:
        result["next_step"] = {
            "phase": "3 (validate)",
            "name": "Validate Annotations",
            "instruction": (
                "All files annotated. Run phase3_validate to verify, "
                "then proceed to Phase 5."
            ),
        }

    return result
