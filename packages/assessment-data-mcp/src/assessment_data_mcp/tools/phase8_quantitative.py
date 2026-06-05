"""
MCP Tool: Phase 8 Quantitative Summary

Generate quantitative summaries using HYBRID parsing strategy.

PRIMARY: Parse summary table from student reports (07_analytic_student/)
FALLBACK: Parse Q-files directly (06_analytic_assessment/)

RFC-018 DUAL OUTPUT:
Input: Student reports OR Q-files (hybrid auto-selects)
Output:
  - 08_quantitative/Student_{student}_quantitative.json
  - 07_analytic_student/Analytic_{student}.md (summary appended)
  - complete_assessment/Complete_{student}.md (PHASE_8 section inserted)

RFC-017: Phase 8 Parser Fix - Hybrid Approach
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

from assessment_data_mcp.phase8.hybrid_parser import (
    parse_student_hybrid,
    parse_all_students_hybrid,
    discover_students,
)
from assessment_data_mcp.phase8.table_parser import parse_summary_table
from assessment_data_mcp.phase8.qfile_parser import parse_all_qfiles_for_student
from assessment_data_mcp.utils.state_manager import (
    update_project_state,
    log_workflow_action,
)
from assessment_data_mcp.utils.logging_config import (
    setup_project_logging,
    log_phase_start,
    log_phase_complete,
)
from ..validators import validate_path_security, assert_safe_identifier
from ..constants.folders import (
    PHASE6_ASSESSMENT,
    PHASE7_STUDENT,
    PHASE8_QUANTITATIVE,
    COMPLETE_ASSESSMENT,
)

logger = logging.getLogger(__name__)


async def phase8_quantitative_tool(
    project_path: str,
    student_id: Optional[str] = None,
    strategy: Literal["hybrid", "table", "qfiles"] = "hybrid",
    output_dir: str = PHASE8_QUANTITATIVE,
    dry_run: bool = False,
    quiet: bool = False,
) -> Dict[str, Any]:
    """
    MCP Tool: Generate quantitative summaries using HYBRID parsing.

    Uses RFC-017 hybrid strategy:
    1. PRIMARY: Parse summary table from student reports (fast, simple)
    2. FALLBACK: Parse Q-files directly (robust, source of truth)

    Args:
        project_path: Root path of assessment project
        student_id: Process specific student (None = all students)
        strategy: Parsing strategy:
                  - "hybrid" (default): Try table, fallback to Q-files
                  - "table": Only parse summary tables
                  - "qfiles": Only parse Q-files
        output_dir: Output directory for JSON files (default: 08_quantitative)
        dry_run: Validate only, don't write files
        quiet: Suppress progress output

    Returns:
        {
            "success": bool,
            "processed": int,
            "strategy_used": {"table": int, "qfiles": int, "failed": int},
            "outputs": List[str],
            "warnings": List[dict],
            "summaries": List[dict]
        }
    """
    # Security: validate path before any file operations
    is_safe, security_error = validate_path_security(project_path)
    if not is_safe:
        return {"success": False, "error": f"Security: {security_error}", "processed": 0}

    # Security: student_id is interpolated into Analytic_{student_id}.md and read.
    # It is not a PATH_ARG_NAME, so reject traversal here. (Vuln 4, RFC-035 gap.)
    if student_id is not None:
        id_ok, id_error = assert_safe_identifier(student_id, "student_id")
        if not id_ok:
            return {"success": False, "error": id_error, "processed": 0}

    project = Path(project_path)
    output_path = project / output_dir

    # Setup project-specific logging
    if project.exists():
        setup_project_logging(project)
        log_phase_start(8, "phase8_quantitative", strategy=strategy, student=student_id or "all")

    # Validate project structure
    if not project.exists():
        return {
            "success": False,
            "error": f"Project path does not exist: {project_path}",
            "processed": 0,
        }

    # Discover students
    if student_id:
        student_ids = [student_id]
    else:
        student_ids = discover_students(project)

    if not student_ids:
        return {
            "success": False,
            "error": f"No students found. Check {PHASE7_STUDENT}/ or {PHASE6_ASSESSMENT}/",
            "hint": "Run Phase 7 first, or ensure Q-files have assessments.",
            "processed": 0,
        }

    # Create output directory
    if not dry_run:
        output_path.mkdir(parents=True, exist_ok=True)

    # Process students
    outputs: List[str] = []
    all_warnings: List[dict] = []
    summaries: List[dict] = []
    strategy_stats = {"table": 0, "qfiles": 0, "failed": 0}

    for sid in student_ids:
        try:
            # Parse using selected strategy
            if strategy == "hybrid":
                data = parse_student_hybrid(project, sid)
            elif strategy == "table":
                # RFC-018: Updated path and filename
                report_path = project / PHASE7_STUDENT / f"Analytic_{sid}.md"
                data = parse_summary_table(report_path)
                if not data:
                    raise ValueError(f"Table parsing failed for {sid}")
            elif strategy == "qfiles":
                # RFC-018: Updated path
                qfiles_dir = project / PHASE6_ASSESSMENT
                data = parse_all_qfiles_for_student(qfiles_dir, sid)
                if not data:
                    raise ValueError(f"Q-file parsing failed for {sid}")
            else:
                raise ValueError(f"Unknown strategy: {strategy}")

            # Track strategy used
            strategy_stats[data["source"]] += 1

            # Convert questions dict to array format for Phase 9 compatibility
            # Phase 9 expects: [{ "question_id": "Q001A", "points": 2.0, "max_points": 2.0, "status": "..." }]
            questions_array = [
                {
                    "question_id": q_id,
                    "points": q_data["points"],
                    "max_points": q_data["max"],
                    "status": "complete" if q_data["points"] > 0 else "partial"
                }
                for q_id, q_data in sorted(data["questions"].items())
            ]

            # Build quantitative output
            quantitative = {
                "student_id": data["student_id"],
                "total_points": data["total_points"],
                "max_points": data["max_points"],
                "percentage": data["percentage"],
                "questions": questions_array,
                "questions_answered": data["questions_answered"],
                "questions_total": len(data["questions"]),
                "metadata": {
                    "generated_at": datetime.now().isoformat(),
                    "source": data["source"],
                    "strategy": strategy,
                }
            }

            # Brief summary for response
            summaries.append({
                "student_id": data["student_id"],
                "total_points": data["total_points"],
                "max_points": data["max_points"],
                "percentage": data["percentage"],
                "source": data["source"],
            })

            # RFC-018 DUAL OUTPUT
            if not dry_run:
                student_id_str = data['student_id']

                # 1. Write JSON to 08_quantitative/
                output_file = output_path / f"Student_{student_id_str}_quantitative.json"
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(quantitative, f, indent=2, ensure_ascii=False)
                outputs.append(str(output_file.relative_to(project)))

                # 2. Generate summary table markdown
                summary_table = _generate_summary_table(data)

                # 3. Append to Analytic report (07_analytic_student/)
                # RFC-029 §20 Q2: Individual try-except for each file write
                analytic_file = project / PHASE7_STUDENT / f"Analytic_{student_id_str}.md"
                if analytic_file.exists():
                    try:
                        _append_to_analytic_report(analytic_file, summary_table)
                    except Exception as e:
                        all_warnings.append({
                            "type": "analytic_write_error",
                            "student_id": sid,
                            "error": str(e),
                        })

                # 4. Insert PHASE_8 section to Complete assessment
                complete_file = project / COMPLETE_ASSESSMENT / f"Complete_{student_id_str}.md"
                if complete_file.exists():
                    try:
                        _insert_phase8_section(complete_file, summary_table)
                    except Exception as e:
                        all_warnings.append({
                            "type": "complete_write_error",
                            "student_id": sid,
                            "error": str(e),
                        })

                if not quiet:
                    print(f"  {student_id_str}: {data['total_points']}/{data['max_points']}p ({data['percentage']}%) [{data['source']}]")

        except ValueError as e:
            strategy_stats["failed"] += 1
            all_warnings.append({
                "type": "parse_error",
                "student_id": sid,
                "error": str(e)
            })
        except Exception as e:
            strategy_stats["failed"] += 1
            all_warnings.append({
                "type": "processing_error",
                "student_id": sid,
                "error": str(e)
            })

    # Update project state
    # RFC-029 §20 Q7+Q8: Separate try-blocks so log_workflow_action
    # is not skipped if update_project_state fails
    if not dry_run and outputs:
        try:
            update_project_state(
                project,
                phase=8,
                status="complete",
                phase_name="8_quantitative",
                students_processed=len(outputs),
                strategy=strategy,
                output_dir=str(output_dir),
            )
        except Exception as e:
            logger.warning(f"Failed to update project state: {e}")

        try:
            log_workflow_action(
                project,
                phase=8,
                tool="phase8_quantitative",
                action="quantitative_analysis",
                input_data={
                    "students_processed": len(outputs),
                    "strategy": strategy,
                },
                output_data={
                    "strategy_stats": strategy_stats,
                    "warnings": len(all_warnings),
                    "success": True,
                },
            )
        except Exception as e:
            logger.warning(f"Failed to log workflow action: {e}")

    # Determine success
    success = len(summaries) > 0 and strategy_stats["failed"] == 0

    return {
        "success": success,
        "processed": len(student_ids),
        "strategy": strategy,
        "strategy_used": strategy_stats,
        "outputs": outputs if not dry_run else [],
        "warnings": all_warnings,
        "summaries": summaries,
        "dry_run": dry_run,
    }


# RFC-018: Helper functions for DUAL OUTPUT

def _generate_summary_table(data: Dict[str, Any]) -> str:
    """Generate markdown summary table from quantitative data."""
    lines = [
        "## Kvantitativ Sammanfattning",
        "",
        "| Fråga | Poäng | Max | Procent |",
        "|-------|-------|-----|---------|",
    ]

    for q_id, q_data in sorted(data["questions"].items()):
        pct = (q_data["points"] / q_data["max"] * 100) if q_data["max"] > 0 else 0
        lines.append(f"| {q_id} | {q_data['points']:.1f} | {q_data['max']:.1f} | {pct:.0f}% |")

    lines.append("")
    lines.append(f"**Total: {data['total_points']:.1f}/{data['max_points']:.1f} ({data['percentage']:.1f}%)**")

    return "\n".join(lines)


def _append_to_analytic_report(file_path: Path, summary_table: str) -> None:
    """Append summary table to Analytic report file."""
    content = file_path.read_text(encoding='utf-8')

    # Check if summary already exists
    if "## Kvantitativ Sammanfattning" in content:
        return  # Already has summary, skip

    # Append summary
    content += "\n\n---\n\n" + summary_table
    file_path.write_text(content, encoding='utf-8')


def _insert_phase8_section(file_path: Path, summary_table: str) -> None:
    """Insert PHASE_8 section into Complete assessment file."""
    content = file_path.read_text(encoding='utf-8')

    # Check if PHASE_8 already exists
    if "<!-- PHASE_8_START -->" in content:
        return  # Already has PHASE_8, skip

    timestamp = datetime.now().strftime('%Y-%m-%d')

    phase_section = f"""
---

<!-- PHASE_8_START -->
## PHASE 8: Kvantitativ Analys

{summary_table}
<!-- PHASE_8_END -->
"""

    changelog_entry = f"| {timestamp} | Phase 8 | Kvantitativ analys |\n"

    # Insert before CHANGELOG
    if "<!-- CHANGELOG_START -->" in content:
        content = content.replace(
            "<!-- CHANGELOG_START -->",
            f"{phase_section}\n<!-- CHANGELOG_START -->"
        )

        # Add changelog entry
        content = content.replace(
            "<!-- CHANGELOG_END -->",
            f"{changelog_entry}<!-- CHANGELOG_END -->"
        )
    else:
        # No changelog markers, just append
        content += phase_section

    file_path.write_text(content, encoding='utf-8')
