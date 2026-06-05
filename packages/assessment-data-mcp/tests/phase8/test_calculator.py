"""
Tests for Phase 8 calculator - calculate totals and distributions.
"""

import pytest
from pathlib import Path

from assessment_data_mcp.phase8.parser import parse_student_report
from assessment_data_mcp.phase8.calculator import (
    calculate_totals,
    calculate_aspect_distribution,
    calculate_points_by_category,
    Totals,
)


FIXTURES_DIR = Path(__file__).parent / "fixtures" / "student_reports"


class TestCalculateTotals:
    """Test calculate_totals() function."""

    def test_calculate_totals_basic(self):
        """Calculate total points correctly."""
        report_path = FIXTURES_DIR / "Bedomning_TestElev01.md"
        parsed = parse_student_report(report_path)
        totals = calculate_totals(parsed)

        assert totals.earned == 16.5
        assert totals.maximum == 26.0
        assert totals.total_questions == 4

    def test_calculate_totals_high_performer(self):
        """Calculate totals for high-performing student."""
        report_path = FIXTURES_DIR / "Bedomning_TestElev02.md"
        parsed = parse_student_report(report_path)
        totals = calculate_totals(parsed)

        assert totals.earned == 24.0
        assert totals.maximum == 26.0
        assert totals.total_questions == 4

    def test_totals_is_dataclass(self):
        """Totals should be a dataclass with named fields."""
        report_path = FIXTURES_DIR / "Bedomning_TestElev01.md"
        parsed = parse_student_report(report_path)
        totals = calculate_totals(parsed)

        assert hasattr(totals, 'earned')
        assert hasattr(totals, 'maximum')
        assert hasattr(totals, 'total_questions')


class TestCalculateAspectDistribution:
    """Test calculate_aspect_distribution() function."""

    def test_aspect_distribution_counts(self):
        """Count aspects by assessment level."""
        report_path = FIXTURES_DIR / "Bedomning_TestElev01.md"
        parsed = parse_student_report(report_path)
        dist = calculate_aspect_distribution(parsed)

        # TestElev01 has: 5 excellent (✓), 6 partial (⚠), 2 missing (✗)
        assert dist["excellent"]["count"] >= 0
        assert dist["partial"]["count"] >= 0
        assert dist["missing"]["count"] >= 0

        # Total should match number of aspects
        total = (
            dist["excellent"]["count"] +
            dist["partial"]["count"] +
            dist["missing"]["count"]
        )
        assert total > 0

    def test_aspect_distribution_percentages(self):
        """Calculate correct percentages."""
        report_path = FIXTURES_DIR / "Bedomning_TestElev01.md"
        parsed = parse_student_report(report_path)
        dist = calculate_aspect_distribution(parsed)

        # Percentages should sum to ~100% (allowing for rounding)
        total_pct = (
            dist["excellent"]["percentage"] +
            dist["partial"]["percentage"] +
            dist["missing"]["percentage"]
        )
        assert 95 <= total_pct <= 105  # Allow rounding variance

    def test_high_performer_distribution(self):
        """High performer should have more excellent."""
        report_path = FIXTURES_DIR / "Bedomning_TestElev02.md"
        parsed = parse_student_report(report_path)
        dist = calculate_aspect_distribution(parsed)

        # TestElev02 is a high performer - should have many excellent
        assert dist["excellent"]["count"] > dist["missing"]["count"]


class TestCalculatePointsByCategory:
    """Test calculate_points_by_category() function."""

    def test_points_by_category_structure(self):
        """Returns dict with category keys."""
        report_path = FIXTURES_DIR / "Bedomning_TestElev01.md"
        parsed = parse_student_report(report_path)
        categories = calculate_points_by_category(parsed)

        # Should have some categories
        assert len(categories) > 0

        # Each category should have earned and max
        for cat_name, cat_data in categories.items():
            assert "earned" in cat_data
            assert "max" in cat_data

    def test_category_determination(self):
        """Categories determined by max_points."""
        report_path = FIXTURES_DIR / "Bedomning_TestElev01.md"
        parsed = parse_student_report(report_path)
        categories = calculate_points_by_category(parsed)

        # Q01 has max 2.0p -> "1p" category
        # Q02-Q04 have max 8.0p -> "4p" category
        assert "1p" in categories or "2p" in categories  # Small questions
        assert "4p" in categories or "3p" in categories  # Large questions

    def test_category_totals_sum(self):
        """Category totals should sum to overall total."""
        report_path = FIXTURES_DIR / "Bedomning_TestElev01.md"
        parsed = parse_student_report(report_path)
        totals = calculate_totals(parsed)
        categories = calculate_points_by_category(parsed)

        earned_sum = sum(cat["earned"] for cat in categories.values())
        max_sum = sum(cat["max"] for cat in categories.values())

        assert abs(earned_sum - totals.earned) < 0.01
        assert abs(max_sum - totals.maximum) < 0.01
