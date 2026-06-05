"""
Shared aggregation logic for Phase 8 parsers.

RFC-029 §20 Q4: Extracted from table_parser.py and qfile_parser.py
to eliminate duplication. Both parsers call aggregate_question_data()
instead of reimplementing the same loop.
"""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple


def aggregate_question_data(
    student_id: str,
    items: List[Tuple[str, float, float]],
    source: str,
) -> Optional[Dict]:
    """
    Aggregate question-level data into a student summary.

    Args:
        student_id: Student identifier
        items: List of (question_id, earned_points, max_points) tuples
        source: Data source identifier ("table" or "qfiles")

    Returns:
        Aggregated dict, or None if no items provided:
        {
            "student_id": str,
            "total_points": float,
            "max_points": float,
            "percentage": float,   # 1 decimal (RFC-029 §20 Q5)
            "questions": {q_id: {"points": float, "max": float}},
            "questions_answered": int,
            "source": str
        }
    """
    if not items:
        return None

    # De-duplicate by question id first (last entry wins), then derive the
    # totals from the de-duplicated breakdown so the per-question view and the
    # totals can never desync when a q_id appears more than once.
    questions: Dict[str, Dict[str, float]] = {}
    for q_id, earned, max_pts in items:
        questions[q_id] = {"points": earned, "max": max_pts}

    total_earned = sum(q["points"] for q in questions.values())
    total_max = sum(q["max"] for q in questions.values())

    percentage = round((total_earned / total_max * 100), 1) if total_max > 0 else 0.0

    return {
        "student_id": student_id,
        "total_points": total_earned,
        "max_points": total_max,
        "percentage": percentage,
        "questions": questions,
        "questions_answered": len(questions),
        "source": source,
    }
