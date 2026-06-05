"""Integration test: Phase 3 prepare → annotate → Phase 5 marker extraction.

Tests that the full pipeline works end-to-end:
1. Raw content + header → line-indexed (prepare step)
2. Strip indices → auto-annotate → re-index (annotate step)
3. Line-indexed + markers → Phase 5 extraction
"""

import pytest

from assessment_data_mcp.tools.phase3_helpers import (
    _find_line,
    LINE_INDEX_RE,
    PHASE3_MARKER_PREFIX,
)
from assessment_data_mcp.tools.phase3_prepare import (
    _try_auto_annotate,
    _add_line_indices,
)
from assessment_data_mcp.tools.phase3_annotate import (
    _strip_line_indices,
    _strip_existing_markers,
)
from assessment_data_mcp.tools.phase5_qfiles import (
    extract_from_phase3_markers,
    has_phase3_markers,
)


BOUNDARIES = {
    'global': {
        'language': 'swedish',
    },
    'questions': {
        'Q001': {
            'question_id': 'Q001',
            'question_header': '1.',
            'answer_start_type': 'sub_question',
            'answer_start_marker': 'a)',
            'sub_questions': {'a': 'sub a', 'b': 'sub b'},
            'answer_end_type': 'next_question',
            'answer_end_marker': '',
        },
        'Q002': {
            'question_id': 'Q002',
            'question_header': '2.',
            'answer_start_type': 'after_text',
            'answer_start_marker': '',
            'answer_end_type': 'next_question',
            'answer_end_marker': '',
        },
        'Q003': {
            'question_id': 'Q003',
            'question_header': '3.',
            'answer_start_type': 'after_text',
            'answer_start_marker': '',
            'answer_end_type': 'marker',
            'answer_end_marker': '',
        },
    },
}

RAW_CONTENT = """\
<!-- student: stu1 -->

Provtitel
---------

1.

a) Certifieringsprocessen kräver granskning.
Företaget måste uppfylla krav.

b) Konsumenter föredrar miljövänliga alternativ.
Det gynnar företaget ekonomiskt.

2.

Svaret på fråga 2 handlar om LCA.
Man granskar från vagga till grav.

3.

Sista frågan om producentansvar.
Plast i haven är ett stort problem.
"""


class TestFullPipeline:
    def test_annotate_index_extract(self):
        """Full pipeline: annotate → index → extract."""
        # Step 1: Auto-annotate
        annotated, matched, failed = _try_auto_annotate(RAW_CONTENT, BOUNDARIES)
        assert annotated is not None
        assert 'Q001' in matched
        assert 'Q002' in matched
        assert 'Q003' in matched

        # Step 2: Add line indices
        indexed = _add_line_indices(annotated)

        # Verify markers are present
        assert has_phase3_markers(indexed)

        # Step 3: Phase 5 extraction
        q1 = extract_from_phase3_markers(indexed, 'Q001')
        assert q1 is not None
        assert 'sub_answers' in q1
        assert 'a' in q1['sub_answers']
        assert 'b' in q1['sub_answers']
        assert 'Certifiering' in q1['sub_answers']['a']
        assert 'Konsumenter' in q1['sub_answers']['b']

        q2 = extract_from_phase3_markers(indexed, 'Q002')
        assert q2 is not None
        assert 'LCA' in q2['content']

        q3 = extract_from_phase3_markers(indexed, 'Q003')
        assert q3 is not None
        assert 'producentansvar' in q3['content']

    def test_two_step_prepare_then_annotate(self):
        """Simulates the two-step flow: prepare (index) → annotate (strip+annotate+re-index)."""
        # Step 1: prepare — add line indices (no annotation)
        indexed = _add_line_indices(RAW_CONTENT)
        assert not has_phase3_markers(indexed)

        # Step 2: annotate — strip indices, annotate, re-index
        raw = _strip_line_indices(indexed)
        annotated, matched, failed = _try_auto_annotate(raw, BOUNDARIES)
        assert annotated is not None
        assert set(matched) >= {'Q001', 'Q002', 'Q003'}

        re_indexed = _add_line_indices(annotated)
        assert has_phase3_markers(re_indexed)

        # Step 3: Phase 5 extraction works on re-indexed content
        q1 = extract_from_phase3_markers(re_indexed, 'Q001')
        assert q1 is not None
        assert 'Certifiering' in q1['sub_answers']['a']

    def test_extracted_text_is_clean(self):
        """Extracted text should have no line indices or markers."""
        annotated, _, _ = _try_auto_annotate(RAW_CONTENT, BOUNDARIES)
        indexed = _add_line_indices(annotated)

        q1 = extract_from_phase3_markers(indexed, 'Q001')
        for sub_text in q1['sub_answers'].values():
            for line in sub_text.split('\n'):
                # No 4-digit index prefix
                assert not (len(line) > 4 and line[:4].isdigit() and line[4] == ' '), \
                    f"Index not stripped: {line}"
                # No marker lines
                assert '<!-- phase3_' not in line, f"Marker not stripped: {line}"

    def test_word_counts_reasonable(self):
        """Word counts should be > 0 for non-empty answers."""
        annotated, _, _ = _try_auto_annotate(RAW_CONTENT, BOUNDARIES)
        indexed = _add_line_indices(annotated)

        for q_id in ['Q001', 'Q002', 'Q003']:
            result = extract_from_phase3_markers(indexed, q_id)
            assert result is not None, f"{q_id} not found"
            assert result['word_count'] > 0, f"{q_id} has zero words"


class TestStripHelpers:
    def test_strip_line_indices(self):
        content = "0001 Line one\n<!-- phase3_q001_start -->\n0002 Line two"
        result = _strip_line_indices(content)
        assert result == "Line one\n<!-- phase3_q001_start -->\nLine two"

    def test_strip_existing_markers(self):
        content = "Line one\n<!-- phase3_q001_start -->\nAnswer\n<!-- phase3_q001_end -->\nLine after"
        result = _strip_existing_markers(content)
        assert '<!-- phase3_' not in result
        assert 'Answer' in result
