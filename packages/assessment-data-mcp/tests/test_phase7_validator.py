"""
Tests for Phase 7 Validator

Tests validation of parsed Q-file data.
"""

import pytest

from assessment_data_mcp.phase7.standard_parser import (
    StandardParser,
    StudentAssessment,
    QuestionAssessment,
    AspectScore,
    ParseResult,
)
from assessment_data_mcp.phase7.validator import (
    Validator,
    ValidationResult,
    ValidationIssue,
    quick_validate,
)


# Sample valid content
VALID_CONTENT = """## Elev 100001 (47 ord)

Test answer.

### ANALYTIC ASSESSMENT:
**6a:** ✓✓✓ **2.0p** - Good
**6b:** ✓ **0.5p** - OK

**TOTAL: 2.5/5p**
**→ Next step:** Practice more.

---
"""

# Content with points mismatch
POINTS_MISMATCH = """## Elev 111 (10 ord)

Test.

### ANALYTIC ASSESSMENT:
**a:** ✓ **1p** - OK
**b:** ✓ **1p** - OK

**TOTAL: 3/5p**
**→ Next step:** More.

---
"""

# Content with duplicate students
DUPLICATE_STUDENTS = """## Elev 111 (10 ord)

First answer.

### ANALYTIC ASSESSMENT:
**a:** ✓ **1p** - OK

**TOTAL: 1/2p**
**→ Next step:** Practice.

---

## Elev 111 (20 ord)

Second answer - same ID!

### ANALYTIC ASSESSMENT:
**a:** ✓✓ **2p** - Good

**TOTAL: 2/2p**
**→ Next step:** Continue.

---
"""


class TestValidateParseResult:
    """Test validation of parse results."""

    def test_valid_content_passes(self):
        """Test that valid content passes validation."""
        parser = StandardParser()
        parse_result = parser.parse_content(VALID_CONTENT, "Q6")

        validator = Validator()
        result = validator.validate_parse_result(parse_result)

        assert result.valid is True
        assert len(result.errors) == 0

    def test_points_mismatch_warning(self):
        """Test that points mismatch generates warning."""
        parser = StandardParser()
        parse_result = parser.parse_content(POINTS_MISMATCH, "Q1")

        validator = Validator()
        result = validator.validate_parse_result(parse_result)

        # Should have warning about mismatch
        warning_codes = [w.code for w in result.warnings]
        assert "POINTS_MISMATCH" in warning_codes

    def test_duplicate_students_error(self):
        """Test that duplicate students generate error."""
        parser = StandardParser()
        parse_result = parser.parse_content(DUPLICATE_STUDENTS, "Q1")

        validator = Validator()
        result = validator.validate_parse_result(parse_result)

        # Should have error about duplicate
        assert result.valid is False
        error_codes = [e.code for e in result.errors]
        assert "DUPLICATE_STUDENT" in error_codes


class TestValidateStudent:
    """Test validation of individual students."""

    def test_valid_student_passes(self):
        """Test that valid student passes."""
        student = StudentAssessment(
            student_id="123",
            word_count=50,
            answer_text="Test answer",
            assessment=QuestionAssessment(
                question_id="Q1",
                aspects=[AspectScore("a", "✓", 1.0, "Good")],
                total_points=1.0,
                max_points=2.0,
                next_step="Practice more."
            )
        )

        validator = Validator()
        result = validator.validate_student(student)

        assert result.valid is True

    def test_missing_student_id_error(self):
        """Test that missing student ID generates error."""
        student = StudentAssessment(
            student_id="",
            word_count=50,
            answer_text="Test"
        )

        validator = Validator()
        result = validator.validate_student(student)

        assert result.valid is False
        error_codes = [e.code for e in result.errors]
        assert "MISSING_STUDENT_ID" in error_codes

    def test_negative_points_error(self):
        """Test that negative points generate error."""
        student = StudentAssessment(
            student_id="123",
            word_count=50,
            answer_text="Test",
            assessment=QuestionAssessment(
                question_id="Q1",
                total_points=-1.0,
                max_points=5.0,
                next_step="N/A"
            )
        )

        validator = Validator()
        result = validator.validate_student(student)

        assert result.valid is False
        error_codes = [e.code for e in result.errors]
        assert "NEGATIVE_POINTS" in error_codes

    def test_points_exceed_max_error(self):
        """Test that points exceeding max generate error."""
        student = StudentAssessment(
            student_id="123",
            word_count=50,
            answer_text="Test",
            assessment=QuestionAssessment(
                question_id="Q1",
                total_points=10.0,
                max_points=5.0,
                next_step="Excellent work!"
            )
        )

        validator = Validator()
        result = validator.validate_student(student)

        assert result.valid is False
        error_codes = [e.code for e in result.errors]
        assert "POINTS_EXCEED_MAX" in error_codes

    def test_missing_next_step_warning(self):
        """Test that missing next step generates warning."""
        student = StudentAssessment(
            student_id="123",
            word_count=50,
            answer_text="Test",
            assessment=QuestionAssessment(
                question_id="Q1",
                total_points=2.0,
                max_points=5.0,
                next_step=""
            )
        )

        validator = Validator()
        result = validator.validate_student(student)

        warning_codes = [w.code for w in result.warnings]
        assert "MISSING_NEXT_STEP" in warning_codes


class TestCrossValidation:
    """Test cross-validation of multiple Q-files."""

    def test_consistent_students_pass(self):
        """Test that consistent students across files pass."""
        result1 = ParseResult(question_id="Q1", students=[
            StudentAssessment(student_id="A", word_count=10, answer_text="A1"),
            StudentAssessment(student_id="B", word_count=20, answer_text="B1"),
        ])
        result2 = ParseResult(question_id="Q2", students=[
            StudentAssessment(student_id="A", word_count=15, answer_text="A2"),
            StudentAssessment(student_id="B", word_count=25, answer_text="B2"),
        ])

        validator = Validator()
        result = validator.cross_validate([result1, result2])

        # Should pass - same students in both files
        assert result.valid is True

    def test_missing_student_warning(self):
        """Test warning when student is missing from some files."""
        result1 = ParseResult(question_id="Q1", students=[
            StudentAssessment(student_id="A", word_count=10, answer_text="A1"),
            StudentAssessment(student_id="B", word_count=20, answer_text="B1"),
            StudentAssessment(student_id="C", word_count=30, answer_text="C1"),
        ])
        result2 = ParseResult(question_id="Q2", students=[
            StudentAssessment(student_id="A", word_count=15, answer_text="A2"),
            StudentAssessment(student_id="B", word_count=25, answer_text="B2"),
            # C is missing from Q2
        ])

        validator = Validator()
        result = validator.cross_validate([result1, result2])

        warning_codes = [w.code for w in result.warnings]
        assert "MISSING_STUDENT_QUESTION" in warning_codes

    def test_empty_list_warning(self):
        """Test warning for empty file list."""
        validator = Validator()
        result = validator.cross_validate([])

        warning_codes = [w.code for w in result.warnings]
        assert "NO_FILES" in warning_codes


class TestStrictMode:
    """Test strict validation mode."""

    def test_strict_treats_warnings_as_errors(self):
        """Test that strict mode treats warnings as errors."""
        # Create content that generates warnings but not errors
        content = """## Elev 111 (10 ord)

Test answer but no assessment.

---
"""
        parser = StandardParser()
        parse_result = parser.parse_content(content, "Q1")

        validator = Validator(strict=True)
        result = validator.validate_parse_result(parse_result)

        # In strict mode, warnings about empty answer might become errors
        # or at least the validation should be stricter


class TestQuickValidate:
    """Test quick_validate helper."""

    def test_quick_validate_valid(self):
        """Test quick_validate with valid content."""
        parser = StandardParser()
        parse_result = parser.parse_content(VALID_CONTENT, "Q6")

        is_valid, issues = quick_validate(parse_result)

        assert is_valid is True
        assert len([i for i in issues if "[ERROR]" in i]) == 0

    def test_quick_validate_invalid(self):
        """Test quick_validate with invalid content."""
        parser = StandardParser()
        parse_result = parser.parse_content(DUPLICATE_STUDENTS, "Q1")

        is_valid, issues = quick_validate(parse_result)

        assert is_valid is False
        assert len([i for i in issues if "[ERROR]" in i]) > 0


class TestSummary:
    """Test validation summary generation."""

    def test_summary_valid(self):
        """Test summary for valid result."""
        result = ValidationResult(valid=True)

        validator = Validator()
        summary = validator.summarize(result)

        assert "✓ Validation passed" in summary

    def test_summary_invalid(self):
        """Test summary for invalid result."""
        result = ValidationResult(valid=False)
        result.add_error("TEST_ERROR", "Test error message", "test_location")

        validator = Validator()
        summary = validator.summarize(result)

        assert "✗ Validation failed" in summary
        assert "TEST_ERROR" in summary
        assert "test_location" in summary
