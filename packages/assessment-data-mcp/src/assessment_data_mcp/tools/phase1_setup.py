"""Phase 1: setup_project tool implementation.

Orchestrates project setup: creates structure, copies files, generates metadata.
Implements Q1-Q5 decisions from PHASE-1-OVERVIEW.md.
"""

import yaml
import shutil
import sys
from pathlib import Path
from typing import Optional, Dict
import requests  # For exception handling
import time      # For duration tracking (Q4)

from ..validators.path_validator import validate_path
from ..validators import validate_path_security
from ..utils.file_ops import copy_file, copy_directory, count_files, download_url
from ..constants.folders import (
    PHASE1_ORIGINAL,
    PHASE2_MARKDOWN,
    PHASE3_MATERIAL,
    PHASE4_RUBRIC,
    PHASE5_ANSWERS,
    PHASE6_ASSESSMENT,
    PHASE7_STUDENT,
    COMPLETE_ASSESSMENT,
    METHODOLOGY,
)


def log(msg: str) -> None:
    """Print to stderr to avoid corrupting MCP JSON-RPC stdout."""
    print(msg, file=sys.stderr)


# Default methodology folder path (relative to monorepo root)
def _get_default_methodology_folder() -> str:
    """Get methodology folder path relative to this package."""
    # Navigate: tools/ -> assessment_data_mcp/ -> src/ -> assessment-data-mcp/ -> packages/ -> Assessment_suite/
    this_file = Path(__file__).resolve()
    monorepo_root = this_file.parents[5]  # Up 5 levels to Assessment_suite
    methodology_path = monorepo_root / METHODOLOGY  # Now at monorepo root
    return str(methodology_path)

DEFAULT_METHODOLOGY_FOLDER = _get_default_methodology_folder()


from ..utils.state_manager import (
    create_project_state,
    save_project_state,
    log_workflow_action,
    _get_timestamp
)


async def setup_project_tool(
    exam_path: Optional[str] = None,
    rubric_path: Optional[str] = None,
    syllabus_source: Optional[str] = None,
    student_answers_path: Optional[str] = None,
    course_content_path: Optional[str] = None,
    methodology_folder: Optional[str] = None,
    output_base_path: Optional[str] = None,
    project_name: Optional[str] = None
) -> dict:
    """
    Phase 1: Setup project structure.

    Q1: Returns plain dict (MCP SDK auto-wraps).
    Q2: Downloads Skolverket HTML → markdown.
    Q3: References course_content only (doesn't copy).
    Q4: Logs workflow actions to workflow_log.jsonl.
    Q5: Marks incomplete on error (no rollback).

    Args:
        exam_path: Path to exam PDF
        rubric_path: Path to rubric PDF
        syllabus_source: URL or path to syllabus
        student_answers_path: Directory with student PDFs
        course_content_path: Optional directory with course materials (Q3: referenced only)
        methodology_folder: Optional path to methodology docs (copied to project/methodology/)
        output_base_path: Base directory for project
        project_name: Project folder name

    Returns:
        dict: Success status, paths, and metadata (Q1: plain dict)
    """
    # Step 0: Start timer (Q4: Track duration)
    start_time = time.time()

    # Step 1: Validate required parameters
    if not all([exam_path, rubric_path, syllabus_source,
                student_answers_path, output_base_path, project_name]):
        return {
            "success": False,
            "error": {
                "type": "missing_parameters",
                "message": "Missing required parameters: exam_path, rubric_path, syllabus_source, student_answers_path, output_base_path, project_name",
                "required": ["exam_path", "rubric_path", "syllabus_source", "student_answers_path", "output_base_path", "project_name"]
            }
        }

    try:
        # Step 2: Validate paths
        validate_path(exam_path)
        validate_path(rubric_path)
        validate_path(student_answers_path)

        # Security: validate output path
        is_safe, security_error = validate_path_security(output_base_path)
        if not is_safe:
            return {"success": False, "error": f"Security: {security_error}"}

        # Convert to Path objects using resolve() for safety
        exam = Path(exam_path).resolve()
        rubric = Path(rubric_path).resolve()
        student_dir = Path(student_answers_path).resolve()
        output_base = Path(output_base_path).resolve()

        # Create output base if it doesn't exist
        output_base.mkdir(parents=True, exist_ok=True)

        # Step 3: Course content (RFC-028: copy to 03_material/)
        course_content_info = None
        if course_content_path:
            validate_path(course_content_path)
            course_content = Path(course_content_path).resolve()
            file_count = count_files(course_content)
            course_content_info = {
                "original_path": str(course_content),
                "type": "directory",
                "file_count": file_count,
                "copied_to": f"{PHASE3_MATERIAL}/"
            }

        # Step 4: Create project structure
        # Security: sanitize project_name to prevent path traversal
        safe_project_name = Path(project_name).name
        if not safe_project_name or safe_project_name in ('.', '..'):
            return {
                "success": False,
                "error": f"Invalid project name: {project_name}"
            }
        project_path = output_base / safe_project_name
        # Verify path stays within output_base
        if not project_path.resolve().is_relative_to(output_base.resolve()):
            return {
                "success": False,
                "error": f"Invalid project name: path escapes output directory"
            }
        project_path.mkdir(parents=True, exist_ok=True)

        # RFC-018 + RFC-028/ADR-006: Updated folder structure
        folders = [
            PHASE1_ORIGINAL,
            PHASE2_MARKDOWN,
            PHASE3_MATERIAL,       # RFC-028: Course materials (syllabi, ILOs, presentations)
            PHASE4_RUBRIC,         # RFC-028: Rubric construction artefacts
            PHASE5_ANSWERS,
            PHASE6_ASSESSMENT,
            PHASE7_STUDENT,
            COMPLETE_ASSESSMENT,
        ]
        for folder in folders:
            (project_path / folder).mkdir(exist_ok=True)

        # Step 5: Copy files
        original_dir = project_path / PHASE1_ORIGINAL

        # Preserve exam extension (.pdf, .docx, .txt, .md)
        exam_filename = f"exam_questions{exam.suffix}"
        copy_file(exam, original_dir / exam_filename)

        # Preserve rubric extension (.pdf or .md)
        rubric_filename = f"rubric{rubric.suffix}"
        copy_file(rubric, original_dir / rubric_filename)

        # Copy all student answer files (any format)
        student_count = copy_directory(
            student_dir,
            original_dir / "student_answers",
            pattern="*"  # Accept all file formats (.pdf, .docx, .txt, .md, etc.)
        )

        # Step 5b: Copy course materials to 03_material/ (RFC-028)
        course_material_count = 0
        if course_content_path:
            material_dir = project_path / PHASE3_MATERIAL
            course_content = Path(course_content_path).resolve()
            if course_content.exists() and course_content.is_dir():
                course_material_count = copy_directory(
                    course_content,
                    material_dir,
                    pattern="*"
                )
                log(f"Copied {course_material_count} course material files to {PHASE3_MATERIAL}/")

        # Step 6: Download/copy syllabus (Q2: HTML→markdown!)
        syllabus_filename = "syllabus.md"
        if syllabus_source.startswith('http'):
            # Q2: Download and convert HTML → markdown
            try:
                download_url(syllabus_source, original_dir / syllabus_filename)
            except requests.RequestException as e:
                # Q5: Mark incomplete on error
                try:
                    state = create_project_state(project_path, project_name, 1)
                    state["phases"]["1_setup"]["status"] = "incomplete"
                    state["phases"]["1_setup"]["error"] = {
                        "type": "network_error",
                        "message": "Failed to download syllabus",
                        "details": str(e),
                        "timestamp": _get_timestamp()
                    }
                    save_project_state(project_path, state)
                except:
                    pass  # Best effort

                return {
                    "success": False,
                    "error": {
                        "type": "network_error",
                        "message": "Failed to download syllabus",
                        "details": str(e)
                    }
                }
        else:
            # Local file
            validate_path(syllabus_source)
            syllabus_path = Path(syllabus_source).resolve()
            copy_file(syllabus_path, original_dir / syllabus_path.name)
            syllabus_filename = syllabus_path.name

        # Step 6b: Copy methodology docs (ADR-003 P0)
        # - None or not specified → use default
        # - "none" or "skip" → skip methodology (INGEN option)
        # - Custom path → use that path
        # - If parent dir already has methodology/ → reuse it, don't copy
        methodology_info = None
        methodology_count = 0
        skip_methodology = methodology_folder and methodology_folder.lower() in ("none", "skip", "ingen")

        # Check if parent directory has shared methodology
        effective_methodology_folder = None
        parent_methodology = project_path.parent / METHODOLOGY
        if not skip_methodology and parent_methodology.exists() and parent_methodology.is_dir():
            # Reuse parent methodology — don't copy
            methodology_count = len(list(parent_methodology.rglob("*.md")))
            methodology_info = {
                "original_path": str(parent_methodology),
                "type": "folder",
                "copied_to": f"../{METHODOLOGY}/",
                "file_count": methodology_count,
                "shared": True,
                "template_used": "parent"
            }
            log(f"Using shared methodology from parent: {parent_methodology} ({methodology_count} files)")
        else:
            effective_methodology_folder = None if skip_methodology else (methodology_folder or DEFAULT_METHODOLOGY_FOLDER)
            if effective_methodology_folder:
                methodology_path = Path(effective_methodology_folder).resolve()
                if methodology_path.exists() and methodology_path.is_dir():
                    methodology_dir = project_path / METHODOLOGY
                    methodology_dir.mkdir(exist_ok=True)

                    for md_file in methodology_path.rglob("*.md"):
                        if '_archive' in md_file.parts:
                            continue
                        rel_path = md_file.relative_to(methodology_path)
                        target = methodology_dir / rel_path
                        target.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(md_file, target)
                        methodology_count += 1
                        log(f"Copied methodology: {rel_path}")

                    methodology_info = {
                        "original_path": str(effective_methodology_folder),
                        "type": "folder",
                        "copied_to": f"{METHODOLOGY}/",
                        "file_count": methodology_count,
                        "is_default": methodology_folder is None,
                        "template_used": "standard" if methodology_folder is None else "custom"
                    }
            elif skip_methodology:
                # ADR-003: Explicitly skipped methodology (INGEN option)
                methodology_info = {
                    "skipped": True,
                    "template_used": "none"
                }

        # Step 6c: Generate CLAUDE.md project instructions (RFC-040)
        # If parent dir has a CLAUDE.md (>100 bytes = not just "test"), reuse it
        parent_claude_md = project_path.parent / "CLAUDE.md"
        parent_has_claude = (
            parent_claude_md.exists() and
            parent_claude_md.stat().st_size > 100
        )

        claude_md_path = project_path / "CLAUDE.md"
        if parent_has_claude:
            log(f"Using shared CLAUDE.md from parent: {parent_claude_md}")
        elif not claude_md_path.exists():
            # Find template — check parent methodology first, then effective_methodology_folder
            template_path = None
            # Check parent methodology templates
            parent_template = project_path.parent / METHODOLOGY / "templates" / "CLAUDE.md.template"
            if parent_template.exists():
                template_path = parent_template
            elif methodology_info and not methodology_info.get("shared"):
                # Check project-local methodology
                local_template = project_path / METHODOLOGY / "templates" / "CLAUDE.md.template"
                if local_template.exists():
                    template_path = local_template
            if not template_path and effective_methodology_folder:
                tp = Path(effective_methodology_folder).resolve() / "templates" / "CLAUDE.md.template"
                if tp.exists():
                    template_path = tp
            if template_path:
                template_content = template_path.read_text(encoding='utf-8')
                claude_md_content = template_content.replace(
                    "{{exam_name}}", project_name or "Exam"
                ).replace(
                    "{{course_code}}", "UPDATE_ME"
                ).replace(
                    "{{exam_date}}", _get_timestamp().split("T")[0]
                ).replace(
                    "{{student_count}}", str(student_count)
                )
                claude_md_path.write_text(claude_md_content, encoding='utf-8')
                log(f"Generated CLAUDE.md project instructions")
            else:
                log(f"CLAUDE.md template not found — skipping project instructions")

        # Step 7: Generate sources.yaml
        sources_data = {
            "project": {
                "name": project_name,
                "created": _get_timestamp()
            },
            "sources": {
                "exam_questions": {
                    "original_path": str(exam),
                    "type": exam.suffix[1:],  # Dynamic: "pdf", "docx", "txt", "md"
                    "copied_to": f"{PHASE1_ORIGINAL}/{exam_filename}"
                },
                "rubric": {
                    "original_path": str(rubric),
                    "type": rubric.suffix[1:],  # "pdf" or "md"
                    "copied_to": f"{PHASE1_ORIGINAL}/{rubric_filename}"
                },
                "syllabus": {
                    "original_source": syllabus_source,
                    "type": "markdown" if syllabus_source.startswith('http') else Path(syllabus_source).suffix[1:],
                    "copied_to": f"{PHASE1_ORIGINAL}/{syllabus_filename}"
                },
                "student_answers": {
                    "original_path": str(student_dir),
                    "type": "directory",
                    "file_count": student_count,
                    "copied_to": f"{PHASE1_ORIGINAL}/student_answers"
                }
            }
        }

        # Q3: Add course content reference (NOT copied!)
        if course_content_info:
            sources_data["sources"]["course_content"] = course_content_info

        # Add methodology reference (copied!)
        if methodology_info:
            sources_data["sources"]["methodology"] = methodology_info

        with open(project_path / "sources.yaml", 'w', encoding='utf-8') as f:
            yaml.safe_dump(sources_data, f, allow_unicode=True, sort_keys=False)

        # Step 8: Create state (Q5: Complete on success)
        state = create_project_state(project_path, project_name, phase=1)
        state["phases"]["1_setup"]["status"] = "complete"
        state["phases"]["1_setup"]["files_created"] = student_count + 3 + methodology_count  # exam, rubric, syllabus + methodology
        state["phases"]["1_setup"]["folders_created"] = len(folders) + (1 if methodology_info else 0)

        save_project_state(project_path, state)

        # Step 8.5: Log workflow action (Q4: Logging)
        duration = time.time() - start_time

        log_workflow_action(
            project_path,
            phase=1,
            tool="setup_project",
            action="project_creation",
            input_data={
                "exam_path": exam_path,
                "rubric_path": rubric_path,
                "syllabus_source": syllabus_source,
                "student_answers_path": student_answers_path,
                "project_name": project_name,
                "has_course_content": course_content_path is not None,
                "has_methodology": methodology_count > 0
            },
            output_data={
                "success": True,
                "files_created": student_count + 3 + methodology_count,
                "methodology_files": methodology_count,
                "folders_created": len(folders) + (1 if methodology_info else 0),
                "project_path": str(project_path)
            },
            duration_seconds=round(duration, 2)
        )

        # Step 9: Return (Q1: Plain dict - MCP wraps)
        total_files = student_count + 3 + methodology_count
        total_folders = len(folders) + (1 if methodology_info else 0)
        methodology_msg = f" (incl. {methodology_count} methodology docs)" if methodology_count else ""
        return {
            "success": True,
            "project_path": str(project_path),
            "files_created": total_files,
            "methodology_files": methodology_count,
            "folders_created": total_folders,
            "sources_saved": sources_data,
            "message": f"✓ Created project '{project_name}' with {total_files} files{methodology_msg} and {total_folders} folders",
            "next_step": "Use convert_documents tool to process PDFs (Phase 2A)"
        }

    except FileNotFoundError as e:
        # Q5: Mark incomplete on error
        try:
            if 'project_path' in locals():
                state = create_project_state(project_path, project_name, 1)
                state["phases"]["1_setup"]["status"] = "incomplete"
                state["phases"]["1_setup"]["error"] = {
                    "type": "FileNotFoundError",
                    "message": str(e),
                    "timestamp": _get_timestamp()
                }
                save_project_state(project_path, state)
        except:
            pass  # Best effort

        return {
            "success": False,
            "error": {
                "type": "file_not_found",
                "message": str(e)
            }
        }

    except PermissionError as e:
        # Q5: Mark incomplete on error
        try:
            if 'project_path' in locals():
                state = create_project_state(project_path, project_name, 1)
                state["phases"]["1_setup"]["status"] = "incomplete"
                state["phases"]["1_setup"]["error"] = {
                    "type": "PermissionError",
                    "message": str(e),
                    "timestamp": _get_timestamp()
                }
                save_project_state(project_path, state)
        except:
            pass  # Best effort

        return {
            "success": False,
            "error": {
                "type": "permission_error",
                "message": str(e)
            }
        }

    except Exception as e:
        # Q5: Mark incomplete on error (generic catch-all)
        try:
            if 'project_path' in locals():
                state = create_project_state(project_path, project_name, 1)
                state["phases"]["1_setup"]["status"] = "incomplete"
                state["phases"]["1_setup"]["error"] = {
                    "type": type(e).__name__,
                    "message": str(e),
                    "timestamp": _get_timestamp()
                }
                save_project_state(project_path, state)
        except:
            pass  # Best effort

        return {
            "success": False,
            "error": {
                "type": type(e).__name__,
                "message": str(e)
            }
        }
