"""Tests for Phase 5 marker-based extraction from Phase 3 annotated files."""

import pytest

from assessment_data_mcp.tools.phase5_qfiles import (
    _strip_line_indices,
    _trim_after_metadata,
    extract_from_phase3_markers,
    has_phase3_markers,
)


# --- Sample annotated file content ---

SAMPLE_ANNOTATED = """\
0001 <!-- student: stu1 -->
0002
0003                         Prov, energi och miljö
0004 ----------------------------------------------
0005
<!-- phase3_q001_start -->
0006 1.
0007
<!-- phase3_q001a_start -->
0008 a) Företaget behöver certifiering. Grunderna är att
0009 ha en bra miljöpolicy.
0010
<!-- phase3_q001a_end -->
<!-- phase3_q001b_start -->
0011 b) Ett miljöcertifierat företag är lockande för
0012 konsumenterna. Det gynnar företaget och miljön.
0013
<!-- phase3_q001b_end -->
<!-- phase3_q001_end -->
<!-- phase3_q002_start -->
0014 2.
0015
<!-- phase3_q002a_start -->
0016 a) Vid en LCA granskar man en produkt från tillverkning
0017 till sopor eller återvinning.
0018
<!-- phase3_q002a_end -->
<!-- phase3_q002_end -->
"""

SAMPLE_NO_SUB = """\
0001 <!-- student: tes1 -->
0002
<!-- phase3_q003_start -->
0003 Hela svaret utan delfrågor.
0004 Mer text här.
<!-- phase3_q003_end -->
"""


class TestStripLineIndices:
    def test_removes_4digit_indices(self):
        text = "0001 Hello\n0002 World"
        result = _strip_line_indices(text)
        assert result == "Hello\nWorld"

    def test_removes_phase3_markers(self):
        text = "0001 Hello\n<!-- phase3_q001a_start -->\n0002 Answer"
        result = _strip_line_indices(text)
        assert result == "Hello\nAnswer"

    def test_removes_student_header(self):
        text = "<!-- student: stu1 -->\n0001 Hello"
        result = _strip_line_indices(text)
        assert result == "Hello"

    def test_preserves_normal_text(self):
        text = "No indices here\nJust regular text"
        result = _strip_line_indices(text)
        assert result == "No indices here\nJust regular text"


class TestHasPhase3Markers:
    def test_detects_markers(self):
        assert has_phase3_markers(SAMPLE_ANNOTATED) is True

    def test_no_markers(self):
        assert has_phase3_markers("Just plain text\nNo markers") is False


class TestExtractFromPhase3Markers:
    def test_extracts_q001_with_subquestions(self):
        result = extract_from_phase3_markers(SAMPLE_ANNOTATED, "Q001")
        assert result is not None
        assert 'sub_answers' in result
        assert 'a' in result['sub_answers']
        assert 'b' in result['sub_answers']
        assert 'certifiering' in result['sub_answers']['a']
        assert 'konsumenterna' in result['sub_answers']['b']
        assert result['word_count'] > 0

    def test_extracts_q002_with_subquestions(self):
        result = extract_from_phase3_markers(SAMPLE_ANNOTATED, "Q002")
        assert result is not None
        assert 'sub_answers' in result
        assert 'a' in result['sub_answers']
        assert 'LCA' in result['sub_answers']['a']

    def test_returns_none_for_missing_question(self):
        result = extract_from_phase3_markers(SAMPLE_ANNOTATED, "Q099")
        assert result is None

    def test_no_subquestions_returns_content(self):
        result = extract_from_phase3_markers(SAMPLE_NO_SUB, "Q003")
        assert result is not None
        assert 'sub_answers' not in result
        assert 'delfrågor' in result['content']
        assert result['word_count'] > 0

    def test_auto_detects_subquestions(self):
        """subquestions=None should auto-detect from markers."""
        result = extract_from_phase3_markers(SAMPLE_ANNOTATED, "Q001", subquestions=None)
        assert result is not None
        assert 'sub_answers' in result
        assert sorted(result['sub_answers'].keys()) == ['a', 'b']

    def test_explicit_subquestions(self):
        """Passing explicit subquestions should work too."""
        result = extract_from_phase3_markers(SAMPLE_ANNOTATED, "Q001", subquestions=["a"])
        assert result is not None
        assert 'sub_answers' in result
        assert 'a' in result['sub_answers']
        # Only requested 'a', so 'b' should not be in sub_answers
        assert 'b' not in result['sub_answers']

    def test_strips_line_indices_from_answers(self):
        """Line indices (0001, 0002 etc) should be removed from answer text."""
        result = extract_from_phase3_markers(SAMPLE_ANNOTATED, "Q001")
        assert result is not None
        for sub_text in result['sub_answers'].values():
            # No line starting with 4-digit index
            for line in sub_text.split('\n'):
                assert not line.strip().startswith('000'), f"Line index not stripped: {line}"

    def test_case_insensitive_question_id(self):
        """Q001 and q001 should both work."""
        result_upper = extract_from_phase3_markers(SAMPLE_ANNOTATED, "Q001")
        result_lower = extract_from_phase3_markers(SAMPLE_ANNOTATED, "q001")
        # Both should find the same content (markers are lowercase)
        assert result_upper is not None
        assert result_lower is not None

    def test_clustered_end_markers(self):
        """End markers grouped after last answer should not bleed content into earlier questions.

        Reproduces bug where Phase 3 places all end markers at the same position
        (e.g., Q004/Q005/Q006 end markers all after Q006's answer), causing
        Q004 extraction to include Q005+Q006 content.
        """
        content = """\
0075 4 Ge ett exempel på regression, klustring, rekommendationssystem.
0076 Enter your answer here...
<!-- phase3_q004_start -->
0078 Ord: 0
0079 Obesvarad.
0080 5 Vad är ett neuralt nätverk?
0081 Enter your answer here...
<!-- phase3_q005_start -->
0083 Ord: 0
0084 Obesvarad.
0092 6 Vad är ett beslutsträd?
0093 Enter your answer here...
<!-- phase3_q006_start -->
0095 Svaret på fråga 6 här.
<!-- phase3_q004_end -->
<!-- phase3_q005_end -->
<!-- phase3_q006_end -->
"""
        # Q004 should only contain its own answer (unanswered), NOT Q005/Q006 content
        result_q004 = extract_from_phase3_markers(content, "Q004")
        assert result_q004 is not None
        assert "neuralt nätverk" not in result_q004['content']
        assert "beslutsträd" not in result_q004['content']
        assert "Svaret på fråga 6" not in result_q004['content']

        # Q005 should only contain its own answer, not Q006
        result_q005 = extract_from_phase3_markers(content, "Q005")
        assert result_q005 is not None
        assert "beslutsträd" not in result_q005['content']
        assert "Svaret på fråga 6" not in result_q005['content']

        # Q006 should contain its answer
        result_q006 = extract_from_phase3_markers(content, "Q006")
        assert result_q006 is not None
        assert "fråga 6" in result_q006['content']
