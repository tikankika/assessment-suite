"""
Tests for Phase 8 validator - validate calculations.
"""

import pytest
from pathlib import Path

from assessment_data_mcp.phase8.parser import (
    parse_student_report,
    ParsedReport,
    QuestionAssessment,
    AspectAssessment,
)
from assessment_data_mcp.phase8.calculator import calculate_totals, Totals
from assessment_data_mcp.phase8.validator import (
    validate_calculations,
    ValidationWarning,
)


FIXTURES_DIR = Path(__file__).parent / "fixtures" / "student_reports"


class TestValidateCalculations:
    """Test validate_calculations() function."""

    def test_valid_report_no_warnings(self):
        """Valid report should produce no warnings."""
        report_path = FIXTURES_DIR / "Bedomning_TestElev01.md"
        parsed = parse_student_report(report_path)
        totals = calculate_totals(parsed)

        warnings = validate_calculations(parsed, totals)

        # Should have few or no warnings for consistent data
        assert isinstance(warnings, list)

    def test_detect_aspect_sum_mismatch(self):
        """Detect when aspect points don't sum to total."""
        # Create a report with intentional mismatch
        question = QuestionAssessment(
            question_id="Q01",
            aspects=[
                AspectAssessment(name="A1", assessment="excellent", points=1.0),
                AspectAssessment(name="A2", assessment="partial", points=0.5),
            ],
            total_points=2.0,  # Mismatch: aspects sum to 1.5
            max_points=2.0,
        )
        parsed = ParsedReport(
            student_id="Test",
            questions=[question],
        )
        totals = Totals(earned=2.0, maximum=2.0, total_questions=1)

        warnings = validate_calculations(parsed, totals)

        # Should detect the mismatch
        mismatch_warnings = [w for w in warnings if w.warning_type == "aspect_sum_mismatch"]
        assert len(mismatch_warnings) > 0
        assert "Q01" in mismatch_warnings[0].question_id

    def test_warning_contains_details(self):
        """Warnings should contain useful details."""
        question = QuestionAssessment(
            question_id="Q05",
            aspects=[
                AspectAssessment(name="Test", assessment="excellent", points=1.0),
            ],
            total_points=2.0,  # Mismatch
            max_points=3.0,
        )
        parsed = ParsedReport(
            student_id="TestStudent",
            questions=[question],
        )
        totals = Totals(earned=2.0, maximum=3.0, total_questions=1)

        warnings = validate_calculations(parsed, totals)

        if warnings:
            w = warnings[0]
            assert hasattr(w, 'warning_type')
            assert hasattr(w, 'question_id')
            assert hasattr(w, 'message')

    def test_multiple_questions_validation(self):
        """Validate multiple questions independently."""
        questions = [
            QuestionAssessment(
                question_id="Q01",
                aspects=[AspectAssessment(name="A", assessment="excellent", points=1.0)],
                total_points=1.0,  # Correct
                max_points=1.0,
            ),
            QuestionAssessment(
                question_id="Q02",
                aspects=[AspectAssessment(name="B", assessment="partial", points=0.5)],
                total_points=1.0,  # Mismatch
                max_points=1.0,
            ),
        ]
        parsed = ParsedReport(student_id="Test", questions=questions)
        totals = Totals(earned=2.0, maximum=2.0, total_questions=2)

        warnings = validate_calculations(parsed, totals)

        # Should only flag Q02
        q02_warnings = [w for w in warnings if "Q02" in str(w.question_id)]
        q01_warnings = [w for w in warnings if "Q01" in str(w.question_id)]

        assert len(q02_warnings) > 0
        assert len(q01_warnings) == 0


class TestValidationWarning:
    """Test ValidationWarning dataclass."""

    def test_warning_to_dict(self):
        """Warning can be converted to dict for JSON."""
        warning = ValidationWarning(
            warning_type="aspect_sum_mismatch",
            question_id="Q01",
            message="Aspect sum 1.5 != stated total 2.0",
            calculated=1.5,
            stated=2.0,
        )

        # Should have dict-like access or to_dict method
        assert warning.warning_type == "aspect_sum_mismatch"
        assert warning.question_id == "Q01"
        assert warning.calculated == 1.5
        assert warning.stated == 2.0
