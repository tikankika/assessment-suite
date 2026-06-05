"""
phase7_generate_reports.py - Generate student reports from Q-files

This MCP tool reads assessed Q-files (question-by-question view) and
generates individual student reports (student-by-student view).

TEACHER CONFIRMATION FLOW (RFC-001 Extension 2026-01-17):
1. First call with mode="preview" → Returns formatted summary for review
2. Teacher reviews anomalies and examples in chat
3. Second call with mode="generate", confirmed=True → Creates files

NEW: mode="analyze" for pattern detection (RFC-020):
- Scans Q-files to detect point patterns in free-text assessments
- Reports which patterns are used and suggests patterns for exam_config.yaml
- Use when standard parsing returns 0 points for many students

Input: 06_analytic_assessment/Q*.md (Phase 6 output) - RFC-018
Output: 07_analytic_student/Analytic_{student}.md + complete_assessment/Complete_{student}.md

See RFC-001 for full specification.
"""

from pathlib import Path
from typing import Dict, Any, Optional, Literal
import sys
import logging

from assessment_data_mcp.phase7 import (
    StudentReportGenerator,
    generate_reports,
)
from assessment_data_mcp.phase7.pattern_config import (
    analyze_patterns,
    load_pattern_config,
    save_pattern_config,
    Phase7PatternConfig,
    TotalPattern,
)
from assessment_data_mcp.utils.state_manager import (
    update_project_state,
    log_workflow_action,
)
from assessment_data_mcp.utils.logging_config import (
    setup_project_logging,
    log_phase_start,
    log_phase_complete,
)
from ..validators import validate_path_security
from ..constants.folders import PHASE6_ASSESSMENT, PHASE7_STUDENT, COMPLETE_ASSESSMENT

logger = logging.getLogger(__name__)


def log(msg: str) -> None:
    """Print to stderr to avoid corrupting MCP JSON-RPC stdout."""
    print(msg, file=sys.stderr)


async def phase7_generate_reports_tool(
    project_path: str,
    mode: str = "preview",
    output_dir: str = PHASE7_STUDENT,
    confirmed: bool = False,
    save_patterns: bool = False,
    confirmed_by: str = "",
    dry_run: bool = False,
    force: bool = False,
    quiet: bool = False
) -> Dict[str, Any]:
    """
    Generate student reports from assessed Q-files.

    TEACHER CONFIRMATION FLOW:
    - mode="preview": Analyze Q-files, show summary with anomalies (ALWAYS call first)
    - mode="generate": Create files (requires confirmed=True for safety)
    - mode="analyze": Detect patterns in free-text assessments (RFC-020)

    PATTERN DETECTION FLOW (mode="analyze"):
    1. First call with mode="analyze" → Returns pattern analysis summary
    2. Teacher reviews suggested patterns
    3. Second call with mode="analyze", save_patterns=True, confirmed_by="Name" → Saves to exam_config.yaml

    This tool reorganizes assessments from question-view to student-view:
    - Input: Q-files with all students per question
    - Output: Student reports with all questions per student

    Args:
        project_path: Path to project root directory
        mode: "preview", "generate", or "analyze" (pattern detection)
        output_dir: Output directory for reports (default: 07_analytic_student)
        confirmed: Must be True to generate files (safety check)
        save_patterns: For analyze mode - save detected patterns to exam_config.yaml
        confirmed_by: For analyze mode - teacher name for audit trail
        dry_run: DEPRECATED - use mode="preview" instead
        force: If True, overwrite existing reports
        quiet: If True, suppress progress output

    Returns:
        Dict with success status, preview_summary (for preview), or reports created (for generate)
    """
    # Security: validate path before any file operations
    is_safe, security_error = validate_path_security(project_path)
    if not is_safe:
        return {"success": False, "error": f"Security: {security_error}"}

    project = Path(project_path)

    # Setup project-specific logging
    if project.exists():
        setup_project_logging(project)
        log_phase_start(7, "phase7_generate_reports", mode=mode, project=project.name)

    if not quiet:
        log(f"[Phase 7] Starting report generation for: {project_path} (mode={mode})")

    # Validate project path
    if not project.exists():
        return {
            "success": False,
            "error": f"Project path not found: {project_path}",
            "suggestion": "Verify the project path is correct"
        }

    if not project.is_dir():
        return {
            "success": False,
            "error": f"Project path is not a directory: {project_path}",
            "suggestion": "Provide path to project root directory"
        }

    # Check for Q-files directory (RFC-018: Phase 6 working copies)
    q_files_dir = project / PHASE6_ASSESSMENT
    if not q_files_dir.exists():
        return {
            "success": False,
            "error": f"Q-files directory not found: {q_files_dir}",
            "suggestion": "Run Phase 5 (phase5_qfiles) first to create Q-files in 05/, then Phase 6 to assess them (copies to 06/)"
        }

    # Check for assessment format configuration (Phase 6-post)
    # This is REQUIRED for reliable report generation
    exam_config_path = project / "exam_config.yaml"
    format_configured = False
    format_warning = None

    if exam_config_path.exists():
        import yaml
        try:
            with open(exam_config_path, 'r', encoding='utf-8') as f:
                exam_config = yaml.safe_load(f) or {}
            format_configured = 'assessment_format' in exam_config
        except Exception:
            pass

    if not format_configured:
        format_warning = (
            "⚠️ WARNING: Assessment format not configured!\n\n"
            "Phase 6-post (phase6_post_format) has not been run.\n"
            "This may cause incorrect point extraction.\n\n"
            "RECOMMENDED: Run 'phase6_post_format' before generating reports.\n"
            "Workflow: Phase 6 → Phase 6-post → Phase 7\n"
        )
        if not quiet:
            log(format_warning)

    # Handle different modes
    generator = StudentReportGenerator()

    # ANALYZE MODE: Pattern detection for legacy/free-text assessments (RFC-020)
    if mode == "analyze":
        try:
            analysis = analyze_patterns(project)
        except Exception as e:
            log(f"[Phase 7] Analyze error: {e}")
            return {
                "success": False,
                "error": str(e),
                "suggestion": "Check Q-file format and try again"
            }

        response: Dict[str, Any] = {
            "success": True,
            "mode": "analyze",
            "analysis_summary": analysis.format_summary(),
            "total_students": analysis.total_students,
            "standard_format_count": analysis.standard_format_count,
            "metadata_format_count": analysis.metadata_format_count,
            "fallback_matches": analysis.fallback_matches,
            "unparseable_count": len(analysis.unparseable_students),
        }

        # If save_patterns requested and we have patterns to save
        if save_patterns and analysis.suggested_patterns:
            if not confirmed_by:
                response["success"] = False
                response["error"] = "confirmed_by required when saving patterns"
                response["suggestion"] = "Add confirmed_by='YourName' to save patterns"
                return response

            config = Phase7PatternConfig(
                confirmed_by=confirmed_by,
                total_patterns=analysis.suggested_patterns
            )

            if save_pattern_config(project, config):
                response["patterns_saved"] = True
                response["patterns_saved_to"] = str(project / "exam_config.yaml")
                response["message"] = f"✅ Sparade {len(analysis.suggested_patterns)} mönster till exam_config.yaml"
                response["next_step"] = "Kör mode='preview' igen för att verifiera att fler bedömningar parsas korrekt"
            else:
                response["patterns_saved"] = False
                response["error"] = "Failed to save patterns to exam_config.yaml"
        else:
            # Just analysis, no save
            if analysis.suggested_patterns:
                response["suggested_patterns_count"] = len(analysis.suggested_patterns)
                response["next_step"] = (
                    "Granska analysen ovan. Om mönstren ser korrekta ut, "
                    "kör med save_patterns=True, confirmed_by='DittNamn' för att spara."
                )
            else:
                response["next_step"] = (
                    "Inga fallback-mönster behövs - standard/metadata-format används. "
                    "Kör mode='preview' för att fortsätta."
                )

        if not quiet:
            log(f"[Phase 7] Pattern analysis complete. "
                f"Standard: {analysis.standard_format_count}, "
                f"Metadata: {analysis.metadata_format_count}, "
                f"Fallback: {sum(analysis.fallback_matches.values())}, "
                f"Unparseable: {len(analysis.unparseable_students)}")

        return response

    # PREVIEW MODE: Analyze and return formatted summary
    if mode == "preview" or dry_run:
        try:
            result = generator.generate_preview(project)
        except Exception as e:
            log(f"[Phase 7] Preview error: {e}")
            return {
                "success": False,
                "error": str(e),
                "suggestion": "Check Q-file format matches Phase 6 output"
            }

        # Return preview response
        response: Dict[str, Any] = {
            "success": True,
            "mode": "preview",
            "requires_confirmation": True,
            "preview_summary": result.preview_summary,
            "reports_would_create": result.reports_created,
        }

        # Add format warning if Phase 6-post not run
        if format_warning:
            response["format_warning"] = format_warning
            response["phase6_post_required"] = True

        # Add anomaly information
        if result.anomalies:
            response["anomalies"] = [
                {
                    "severity": a.severity,
                    "code": a.code,
                    "message": a.message,
                    "question_id": a.question_id
                }
                for a in result.anomalies
            ]
            response["has_errors"] = result.has_errors
            response["has_warnings"] = result.has_warnings

        # Add existing reports warning
        if result.existing_reports_count > 0:
            response["existing_reports_count"] = result.existing_reports_count
            response["existing_reports_warning"] = (
                f"⚠️ {result.existing_reports_count} rapporter finns redan. "
                "Använd force=True för att skriva över."
            )

        # Determine next step based on state
        if result.has_errors:
            response["next_step"] = "Åtgärda felen i Q-filerna innan rapporter kan skapas"
        elif result.existing_reports_count > 0:
            response["next_step"] = (
                f"Rapporter finns redan ({result.existing_reports_count} st). "
                "Kör mode='generate', confirmed=True, force=True för att skriva över."
            )
        else:
            response["next_step"] = "Granska sammanfattningen ovan och bekräfta med mode='generate', confirmed=True"

        if not quiet:
            log(f"[Phase 7] Preview complete. Would create {result.reports_created} reports.")

        return response

    # GENERATE MODE: Create files (requires confirmation)
    if mode == "generate":
        if not confirmed:
            return {
                "success": False,
                "error": "Generering kräver confirmed=True för säkerhet",
                "suggestion": "Kör först med mode='preview', granska sedan och kör med mode='generate', confirmed=True"
            }

        try:
            result = generate_reports(
                project_path=project,
                output_dir=output_dir,
                dry_run=False,
                force=force
            )
        except Exception as e:
            log(f"[Phase 7] Generate error: {e}")
            return {
                "success": False,
                "error": str(e),
                "suggestion": "Check Q-file format matches Phase 6 output"
            }

        # Prepare response for generate mode
        response = {
            "success": result.success,
            "mode": "generate",
            "reports_created": result.reports_created,
            "output_dir": result.output_dir,
        }

        if result.errors:
            response["errors"] = result.errors

        if result.warnings:
            response["warnings"] = result.warnings

        # Add student summary
        if result.reports:
            response["students"] = []
            for report in result.reports:
                response["students"].append({
                    "student_id": report.student_id,
                    "total_points": report.total_points,
                    "max_points": report.max_points,
                    "percentage": round(report.percentage, 1),
                    "questions": len(report.questions)
                })

        # Validation summary
        if result.validation:
            response["validation"] = {
                "valid": result.validation.valid,
                "error_count": len(result.validation.errors),
                "warning_count": len(result.validation.warnings)
            }

        # Log workflow action on success
        if result.success:
            # RFC-029 §19.2 P9: Separate try-blocks so log_workflow_action
            # is not skipped if update_project_state fails
            try:
                update_project_state(
                    project_path=project,
                    phase=7,
                    status="complete",
                    phase_name="7_reports",
                    reports_created=result.reports_created,
                    output_directory=str(result.output_dir),
                )
            except Exception as e:
                if not quiet:
                    log(f"[Phase 7] Warning: Failed to update project state: {e}")

            try:
                log_workflow_action(
                    project_path=project,
                    phase=7,
                    tool="phase7_generate_reports",
                    action="generate_student_reports",
                    input_data={
                        "project_path": str(project),
                        "output_dir": output_dir,
                        "force": force
                    },
                    output_data={
                        "reports_created": result.reports_created,
                        "output_dir": str(result.output_dir)
                    }
                )
            except Exception as e:
                if not quiet:
                    log(f"[Phase 7] Warning: Failed to log workflow action: {e}")

            response["message"] = f"✅ Skapade {result.reports_created} studentrapporter i {result.output_dir}"
            response["next_step"] = f"Granska rapporterna i {PHASE7_STUDENT}/ och {COMPLETE_ASSESSMENT}/"

        if not quiet:
            log(f"[Phase 7] Complete. Reports created: {result.reports_created}")

        return response

    # Invalid mode
    return {
        "success": False,
        "error": f"Ogiltigt läge: {mode}",
        "suggestion": "Använd mode='preview' eller mode='generate'"
    }
