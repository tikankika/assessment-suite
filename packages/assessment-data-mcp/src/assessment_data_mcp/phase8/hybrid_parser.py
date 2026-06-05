"""
Hybrid Parser for Phase 8 Quantitative Analysis.

Orchestrates PRIMARY (table) and FALLBACK (Q-files) parsing strategies.

Strategy:
1. Try parsing summary table from student report (fast, simple)
2. If table parsing fails → Parse Q-files (robust, source of truth)
3. Return result with 'source' indicator for debugging

RFC-017: Phase 8 Parser Fix - Hybrid Approach
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from .table_parser import parse_summary_table, find_student_reports
from .qfile_parser import parse_all_qfiles_for_student, find_all_students_in_qfiles
from ..constants.folders import PHASE6_ASSESSMENT, PHASE7_STUDENT

logger = logging.getLogger(__name__)


def parse_student_hybrid(project_path: Path, student_id: str) -> Dict:
    """
    Parse quantitative data for a student using hybrid strategy.

    Strategy:
    1. Try table parser (PRIMARY) - fast, simple
    2. If fails → Q-file parser (FALLBACK) - robust

    Args:
        project_path: Path to assessment project root
        student_id: Student ID to process

    Returns:
        Dictionary with quantitative data:
        {
            "student_id": "<id>",
            "total_points": 36.0,
            "max_points": 40.0,
            "percentage": 90.0,
            "questions": {...},
            "questions_answered": 14,
            "source": "table" or "qfiles"
        }

    Raises:
        ValueError: If both strategies fail
    """
    project_path = Path(project_path)

    # PRIMARY: Try table parser (RFC-018: updated path)
    report_path = project_path / PHASE7_STUDENT / f"Analytic_{student_id}.md"

    if report_path.exists():
        logger.debug(f"Trying table parser for {student_id}")
        table_data = parse_summary_table(report_path)

        if table_data and table_data["total_points"] >= 0:
            logger.info(f"Table parser succeeded for {student_id}")
            return table_data

        logger.debug(f"Table parser returned no data for {student_id}, trying fallback")

    # FALLBACK: Table missing or corrupt (RFC-018: updated path)
    qfiles_dir = project_path / PHASE6_ASSESSMENT

    if qfiles_dir.exists():
        logger.debug(f"Trying Q-file parser for {student_id}")
        qfile_data = parse_all_qfiles_for_student(qfiles_dir, student_id)

        if qfile_data and qfile_data["total_points"] >= 0:
            logger.info(f"Q-file parser succeeded for {student_id}")
            return qfile_data

    # Both strategies failed
    raise ValueError(
        f"Could not parse data for student {student_id}. "
        f"Tried: (1) summary table in {report_path}, "
        f"(2) Q-files in {qfiles_dir}"
    )


def parse_all_students_hybrid(
    project_path: Path,
    student_ids: Optional[List[str]] = None
) -> Tuple[List[Dict], Dict[str, int]]:
    """
    Parse all students using hybrid strategy.

    Args:
        project_path: Path to assessment project root
        student_ids: Optional list of student IDs (default: discover from files)

    Returns:
        Tuple of (results, stats):
        - results: List of student quantitative data
        - stats: {"table": N, "qfiles": M, "failed": K}
    """
    project_path = Path(project_path)

    # Discover students if not provided
    if not student_ids:
        student_ids = discover_students(project_path)

    if not student_ids:
        logger.warning("No students found to process")
        return [], {"table": 0, "qfiles": 0, "failed": 0}

    logger.info(f"Processing {len(student_ids)} students with hybrid strategy")

    results = []
    stats = {"table": 0, "qfiles": 0, "failed": 0}

    for student_id in student_ids:
        try:
            data = parse_student_hybrid(project_path, student_id)
            results.append(data)

            # Track which strategy was used
            stats[data["source"]] += 1

        except ValueError as e:
            logger.error(f"Failed to parse student {student_id}: {e}")
            stats["failed"] += 1

    logger.info(
        f"Hybrid parsing complete: "
        f"{stats['table']} table, {stats['qfiles']} qfiles, {stats['failed']} failed"
    )

    return results, stats


def discover_students(project_path: Path) -> List[str]:
    """
    Discover student IDs from project files.

    RFC-018 paths:
    1. Student reports (07_analytic_student/)
    2. Q-files (06_analytic_assessment/)

    Args:
        project_path: Path to assessment project root

    Returns:
        List of unique student IDs
    """
    project_path = Path(project_path)
    students = set()

    # Try student reports first (RFC-018: updated path)
    reports = find_student_reports(project_path)
    for report in reports:
        # RFC-018: Extract from filename: Analytic_<id>.md
        student_id = report.stem.replace('Analytic_', '')
        students.add(student_id)

    if students:
        logger.debug(f"Discovered {len(students)} students from reports")
        return sorted(students)

    # Fallback: Try Q-files (RFC-018: updated path)
    qfiles_dir = project_path / PHASE6_ASSESSMENT
    if qfiles_dir.exists():
        qfile_students = find_all_students_in_qfiles(qfiles_dir)
        students.update(qfile_students)

    logger.debug(f"Discovered {len(students)} students total")
    return sorted(students)
