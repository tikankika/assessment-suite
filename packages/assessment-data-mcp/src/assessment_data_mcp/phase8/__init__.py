"""
Phase 8: Quantitative Summary

Generate quantitative JSON summaries using HYBRID parsing strategy.

RFC-018 DUAL OUTPUT:
PRIMARY: Parse summary table from student reports (07_analytic_student/)
FALLBACK: Parse Q-files directly (06_analytic_assessment/)

RFC-017: Phase 8 Parser Fix - Hybrid Approach
"""

# Hybrid parser (recommended)
from .hybrid_parser import (
    parse_student_hybrid,
    parse_all_students_hybrid,
    discover_students,
)

# Table parser (primary strategy)
from .table_parser import (
    parse_summary_table,
    find_student_reports,
)

# Q-file parser (fallback strategy)
from .qfile_parser import (
    parse_all_qfiles_for_student,
    find_assessed_qfiles,
    find_all_students_in_qfiles,
)

# Legacy parser (deprecated, kept for backwards compatibility)
from .parser import (
    parse_student_report,
    parse_question,
    ParsedReport,
    QuestionAssessment,
    AspectAssessment,
    ParseError,
)

from .calculator import (
    calculate_totals,
    calculate_aspect_distribution,
    calculate_points_by_category,
    Totals,
)

from .validator import (
    validate_calculations,
    ValidationWarning,
)

__all__ = [
    # Hybrid Parser (RFC-017)
    "parse_student_hybrid",
    "parse_all_students_hybrid",
    "discover_students",
    # Table Parser (primary)
    "parse_summary_table",
    "find_student_reports",
    # Q-file Parser (fallback)
    "parse_all_qfiles_for_student",
    "find_assessed_qfiles",
    "find_all_students_in_qfiles",
    # Legacy Parser (deprecated)
    "parse_student_report",
    "parse_question",
    "ParsedReport",
    "QuestionAssessment",
    "AspectAssessment",
    "ParseError",
    # Calculator
    "calculate_totals",
    "calculate_aspect_distribution",
    "calculate_points_by_category",
    "Totals",
    # Validator
    "validate_calculations",
    "ValidationWarning",
]
