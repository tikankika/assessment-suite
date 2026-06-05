"""
Calculator for Phase 8 quantitative summary.

This module calculates totals, distributions, and category breakdowns
from parsed student reports.

Rounding precision (RFC-029 §20 Q5 — intentional, not inconsistent):
- Points values: 2 decimals (scoring precision)
- Percentages in tables/parsers: 1 decimal (Swedish educational standard)
- Distribution percentages: 0 decimals (count-based, fewer sig. figures)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

from .parser import ParsedReport, AspectAssessment


@dataclass
class Totals:
    """Total points summary."""
    earned: float
    maximum: float
    total_questions: int


def calculate_totals(parsed: ParsedReport) -> Totals:
    """
    Calculate total points across all questions.

    Args:
        parsed: ParsedReport from parser

    Returns:
        Totals dataclass with earned, maximum, and question count
    """
    total_earned = sum(q.total_points for q in parsed.questions)
    total_max = sum(q.max_points for q in parsed.questions)

    return Totals(
        earned=round(total_earned, 2),
        maximum=round(total_max, 2),
        total_questions=len(parsed.questions)
    )


def calculate_aspect_distribution(parsed: ParsedReport) -> Dict[str, Dict[str, int]]:
    """
    Calculate distribution of aspect assessments.

    Args:
        parsed: ParsedReport from parser

    Returns:
        Dict with counts and percentages for excellent/partial/missing:
        {
            "excellent": {"count": 14, "percentage": 52},
            "partial": {"count": 9, "percentage": 33},
            "missing": {"count": 4, "percentage": 15}
        }
    """
    # Collect all aspects
    all_aspects: List[AspectAssessment] = []
    for question in parsed.questions:
        all_aspects.extend(question.aspects)

    # Count by assessment level
    counts = {
        "excellent": 0,
        "partial": 0,
        "missing": 0,
    }

    for aspect in all_aspects:
        if aspect.assessment in counts:
            counts[aspect.assessment] += 1
        # Unknown assessments are ignored for distribution

    total = sum(counts.values())

    # Calculate percentages
    result = {}
    for level, count in counts.items():
        percentage = round((count / total) * 100) if total > 0 else 0
        result[level] = {
            "count": count,
            "percentage": percentage
        }

    return result


def calculate_points_by_category(parsed: ParsedReport) -> Dict[str, Dict[str, float]]:
    """
    Calculate points by question category.

    Categories determined by max_points:
    - 0-2p → "1p" category (small questions)
    - 2.1-4p → "3p" category (medium questions)
    - 4.1p+ → "4p" category (large questions)

    Args:
        parsed: ParsedReport from parser

    Returns:
        Dict with earned/max for each category:
        {
            "1p": {"earned": 1.5, "max": 2.0},
            "4p": {"earned": 15.0, "max": 24.0}
        }
    """
    categories: Dict[str, Dict[str, float]] = {}

    for question in parsed.questions:
        # Determine category based on max points
        if question.max_points <= 2.0:
            category = "1p"
        elif question.max_points <= 4.0:
            category = "3p"
        else:
            category = "4p"

        # Initialize category if needed
        if category not in categories:
            categories[category] = {"earned": 0.0, "max": 0.0}

        # Add to category
        categories[category]["earned"] += question.total_points
        categories[category]["max"] += question.max_points

    # Round values
    for cat in categories.values():
        cat["earned"] = round(cat["earned"], 2)
        cat["max"] = round(cat["max"], 2)

    return categories
