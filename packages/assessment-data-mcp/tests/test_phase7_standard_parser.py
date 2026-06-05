"""
Tests for Phase 7 Standard Parser

Tests parsing of Q-files with standard Phase 6 format.
"""

import pytest
from pathlib import Path
import tempfile

from assessment_data_mcp.phase7.standard_parser import (
    StandardParser,
    StudentAssessment,
    QuestionAssessment,
    AspectScore,
    ParseResult,
    PATTERNS,
)


# Sample Q-file content in standard format (fabricated cell-biology theme, per code-as-plumber rule)
SAMPLE_QFILE = """# Q6 - Cellandningens steg

## Rubric excerpt
Max points: 5p

---

## Elev 100001 (47 ord)

Glykolysen sker i cytoplasman och bryter ner glukos till pyruvat.
Citronsyracykeln går vidare i mitokondrien.

### ANALYTIC ASSESSMENT:
**6a (Stegen):** ✓✓✓ **2.0p** - Båda stegen rätt
**6b (Lokalisering):** ✓ **0.5p** - Nämner men förklarar inte
**6c (ATP-utbyte):** ✗ **0p** - Saknas

**TOTAL: 2.5/5p**
**→ Next step:** Fördjupa förklaringen av ATP-utbytet per steg.

---

## Elev TestElev10 (123 ord)

Cellular respiration has three main stages. Glycolysis breaks glucose
into pyruvate in the cytoplasm. The citric acid cycle then runs in the
mitochondrial matrix, producing electron carriers for the next stage.

### ANALYTIC ASSESSMENT:
**6a (Stegen):** ✓✓✓ **2.0p** - Clear description of both stages
**6b (Lokalisering):** ✓✓ **1.5p** - Good explanation
**6c (ATP-utbyte):** ✓✓✓ **1.5p** - Excellent understanding

**TOTAL: 5/5p**
**→ Next step:** Consider adding specific ATP yields per stage.

---

## Elev 999888 (15 ord)

Glukos in, ATP ut.
"""


SAMPLE_SWEDISH_FORMAT = """# Q6 - Glykolys

## Elev 123456 (30 ord)

Testtext here.

### BEDÖMNING:
**6a:** ✓✓ **1.5p** - Bra svar
**6b:** ✗ **0p** - Saknas

**TOTAL: 1.5/3p**
**→ Nästa steg:** Öva mer.

---
"""


class TestPatterns:
    """Test that patterns match expected formats."""

    def test_student_header_numeric(self):
        """Test student header with numeric ID."""
        match = PATTERNS['student_header'].match("## Elev 100001 (47 ord)")
        assert match is not None
        assert match.group(1) == "100001"
        assert match.group(2) == "47"

    def test_student_header_alphanumeric(self):
        """Test student header with alphanumeric ID."""
        match = PATTERNS['student_header'].match("## Elev TestElev10 (123 ord)")
        assert match is not None
        assert match.group(1) == "TestElev10"
        assert match.group(2) == "123"

    def test_assessment_start_english(self):
        """Test English assessment header."""
        match = PATTERNS['assessment_start'].match("### ANALYTIC ASSESSMENT:")
        assert match is not None

    def test_assessment_start_swedish(self):
        """Test Swedish assessment header."""
        match = PATTERNS['assessment_start'].match("### BEDÖMNING:")
        assert match is not None

    def test_aspect_line(self):
        """Test aspect line pattern."""
        match = PATTERNS['aspect_line'].match(
            "**6a (Stegen):** ✓✓✓ **2.0p** - Båda stegen rätt"
        )
        assert match is not None
        assert match.group(1) == "6a (Stegen)"
        assert match.group(2) == "✓✓✓"
        assert match.group(3) == "2.0"
        assert match.group(4) == "Båda stegen rätt"

    def test_aspect_line_comma_decimal(self):
        """Test aspect line with comma decimal."""
        match = PATTERNS['aspect_line'].match(
            "**6b:** ✓ **1,5p** - Test comment"
        )
        assert match is not None
        assert match.group(3) == "1,5"

    def test_total_line(self):
        """Test total points line."""
        match = PATTERNS['total_line'].match("**TOTAL: 2.5/5p**")
        assert match is not None
        assert match.group(1) == "2.5"
        assert match.group(2) == "5"

    def test_next_step_english(self):
        """Test English next step line."""
        match = PATTERNS['next_step'].match("**→ Next step:** Practice more.")
        assert match is not None
        assert match.group(2) == "Practice more."

    def test_next_step_swedish(self):
        """Test Swedish next step line."""
        match = PATTERNS['next_step'].match("**→ Nästa steg:** Öva mer.")
        assert match is not None
        assert match.group(2) == "Öva mer."


class TestStandardParser:
    """Test StandardParser class."""

    def test_parse_content_finds_students(self):
        """Test that parse_content finds all students."""
        parser = StandardParser()
        result = parser.parse_content(SAMPLE_QFILE, "Q6")

        assert result.question_id == "Q6"
        assert len(result.students) == 3

    def test_parse_content_extracts_student_ids(self):
        """Test that student IDs are extracted correctly."""
        parser = StandardParser()
        result = parser.parse_content(SAMPLE_QFILE, "Q6")

        student_ids = [s.student_id for s in result.students]
        assert "100001" in student_ids
        assert "TestElev10" in student_ids
        assert "999888" in student_ids

    def test_parse_content_extracts_word_counts(self):
        """Test that word counts are extracted correctly."""
        parser = StandardParser()
        result = parser.parse_content(SAMPLE_QFILE, "Q6")

        student = next(s for s in result.students if s.student_id == "100001")
        assert student.word_count == 47

    def test_parse_content_extracts_assessments(self):
        """Test that assessments are extracted correctly."""
        parser = StandardParser()
        result = parser.parse_content(SAMPLE_QFILE, "Q6")

        student = next(s for s in result.students if s.student_id == "100001")
        assert student.assessment is not None
        assert student.assessment.total_points == 2.5
        assert student.assessment.max_points == 5

    def test_parse_content_extracts_aspects(self):
        """Test that aspects are extracted correctly."""
        parser = StandardParser()
        result = parser.parse_content(SAMPLE_QFILE, "Q6")

        student = next(s for s in result.students if s.student_id == "100001")
        assert len(student.assessment.aspects) == 3

        aspect_a = student.assessment.aspects[0]
        assert aspect_a.name == "6a (Stegen)"
        assert aspect_a.symbol == "✓✓✓"
        assert aspect_a.points == 2.0

    def test_parse_content_extracts_next_step(self):
        """Test that next step feedback is extracted."""
        parser = StandardParser()
        result = parser.parse_content(SAMPLE_QFILE, "Q6")

        student = next(s for s in result.students if s.student_id == "100001")
        assert "ATP-utbytet" in student.assessment.next_step

    def test_parse_content_handles_unassessed(self):
        """Test handling of students without assessments."""
        parser = StandardParser()
        result = parser.parse_content(SAMPLE_QFILE, "Q6")

        student = next(s for s in result.students if s.student_id == "999888")
        assert student.assessment is None
        assert student.answer_text.strip() == "Glukos in, ATP ut."

    def test_parse_content_swedish_format(self):
        """Test parsing Swedish format."""
        parser = StandardParser()
        result = parser.parse_content(SAMPLE_SWEDISH_FORMAT, "Q6")

        assert len(result.students) == 1
        student = result.students[0]
        assert student.student_id == "123456"
        assert student.assessment is not None
        assert student.assessment.total_points == 1.5

    def test_parse_file(self):
        """Test parsing from file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            qfile = tmp / "Q6_Cellandning.md"
            qfile.write_text(SAMPLE_QFILE, encoding='utf-8')

            parser = StandardParser()
            result = parser.parse_file(qfile)

            assert result.question_id == "Q6"
            assert len(result.students) == 3

    def test_parse_file_extracts_question_id(self):
        """Test that question ID is extracted from filename."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            qfile = tmp / "Q7a_Analysis.md"
            qfile.write_text(SAMPLE_QFILE, encoding='utf-8')

            parser = StandardParser()
            result = parser.parse_file(qfile)

            assert result.question_id == "Q7A"

    def test_validate_format_standard(self):
        """Test format validation for standard content."""
        parser = StandardParser()
        is_standard, issues = parser.validate_format(SAMPLE_QFILE)

        assert is_standard is True
        assert len(issues) == 0

    def test_validate_format_missing_students(self):
        """Test format validation for content without students."""
        parser = StandardParser()
        is_standard, issues = parser.validate_format("# Just a title\n\nNo students here.")

        assert is_standard is False
        assert any("student headers" in i.lower() for i in issues)


class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_empty_content(self):
        """Test parsing empty content."""
        parser = StandardParser()
        result = parser.parse_content("", "Q1")

        assert len(result.students) == 0
        assert len(result.warnings) > 0

    def test_nonexistent_file(self):
        """Test parsing nonexistent file."""
        parser = StandardParser()
        result = parser.parse_file("/nonexistent/path/Q1.md")

        assert len(result.errors) > 0

    def test_content_with_details_tags(self):
        """Test that <details> sections are skipped in answer text."""
        content = """## Elev 111 (10 ord)

Main answer text.

<details>
<summary>Context</summary>
This is context that should be ignored.
</details>

### ANALYTIC ASSESSMENT:
**a:** ✓ **1p** - OK

**TOTAL: 1/2p**
**→ Next step:** Do more.

---
"""
        parser = StandardParser()
        result = parser.parse_content(content, "Q1")

        student = result.students[0]
        assert "Main answer text" in student.answer_text
        assert "should be ignored" not in student.answer_text
