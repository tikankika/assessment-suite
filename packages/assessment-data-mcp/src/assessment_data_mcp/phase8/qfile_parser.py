"""
Q-File Parser for Phase 8 Quantitative Analysis.

FALLBACK parsing strategy: Parse directly from Q-files (source of truth).
Used when table parsing fails or student reports are missing.

Q-files contain assessments in this format:
    ## Elev <id> (145 ord)
    ...
    ### BEDÖMNING:
    **BEDÖMNING: 2/2p** ...

RFC-017: Phase 8 Parser Fix - Hybrid Approach
"""

from __future__ import annotations

import re
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from ..constants.patterns import PHASE6_V2_METADATA, PHASE6_LEGACY_METADATA
from .aggregator import aggregate_question_data

logger = logging.getLogger(__name__)


def find_assessed_qfiles(qfiles_dir: Path) -> List[Path]:
    """
    Find Q-files that have been assessed (contain assessments).

    Assessed Q-files have a date in their filename:
    - Q001a_alla_elever_2026-01-06_LastName.md (assessed)
    - Q001a_alla_elever.md (not assessed)

    Args:
        qfiles_dir: Path to 06_analytic_assessment directory (RFC-018)

    Returns:
        List of paths to assessed Q-files
    """
    qfiles_dir = Path(qfiles_dir)

    if not qfiles_dir.exists():
        logger.warning(f"Q-files directory not found: {qfiles_dir}")
        return []

    # Find Q-files with date pattern (assessed files)
    # Pattern: Q###_alla_elever_YYYY-MM-DD_*.md
    all_qfiles = list(qfiles_dir.glob("Q*_alla_elever_*.md"))

    # Filter to only assessed files (with date)
    date_pattern = re.compile(r'_\d{4}-\d{2}-\d{2}_')
    assessed = [f for f in all_qfiles if date_pattern.search(f.name)]

    # Get unique question IDs (prefer most recent if multiple dates)
    qfile_by_question = {}
    for qfile in assessed:
        # Extract question ID: Q001a from Q001a_alla_elever_2026-01-06_...
        match = re.match(r'(Q\d+[a-zA-Z]?)_', qfile.name)
        if match:
            q_id = match.group(1).upper()
            # Keep the most recent (sorted by name, which includes date)
            if q_id not in qfile_by_question or qfile.name > qfile_by_question[q_id].name:
                qfile_by_question[q_id] = qfile

    result = sorted(qfile_by_question.values(), key=lambda p: p.name)
    logger.debug(f"Found {len(result)} assessed Q-files in {qfiles_dir}")

    return result


def find_student_section(content: str, student_id: str) -> Optional[str]:
    """
    Find a student's section within a Q-file.

    Sections are delimited by:
    - Start: ## Elev {student_id}
    - End: ## Elev (next student) or end of file

    Args:
        content: Full Q-file content
        student_id: Student ID to find

    Returns:
        The student's section text, or None if not found
    """
    # Pattern to find student header: ## Elev <id>
    # Escape student_id in case it has special regex chars
    escaped_id = re.escape(student_id)
    pattern = rf'^## Elev {escaped_id}.*?(?=^## Elev |\Z)'

    match = re.search(pattern, content, re.MULTILINE | re.DOTALL)

    if match:
        return match.group(0)
    return None


def extract_bedömning(section_text: str) -> Tuple[float, float]:
    """
    Extract points from a student's section.

    Tries multiple patterns (priority order):
    1. PHASE6_ASSESSMENT v2 metadata (format_version: 2)
    2. PHASE6_ASSESSMENT legacy metadata (no format_version)
    3. **BEDÖMNING: X/Yp** (bold-text format)
    4. **TOTAL: X/Yp** (older bold-text format)

    Args:
        section_text: Student's section from Q-file

    Returns:
        Tuple of (earned_points, max_points), or (0.0, 0.0) if not found
    """
    # Pattern 1: PHASE6_ASSESSMENT v2 metadata (with format_version: 2)
    # Uses shared pattern from constants.patterns (RFC-029 §3.5)
    # Groups: 1=student_id, 2=total_points, 3=max_points, 4=assessed_by, 5=assessed_at
    match = PHASE6_V2_METADATA.search(section_text)
    if match:
        total_str = match.group(2)
        max_str = match.group(3)
        if total_str != 'null' and max_str != 'null':
            return (float(total_str.replace(',', '.')), float(max_str.replace(',', '.')))

    # Pattern 2: PHASE6_ASSESSMENT legacy metadata (without format_version)
    # Uses shared pattern from constants.patterns (RFC-029 §3.5)
    # Groups: 1=student_id, 2=total_points, 3=max_points
    match = PHASE6_LEGACY_METADATA.search(section_text)
    if match:
        earned = float(match.group(2).replace(',', '.'))
        max_pts = float(match.group(3).replace(',', '.').rstrip('?'))
        return (earned, max_pts)

    # Pattern 3: **BEDÖMNING: X/Yp** or **BEDÖMNING: X,X/Y,Yp** (comma decimals)
    bedömning_pattern = r'\*\*BEDÖMNING:\s*([\d.,]+)/([\d.,]+)p\*\*'
    match = re.search(bedömning_pattern, section_text, re.IGNORECASE)

    if match:
        earned = float(match.group(1).replace(',', '.'))
        max_pts = float(match.group(2).replace(',', '.'))
        return (earned, max_pts)

    # Pattern 4: **TOTAL: X/Yp** (older format)
    total_pattern = r'\*\*TOTAL:\s*([\d.,]+)/([\d.,]+)p\*\*'
    match = re.search(total_pattern, section_text, re.IGNORECASE)

    if match:
        earned = float(match.group(1).replace(',', '.'))
        max_pts = float(match.group(2).replace(',', '.'))
        return (earned, max_pts)

    # Not found
    return (0.0, 0.0)


def parse_qfile_for_student(qfile_path: Path, student_id: str) -> Optional[Dict]:
    """
    Parse a single Q-file for a specific student.

    Args:
        qfile_path: Path to assessed Q-file
        student_id: Student ID to extract

    Returns:
        Dictionary with question data, or None if student not found:
        {
            "question_id": "Q001A",
            "points": 2.0,
            "max": 2.0
        }
    """
    try:
        content = qfile_path.read_text(encoding='utf-8')

        # Extract question ID from filename
        match = re.match(r'(Q\d+[a-zA-Z]?)_', qfile_path.name)
        if not match:
            logger.warning(f"Cannot extract question ID from {qfile_path.name}")
            return None

        question_id = match.group(1).upper()

        # Find student section
        section = find_student_section(content, student_id)
        if not section:
            logger.debug(f"Student {student_id} not found in {qfile_path.name}")
            return None

        # Extract points
        earned, max_pts = extract_bedömning(section)

        if max_pts == 0.0:
            # Distinguish "no assessment present" (a legitimate skip) from
            # "an assessment is present but in an unrecognised format" (a real
            # problem that must be surfaced, not silently dropped).
            assessment_marker = re.compile(
                r'###\s*(?:BEDÖMNING|ANALYTIC ASSESSMENT)|\*\*(?:BEDÖMNING|TOTAL):|PHASE6_ASSESSMENT',
                re.IGNORECASE,
            )
            if assessment_marker.search(section):
                logger.warning(
                    f"Unrecognised assessment format for {student_id} in "
                    f"{qfile_path.name}: an assessment is present but no points "
                    f"could be parsed — student EXCLUDED from quantitative totals."
                )
            else:
                logger.debug(f"No assessment present for {student_id} in {qfile_path.name}")
            return None

        return {
            "question_id": question_id,
            "points": earned,
            "max": max_pts
        }

    except Exception as e:
        logger.warning(f"Error parsing {qfile_path.name} for {student_id}: {e}")
        return None


def parse_all_qfiles_for_student(qfiles_dir: Path, student_id: str) -> Optional[Dict]:
    """
    Parse all Q-files and aggregate data for one student.

    This is the FALLBACK parsing strategy.

    Args:
        qfiles_dir: Path to 06_analytic_assessment directory (RFC-018)
        student_id: Student ID to process

    Returns:
        Dictionary with aggregated quantitative data, or None if failed:
        {
            "student_id": "<id>",
            "total_points": 36.0,
            "max_points": 40.0,
            "percentage": 90.0,
            "questions": {"Q001A": {"points": 2.0, "max": 2.0}, ...},
            "questions_answered": 14,
            "source": "qfiles"
        }
    """
    qfiles_dir = Path(qfiles_dir)

    # Find assessed Q-files
    qfiles = find_assessed_qfiles(qfiles_dir)

    if not qfiles:
        logger.warning(f"No assessed Q-files found in {qfiles_dir}")
        return None

    logger.debug(f"Parsing {len(qfiles)} Q-files for student {student_id}")

    # RFC-029 §20 Q4: Use shared aggregation
    items = []
    for qfile in qfiles:
        result = parse_qfile_for_student(qfile, student_id)
        if result:
            items.append((result["question_id"], result["points"], result["max"]))

    if not items:
        logger.warning(f"No question data found for student {student_id}")
        return None

    aggregated = aggregate_question_data(student_id, items, source="qfiles")

    if aggregated:
        logger.info(
            f"Q-files parsed: {student_id} = "
            f"{aggregated['total_points']}/{aggregated['max_points']}p ({aggregated['percentage']}%)"
        )

    return aggregated


def find_all_students_in_qfiles(qfiles_dir: Path) -> List[str]:
    """
    Find all student IDs that appear in Q-files.

    Args:
        qfiles_dir: Path to 06_analytic_assessment directory (RFC-018)

    Returns:
        List of unique student IDs
    """
    qfiles_dir = Path(qfiles_dir)
    qfiles = find_assessed_qfiles(qfiles_dir)

    if not qfiles:
        return []

    # Union students across ALL assessed Q-files. A question that part of the
    # cohort did not answer has those `## Elev` blocks pruned from that Q-file,
    # so trusting a single Q-file would silently drop those students.
    students = []
    for qfile in qfiles:
        content = qfile.read_text(encoding='utf-8')
        # Find all student headers: ## Elev <id>
        matches = re.findall(r'^## Elev (\S+)', content, re.MULTILINE)
        for match in matches:
            # Take only the student ID part (before any space or paren)
            student_id = match.split()[0].rstrip('(')
            students.append(student_id)

    unique_students = sorted(set(students))
    logger.debug(f"Found {len(unique_students)} students in Q-files")

    return unique_students
