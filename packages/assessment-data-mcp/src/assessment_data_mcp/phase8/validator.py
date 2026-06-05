"""
Validator for Phase 8 quantitative calculations.

This module validates that calculated totals match stated totals,
and flags any inconsistencies for teacher review.

Design principle: Warn on inconsistencies, never auto-fix.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import List, Optional

from .parser import ParsedReport
from .calculator import Totals


@dataclass
class ValidationWarning:
    """Warning about calculation inconsistency."""
    warning_type: str  # "aspect_sum_mismatch" | "overall_total_mismatch"
    question_id: Optional[str]
    message: str
    calculated: Optional[float] = None
    stated: Optional[float] = None
    difference: Optional[float] = None

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {k: v for k, v in asdict(self).items() if v is not None}


def validate_calculations(
    parsed: ParsedReport,
    totals: Totals,
    tolerance: float = 0.01
) -> List[ValidationWarning]:
    """
    Validate calculated totals against stated totals.

    Checks:
    1. Each question's aspect points sum to stated total
    2. Overall calculated total matches Totals

    Args:
        parsed: ParsedReport from parser
        totals: Totals from calculator
        tolerance: Acceptable difference for floating point comparison

    Returns:
        List of ValidationWarning (empty if all valid)
    """
    warnings: List[ValidationWarning] = []

    # Validate each question's aspect sum
    for question in parsed.questions:
        aspect_sum = sum(a.points for a in question.aspects)

        if abs(aspect_sum - question.total_points) > tolerance:
            warnings.append(ValidationWarning(
                warning_type="aspect_sum_mismatch",
                question_id=question.question_id,
                message=f"Aspect sum {aspect_sum:.2f} != stated total {question.total_points:.2f}",
                calculated=round(aspect_sum, 2),
                stated=question.total_points,
                difference=round(aspect_sum - question.total_points, 2)
            ))

    # Validate overall total
    calculated_total = sum(q.total_points for q in parsed.questions)
    if abs(calculated_total - totals.earned) > tolerance:
        warnings.append(ValidationWarning(
            warning_type="overall_total_mismatch",
            question_id=None,
            message=f"Question sum {calculated_total:.2f} != calculated total {totals.earned:.2f}",
            calculated=round(calculated_total, 2),
            stated=totals.earned,
            difference=round(calculated_total - totals.earned, 2)
        ))

    return warnings
