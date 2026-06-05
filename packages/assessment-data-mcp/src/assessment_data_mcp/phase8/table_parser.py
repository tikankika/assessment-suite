"""
Table Parser for Phase 8 Quantitative Analysis.

PRIMARY parsing strategy: Parse summary tables from Phase 7 student reports.
These tables are simple, consistent, and contain all quantitative data needed.

RFC-018 paths:
Example input (from 07_analytic_student/Analytic_<id>.md):
    ### Poäng per fråga

    | Fråga | Poäng | Max | Procent |
    |-------|-------|-----|---------|
    | Q001A | 2.0 | 2.0 | 100% |
    | Q001B | 2.0 | 2.0 | 100% |
    ...

RFC-017: Phase 8 Parser Fix - Hybrid Approach
"""

from __future__ import annotations

import re
import logging
from pathlib import Path
from typing import Dict, Optional

from ..constants.folders import PHASE7_STUDENT
from .aggregator import aggregate_question_data

logger = logging.getLogger(__name__)


def parse_summary_table(report_path: Path) -> Optional[Dict]:
    """
    Parse summary table from student report.

    This is the PRIMARY parsing strategy (~20 LOC).

    Args:
        report_path: Path to student report markdown file

    Returns:
        Dictionary with quantitative data, or None if table not found/parseable:
        {
            "student_id": "<id>",
            "total_points": 36.0,
            "max_points": 40.0,
            "percentage": 90.0,
            "questions": {"Q001A": {"points": 2.0, "max": 2.0}, ...},
            "questions_answered": 14,
            "source": "table"
        }
    """
    try:
        report_path = Path(report_path)

        if not report_path.exists():
            logger.debug(f"Report not found: {report_path}")
            return None

        content = report_path.read_text(encoding='utf-8')

        # RFC-018: Extract student ID from filename: Analytic_<id>.md
        student_id = report_path.stem.replace('Analytic_', '')
        logger.debug(f"Parsing table for student: {student_id}")

        # Anchor parsing to the "Poäng per fråga" section so that unrelated
        # Q### tables elsewhere in the report (e.g. per-aspect breakdowns under
        # "Detaljerade bedömningar") are not harvested into the totals.
        section_match = re.search(
            r'###\s*Poäng per fråga\b(.*?)(?=\n##\s|\n---|\Z)',
            content,
            re.DOTALL,
        )
        if section_match is not None:
            search_text = section_match.group(1)
        else:
            # Legacy reports without the header: fall back to whole content.
            logger.debug(f"No 'Poäng per fråga' section in {report_path}; scanning whole file")
            search_text = content

        # Find table rows: | Q001A | 2.0 | 2.0 | 100% |
        # Pattern matches: question_id | points | max | percentage
        # Accepts Swedish comma decimals (2,5) as well as dot decimals.
        pattern = r'\|\s*(Q\d+[A-Za-z]*)\s*\|\s*([\d.,]+)\s*\|\s*([\d.,]+)\s*\|'
        matches = re.findall(pattern, search_text)

        if not matches:
            logger.debug(f"No table rows found in {report_path}")
            return None

        # RFC-029 §20 Q4: Use shared aggregation.
        # Parse rows individually so one malformed cell skips only that row
        # rather than dropping the whole student.
        items = []
        for question_id, earned_str, max_str in matches:
            try:
                earned = float(earned_str.replace(',', '.'))
                max_pts = float(max_str.replace(',', '.'))
            except ValueError:
                logger.warning(
                    f"Skipping malformed table row for {student_id} in "
                    f"{report_path.name}: {question_id} | {earned_str} | {max_str}"
                )
                continue
            items.append((question_id, earned, max_pts))

        if not items:
            logger.debug(f"No parseable table rows in {report_path}")
            return None

        result = aggregate_question_data(student_id, items, source="table")

        if result:
            logger.info(
                f"Table parsed: {student_id} = "
                f"{result['total_points']}/{result['max_points']}p ({result['percentage']}%)"
            )

        return result

    except Exception as e:
        logger.warning(f"Table parsing failed for {report_path}: {e}")
        return None


def find_student_reports(project_path: Path) -> list[Path]:
    """
    Find all student report files in project.

    RFC-018: Updated path and filename pattern.

    Args:
        project_path: Path to assessment project root

    Returns:
        List of paths to student report files
    """
    # RFC-018: Updated path
    reports_dir = Path(project_path) / PHASE7_STUDENT

    if not reports_dir.exists():
        logger.warning(f"Student reports directory not found: {reports_dir}")
        return []

    # RFC-018: Find all Analytic_*.md files
    reports = list(reports_dir.glob("Analytic_*.md"))
    logger.debug(f"Found {len(reports)} student reports in {reports_dir}")

    return sorted(reports)
