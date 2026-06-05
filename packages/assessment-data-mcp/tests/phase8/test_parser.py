"""
Tests for Phase 8 parser - parse Phase 7 student reports.

TDD approach: Tests written before implementation.
"""

import pytest
from pathlib import Path

# Will be implemented
from assessment_data_mcp.phase8.parser import (
    parse_student_report,
    parse_question,
    ParsedReport,
    QuestionAssessment,
    AspectAssessment,
    ParseError,
)


# Test fixtures path
FIXTURES_DIR = Path(__file__).parent / "fixtures" / "student_reports"


class TestParseStudentReport:
    """Test parse_student_report() function."""

    def test_parse_student_id(self):
        """Extract student ID from header."""
        report_path = FIXTURES_DIR / "Bedomning_TestElev01.md"
        parsed = parse_student_report(report_path)

        assert parsed.student_id == "TestElev01"

    def test_parse_questions_count(self):
        """Parse all questions from report."""
        report_path = FIXTURES_DIR / "Bedomning_TestElev01.md"
        parsed = parse_student_report(report_path)

        assert len(parsed.questions) == 4

    def test_parse_question_ids(self):
        """Extract correct question IDs."""
        report_path = FIXTURES_DIR / "Bedomning_TestElev01.md"
        parsed = parse_student_report(report_path)

        question_ids = [q.question_id for q in parsed.questions]
        assert "Q01" in question_ids
        assert "Q02" in question_ids
        assert "Q03" in question_ids
        assert "Q04" in question_ids

    def test_parse_aspects(self):
        """Parse aspects from question."""
        report_path = FIXTURES_DIR / "Bedomning_TestElev01.md"
        parsed = parse_student_report(report_path)

        # Q01 has 2 aspects
        q01 = next(q for q in parsed.questions if q.question_id == "Q01")
        assert len(q01.aspects) == 2

        # Check first aspect
        assert q01.aspects[0].name == "Centrala begrepp"
        assert q01.aspects[0].points == 1.0
        assert q01.aspects[0].assessment in ["excellent", "partial", "missing"]

    def test_parse_total_points(self):
        """Parse total points for each question."""
        report_path = FIXTURES_DIR / "Bedomning_TestElev01.md"
        parsed = parse_student_report(report_path)

        q01 = next(q for q in parsed.questions if q.question_id == "Q01")
        assert q01.total_points == 1.5
        assert q01.max_points == 2.0

        q02 = next(q for q in parsed.questions if q.question_id == "Q02")
        assert q02.total_points == 6.0
        assert q02.max_points == 8.0

    def test_parse_next_step(self):
        """Parse next step feedback."""
        report_path = FIXTURES_DIR / "Bedomning_TestElev01.md"
        parsed = parse_student_report(report_path)

        q01 = next(q for q in parsed.questions if q.question_id == "Q01")
        assert "Utveckla förklaringarna" in q01.next_step

    def test_parse_missing_next_step(self):
        """Handle missing next step gracefully."""
        report_path = FIXTURES_DIR / "Bedomning_TestElev02.md"
        parsed = parse_student_report(report_path)

        # Q04 in TestElev02 has no next step
        q04 = next(q for q in parsed.questions if q.question_id == "Q04")
        assert q04.next_step == "" or q04.next_step is None

    def test_parse_aspect_symbols(self):
        """Parse aspect assessment from symbols."""
        report_path = FIXTURES_DIR / "Bedomning_TestElev01.md"
        parsed = parse_student_report(report_path)

        # Q03 has mixed symbols: ✓, ⚠, ✗
        q03 = next(q for q in parsed.questions if q.question_id == "Q03")

        assessments = [a.assessment for a in q03.aspects]
        assert "excellent" in assessments  # ✓
        assert "partial" in assessments    # ⚠
        assert "missing" in assessments    # ✗

    def test_parse_nonexistent_file(self):
        """Raise error for nonexistent file."""
        with pytest.raises(FileNotFoundError):
            parse_student_report(Path("/nonexistent/file.md"))

    def test_parse_malformed_header(self):
        """Raise error for malformed header."""
        # Create temp file with malformed header
        import tempfile
        with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as f:
            f.write("# Invalid Header Without Elev\n\n## Content")
            temp_path = Path(f.name)

        try:
            with pytest.raises(ParseError):
                parse_student_report(temp_path)
        finally:
            temp_path.unlink()


class TestParseQuestion:
    """Test parse_question() helper function."""

    def test_parse_question_with_all_fields(self):
        """Parse complete question section."""
        content = """
**Aspekt 1:** ✓ **2.0p** - Utmärkt prestation
**Aspekt 2:** ⚠ **1.0p** - Delvis korrekt

**TOTAL: 3.0/4.0p**

**→ Nästa steg:** Utveckla vidare
"""
        question = parse_question("Q01", content)

        assert question.question_id == "Q01"
        assert len(question.aspects) == 2
        assert question.total_points == 3.0
        assert question.max_points == 4.0
        assert "Utveckla vidare" in question.next_step

    def test_parse_question_with_swedish_total(self):
        """Handle Swedish locale numbers (comma as decimal)."""
        content = """
**Aspekt:** ✓ **1,5p** - Bra

**TOTAL: 1,5/2,0p**
"""
        question = parse_question("Q01", content)

        assert question.total_points == 1.5
        assert question.max_points == 2.0


class TestAspectAssessment:
    """Test aspect assessment detection."""

    def test_excellent_from_checkmark(self):
        """✓ symbol indicates excellent."""
        content = "**Test:** ✓ **1.0p** - Comment"
        question = parse_question("Q01", content + "\n\n**TOTAL: 1.0/1.0p**")

        assert question.aspects[0].assessment == "excellent"

    def test_partial_from_warning(self):
        """⚠ symbol indicates partial."""
        content = "**Test:** ⚠ **0.5p** - Comment"
        question = parse_question("Q01", content + "\n\n**TOTAL: 0.5/1.0p**")

        assert question.aspects[0].assessment == "partial"

    def test_missing_from_x(self):
        """✗ symbol indicates missing."""
        content = "**Test:** ✗ **0.0p** - Comment"
        question = parse_question("Q01", content + "\n\n**TOTAL: 0.0/1.0p**")

        assert question.aspects[0].assessment == "missing"


class TestParsedReport:
    """Test ParsedReport dataclass."""

    def test_parsed_report_has_metadata(self):
        """ParsedReport includes source file metadata."""
        report_path = FIXTURES_DIR / "Bedomning_TestElev01.md"
        parsed = parse_student_report(report_path)

        assert "source_file" in parsed.metadata
        assert "Bedomning_TestElev01.md" in parsed.metadata["source_file"]


class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_empty_aspects(self):
        """Handle question with no aspects."""
        content = """
**TOTAL: 0.0/2.0p**

**→ Nästa steg:** Saknas svar
"""
        question = parse_question("Q01", content)

        assert len(question.aspects) == 0
        assert question.total_points == 0.0

    def test_unicode_in_content(self):
        """Handle Swedish characters correctly."""
        report_path = FIXTURES_DIR / "Bedomning_TestElev01.md"
        parsed = parse_student_report(report_path)

        # Should have parsed Swedish text without issues
        q01 = next(q for q in parsed.questions if q.question_id == "Q01")
        assert any("förståelse" in a.comment for a in q01.aspects if a.comment)
