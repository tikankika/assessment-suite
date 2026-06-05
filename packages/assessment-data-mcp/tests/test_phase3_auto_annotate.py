"""Tests for Phase 3 auto-annotation using 2C boundaries."""

import re

import pytest

from assessment_data_mcp.tools.phase3_helpers import (
    _find_line,
    _normalize_md_escapes,
    MD_ESCAPE_RE,
)
from assessment_data_mcp.tools.phase3_prepare import (
    _try_auto_annotate,
    _add_line_indices,
)


# --- Boundary config fixtures ---

BOUNDARIES_SUB_QUESTIONS = {
    'global': {
        'language': 'swedish',
        'default_sub_question_end': 'Ord:',
        'default_answer_end': 'Besvarad.',
    },
    'questions': {
        'Q001': {
            'question_id': 'Q001',
            'question_header': '1.',
            'answer_start_type': 'sub_question',
            'answer_start_marker': 'a)',
            'sub_questions': {'a': 'first sub', 'b': 'second sub'},
            'answer_end_type': 'next_question',
            'answer_end_marker': '',
            'consistent_across_students': True,
        },
        'Q002': {
            'question_id': 'Q002',
            'question_header': '2.',
            'answer_start_type': 'after_text',
            'answer_start_marker': '',
            'answer_end_type': 'marker',
            'answer_end_marker': '',
            'consistent_across_students': True,
        },
    },
}

BOUNDARIES_NO_SUB = {
    'global': {'language': 'swedish'},
    'questions': {
        'Q001': {
            'question_id': 'Q001',
            'question_header': '1. Beskriv',
            'answer_start_type': 'after_text',
            'answer_start_marker': '',
            'answer_end_type': 'next_question',
            'answer_end_marker': '',
            'consistent_across_students': True,
        },
        'Q002': {
            'question_id': 'Q002',
            'question_header': '2. Förklara',
            'answer_start_type': 'after_text',
            'answer_start_marker': '',
            'answer_end_type': 'next_question',
            'answer_end_marker': '',
            'consistent_across_students': True,
        },
    },
}


# --- Sample content ---

CONTENT_WITH_SUBS = """\
<!-- student: test1 -->

Prov, energi och miljö
----------------------------------------------

1.

a) Svar på delfråga a. Certifiering och granskning.

b) Svar på delfråga b. Konsumenter och reklam.

2.

Svar på fråga 2 utan delfrågor.
"""

CONTENT_NO_SUBS = """\
<!-- student: test2 -->

1. Beskriv

Mitt svar på fråga 1.
Mer text.

2. Förklara

Mitt svar på fråga 2.
"""


class TestAddLineIndices:
    def test_markers_not_indexed(self):
        """Phase 3 markers must not receive line indices."""
        content = (
            "Line one\n"
            "<!-- phase3_q001_start -->\n"
            "Answer text\n"
            "<!-- phase3_q001_end -->\n"
            "Line after"
        )
        result = _add_line_indices(content)
        lines = result.split('\n')
        assert lines[0] == '0001 Line one'
        assert lines[1] == '<!-- phase3_q001_start -->'
        assert lines[2] == '0002 Answer text'
        assert lines[3] == '<!-- phase3_q001_end -->'
        assert lines[4] == '0003 Line after'

    def test_sequential_indices_skip_markers(self):
        """Content line indices must be sequential with no gaps."""
        content = (
            "A\n"
            "<!-- phase3_q001_start -->\n"
            "B\n"
            "<!-- phase3_q001_end -->\n"
            "C"
        )
        result = _add_line_indices(content)
        lines = result.split('\n')
        # Content lines get 0001, 0002, 0003 — no gaps
        assert lines[0].startswith('0001')
        assert lines[2].startswith('0002')
        assert lines[4].startswith('0003')


class TestNormalizeMdEscapes:
    def test_escaped_period(self):
        assert _normalize_md_escapes(r'3\.') == '3.'

    def test_escaped_paren(self):
        assert _normalize_md_escapes(r'a\)') == 'a)'

    def test_multiple_escapes(self):
        assert _normalize_md_escapes(r'3\. a\) text') == '3. a) text'

    def test_no_escapes(self):
        assert _normalize_md_escapes('plain text') == 'plain text'

    def test_escaped_bracket(self):
        assert _normalize_md_escapes(r'\[link\]') == '[link]'


class TestFindLine:
    def test_endswith(self):
        lines = ['', 'Hello world', 'Test 1.', 'More']
        assert _find_line(lines, '1.', 0, 'endswith') == 2

    def test_contains(self):
        lines = ['no', 'has a) here', 'more']
        assert _find_line(lines, 'a)', 0, 'contains') == 1

    def test_startswith(self):
        lines = ['no', '  a) start', 'more']
        assert _find_line(lines, 'a)', 0, 'startswith') == 1

    def test_not_found(self):
        lines = ['a', 'b', 'c']
        assert _find_line(lines, 'x', 0, 'endswith') is None

    def test_start_offset(self):
        lines = ['1.', 'text', '1.']
        assert _find_line(lines, '1.', 1, 'endswith') == 2

    def test_endswith_escaped_period(self):
        """Escaped period '3\\.' should match '3.' in endswith mode."""
        lines = ['text', r'3\.', 'more']
        assert _find_line(lines, '3.', 0, 'endswith') == 1

    def test_contains_escaped_paren(self):
        r"""Escaped paren 'a\)' should match 'a)' in contains mode."""
        lines = ['no', r'has a\) here', 'more']
        assert _find_line(lines, 'a)', 0, 'contains') == 1

    def test_startswith_escaped_paren(self):
        r"""Escaped label 'a\)' should match 'a)' in startswith mode."""
        lines = ['no', r'  a\) start', 'more']
        assert _find_line(lines, 'a)', 0, 'startswith') == 1

    def test_startswith_with_line_index(self):
        """Line-index prefix should be stripped in startswith mode."""
        lines = ['0005 a) Svar', '0006 b) Svar']
        assert _find_line(lines, 'a)', 0, 'startswith') == 0
        assert _find_line(lines, 'b)', 0, 'startswith') == 1

    def test_startswith_with_line_index_and_escape(self):
        r"""Line-index + escape: '0005 a\)' should match 'a)'."""
        lines = [r'0005 a\) Svar', r'0006 b\) Svar']
        assert _find_line(lines, 'a)', 0, 'startswith') == 0
        assert _find_line(lines, 'b)', 0, 'startswith') == 1


class TestTryAutoAnnotate:
    def test_annotates_with_sub_questions(self):
        result, matched, failed = _try_auto_annotate(
            CONTENT_WITH_SUBS, BOUNDARIES_SUB_QUESTIONS
        )
        assert result is not None
        assert 'Q001' in matched
        assert '<!-- phase3_q001_start -->' in result
        assert '<!-- phase3_q001a_start -->' in result
        assert '<!-- phase3_q001a_end -->' in result
        assert '<!-- phase3_q001b_start -->' in result
        assert '<!-- phase3_q001b_end -->' in result
        assert '<!-- phase3_q001_end -->' in result

    def test_annotates_without_sub_questions(self):
        result, matched, failed = _try_auto_annotate(
            CONTENT_NO_SUBS, BOUNDARIES_NO_SUB
        )
        assert result is not None
        assert 'Q001' in matched
        assert 'Q002' in matched
        assert '<!-- phase3_q001_start -->' in result
        assert '<!-- phase3_q001_end -->' in result
        assert '<!-- phase3_q002_start -->' in result
        assert '<!-- phase3_q002_end -->' in result

    def test_q002_also_matched(self):
        result, matched, failed = _try_auto_annotate(
            CONTENT_WITH_SUBS, BOUNDARIES_SUB_QUESTIONS
        )
        assert 'Q002' in matched
        assert '<!-- phase3_q002_start -->' in result
        assert '<!-- phase3_q002_end -->' in result

    def test_returns_none_when_no_match(self):
        boundaries = {
            'global': {},
            'questions': {
                'Q001': {
                    'question_id': 'Q001',
                    'question_header': 'NONEXISTENT HEADER',
                    'answer_start_type': 'after_text',
                    'answer_start_marker': '',
                    'answer_end_type': 'marker',
                    'answer_end_marker': '',
                },
            },
        }
        result, matched, failed = _try_auto_annotate("Just some text", boundaries)
        assert result is None
        assert len(matched) == 0
        assert len(failed) > 0

    def test_partial_match(self):
        """When Q001 matches but Q002 header doesn't exist."""
        boundaries = {
            'global': {},
            'questions': {
                'Q001': {
                    'question_id': 'Q001',
                    'question_header': '1. Beskriv',
                    'answer_start_type': 'after_text',
                    'answer_start_marker': '',
                    'answer_end_type': 'next_question',
                    'answer_end_marker': '',
                },
                'Q002': {
                    'question_id': 'Q002',
                    'question_header': 'MISSING HEADER',
                    'answer_start_type': 'after_text',
                    'answer_start_marker': '',
                    'answer_end_type': 'marker',
                    'answer_end_marker': '',
                },
            },
        }
        result, matched, failed = _try_auto_annotate(CONTENT_NO_SUBS, boundaries)
        assert result is not None
        assert 'Q001' in matched
        assert len(failed) > 0

    def test_skips_auto_graded(self):
        boundaries = {
            'global': {},
            'questions': {
                'Q001': {
                    'question_id': 'Q001',
                    'auto_graded': True,
                    'skip_boundary_detection': True,
                },
            },
        }
        result, matched, failed = _try_auto_annotate("text", boundaries)
        assert result is None
        assert len(matched) == 0

    def test_markers_dont_interfere_with_indexing(self):
        """Auto-annotated content should index cleanly.
        Marker lines must NOT get indices — they stay on their own lines.
        """
        result, matched, _ = _try_auto_annotate(
            CONTENT_NO_SUBS, BOUNDARIES_NO_SUB
        )
        assert result is not None
        indexed = _add_line_indices(result)
        for line in indexed.split('\n'):
            assert line  # No empty lines should cause issues
            if '<!-- phase3_' in line:
                # Marker lines must NOT have a line index prefix
                assert not re.match(r'^\d{4,}\s', line), \
                    f"Marker should not be indexed: {line}"
            else:
                # Content lines must have a line index prefix
                assert re.match(r'^\d{4,}\s', line), \
                    f"Content line missing index: {line}"

    def test_marker_order_is_correct(self):
        """Question start should come before sub-question markers."""
        result, _, _ = _try_auto_annotate(
            CONTENT_WITH_SUBS, BOUNDARIES_SUB_QUESTIONS
        )
        assert result is not None
        lines = result.split('\n')
        q_start = None
        a_start = None
        a_end = None
        b_start = None
        b_end = None
        q_end = None
        for i, line in enumerate(lines):
            if '<!-- phase3_q001_start -->' in line:
                q_start = i
            if '<!-- phase3_q001a_start -->' in line:
                a_start = i
            if '<!-- phase3_q001a_end -->' in line:
                a_end = i
            if '<!-- phase3_q001b_start -->' in line:
                b_start = i
            if '<!-- phase3_q001b_end -->' in line:
                b_end = i
            if '<!-- phase3_q001_end -->' in line:
                q_end = i

        assert q_start is not None
        assert a_start is not None
        assert a_end is not None
        assert b_start is not None
        assert b_end is not None
        assert q_end is not None
        assert q_start < a_start < a_end < b_start < b_end < q_end

    def test_escaped_sub_question_labels(self):
        """Handle escaped labels like a\\) from markdown conversion."""
        content = """\
<!-- student: esc1 -->

1.

a\\) Svar med escaped parentes.

b\\) Mer svar.

2.

Fråga 2 svar.
"""
        result, matched, _ = _try_auto_annotate(content, BOUNDARIES_SUB_QUESTIONS)
        assert result is not None
        assert 'Q001' in matched
        assert '<!-- phase3_q001a_start -->' in result
        assert '<!-- phase3_q001b_start -->' in result

    def test_escaped_question_headers(self):
        r"""Escaped question headers like '3\.' should match '3.' boundary."""
        content = (
            "<!-- student: esc2 -->\n"
            "\n"
            "1\\. Beskriv\n"
            "\n"
            "Svar på fråga 1.\n"
            "\n"
            "2\\. Förklara\n"
            "\n"
            "Svar på fråga 2.\n"
        )
        result, matched, failed = _try_auto_annotate(content, BOUNDARIES_NO_SUB)
        assert result is not None
        assert 'Q001' in matched, f"Q001 not matched, failed: {failed}"
        assert 'Q002' in matched, f"Q002 not matched, failed: {failed}"
        assert '<!-- phase3_q001_start -->' in result
        assert '<!-- phase3_q002_start -->' in result

    def test_markers_wrap_only_answers_not_questions(self):
        """Markers should wrap ONLY student answers, not question text or metadata."""
        content = """\
<!-- student: test_wrap -->

1.

a) Svar A text.

b) Svar B text.

2.

Svar på fråga 2.
"""
        result, matched, _ = _try_auto_annotate(
            content, BOUNDARIES_SUB_QUESTIONS
        )
        assert result is not None
        lines = result.split('\n')

        # Question header "1." should be BEFORE q001_start marker
        header_line = next(i for i, l in enumerate(lines) if l.strip() == '1.')
        q_start = next(i for i, l in enumerate(lines) if 'phase3_q001_start' in l)
        assert header_line < q_start, \
            f"Header '1.' at line {header_line} should be before q001_start at {q_start}"

        # Question header "2." should be BEFORE q002_start marker
        header2_line = next(i for i, l in enumerate(lines) if l.strip() == '2.')
        q2_start = next(i for i, l in enumerate(lines) if 'phase3_q002_start' in l)
        assert header2_line < q2_start, \
            f"Header '2.' at line {header2_line} should be before q002_start at {q2_start}"

    def test_markers_exclude_trailing_metadata(self):
        """Trailing metadata (Ord:, Besvarad.) should be outside markers."""
        content = """\
<!-- student: test_meta -->

1 Fråga ett
Enter your answer here...

Mitt svar.

Ord: 5
Besvarad.
"""
        boundaries = {
            'global': {'language': 'swedish'},
            'questions': {
                'Q001': {
                    'question_header': '1 Fråga ett',
                    'answer_start_type': 'after_text',
                    'answer_start_marker': 'Enter your answer here...',
                    'answer_end_type': 'marker',
                    'answer_end_marker': '',
                },
            },
        }
        result, matched, _ = _try_auto_annotate(content, boundaries)
        assert result is not None
        assert 'Q001' in matched
        lines = result.split('\n')

        q_end = next(i for i, l in enumerate(lines) if 'phase3_q001_end' in l)

        # "Ord: 5" and "Besvarad." should be AFTER q001_end
        ord_line = next(i for i, l in enumerate(lines) if 'Ord: 5' in l)
        besvarad_line = next(i for i, l in enumerate(lines) if 'Besvarad.' in l)
        assert ord_line > q_end, f"'Ord: 5' at {ord_line} should be after q001_end at {q_end}"
        assert besvarad_line > q_end, f"'Besvarad.' at {besvarad_line} should be after q001_end at {q_end}"

        # "Enter your answer here..." should be BEFORE q001_start
        q_start = next(i for i, l in enumerate(lines) if 'phase3_q001_start' in l)
        prompt_line = next(i for i, l in enumerate(lines) if 'Enter your answer' in l)
        assert prompt_line < q_start, \
            f"Prompt at {prompt_line} should be before q001_start at {q_start}"

    def test_consecutive_unanswered_no_clustered_end_markers(self):
        """End markers must not cluster when consecutive questions are unanswered.

        Reproduces root cause bug: when answer_end_marker detection overshoots
        (e.g. shared separator '---' only at end of file), _find_content_end
        scanned into later questions' regions, placing all end markers at the
        same position after the last answered question.
        """
        content = """\
<!-- student: test_cluster -->

4 Ge ett exempel
Enter your answer here...

Ord: 0
Obesvarad.
5 Vad är ett neuralt nätverk?
Enter your answer here...

Ord: 0
Obesvarad.
6 Vad är ett beslutsträd?
Enter your answer here...

Svaret på fråga 6 här.

Ord: 10
Besvarad.
---
"""
        boundaries = {
            'global': {'language': 'swedish'},
            'questions': {
                'Q004': {
                    'question_id': 'Q004',
                    'question_header': '4 Ge ett exempel',
                    'answer_start_type': 'after_text',
                    'answer_start_marker': 'Enter your answer here...',
                    'answer_end_type': 'marker',
                    'answer_end_marker': '---',
                },
                'Q005': {
                    'question_id': 'Q005',
                    'question_header': '5 Vad är ett neuralt nätverk?',
                    'answer_start_type': 'after_text',
                    'answer_start_marker': 'Enter your answer here...',
                    'answer_end_type': 'marker',
                    'answer_end_marker': '---',
                },
                'Q006': {
                    'question_id': 'Q006',
                    'question_header': '6 Vad är ett beslutsträd?',
                    'answer_start_type': 'after_text',
                    'answer_start_marker': 'Enter your answer here...',
                    'answer_end_type': 'marker',
                    'answer_end_marker': '---',
                },
            },
        }
        result, matched, failed = _try_auto_annotate(content, boundaries)
        assert result is not None
        assert set(matched) == {'Q004', 'Q005', 'Q006'}

        lines = result.split('\n')

        # Find marker positions
        q4_start = next(i for i, l in enumerate(lines) if 'phase3_q004_start' in l)
        q4_end = next(i for i, l in enumerate(lines) if 'phase3_q004_end' in l)
        q5_start = next(i for i, l in enumerate(lines) if 'phase3_q005_start' in l)
        q5_end = next(i for i, l in enumerate(lines) if 'phase3_q005_end' in l)
        q6_start = next(i for i, l in enumerate(lines) if 'phase3_q006_start' in l)
        q6_end = next(i for i, l in enumerate(lines) if 'phase3_q006_end' in l)

        # End markers must NOT be clustered at the same position
        assert q4_end != q5_end, "q004_end and q005_end clustered"
        assert q5_end != q6_end, "q005_end and q006_end clustered"

        # Each question's markers must be properly ordered and non-overlapping
        assert q4_start <= q4_end < q5_start <= q5_end < q6_start <= q6_end

        # Q004 region should NOT contain Q005/Q006 content
        q4_content = '\n'.join(lines[q4_start:q4_end + 1])
        assert 'neuralt nätverk' not in q4_content
        assert 'beslutsträd' not in q4_content
        assert 'Svaret på fråga 6' not in q4_content

        # Q005 region should NOT contain Q006 content
        q5_content = '\n'.join(lines[q5_start:q5_end + 1])
        assert 'beslutsträd' not in q5_content
        assert 'Svaret på fråga 6' not in q5_content

        # Q006 should contain its answer
        q6_content = '\n'.join(lines[q6_start:q6_end + 1])
        assert 'Svaret på fråga 6' in q6_content
