"""Tests for Phase 3 file edit tool."""

import json
import pytest

from assessment_data_mcp.tools.phase3_file_edit import (
    _build_line_index_map,
    _apply_edits,
)


# --- Fixtures ---

PREPARED_CONTENT = """\
0001 <!-- student: stu1 -->
0002
0003 1. Beskriv
0004
0005 Mitt svar på fråga 1.
0006
0007 2. Förklara
0008
0009 Annat svar.
0010 """

PARTIALLY_ANNOTATED = """\
0001 <!-- student: stu1 -->
0002
<!-- phase3_q001_start -->
0003 1. Beskriv
0004
0005 Mitt svar.
<!-- phase3_q001_end -->
0006
0007 2. Förklara
0008
0009 Annat svar.
0010 """


# --- Unit tests: _build_line_index_map ---

class TestBuildLineIndexMap:
    def test_basic_index_map(self):
        lines = PREPARED_CONTENT.split('\n')
        index_map, warnings = _build_line_index_map(lines)
        assert index_map["0001"] == 0
        assert index_map["0003"] == 2
        assert index_map["0005"] == 4
        assert index_map["0010"] == 9
        assert not warnings

    def test_marker_lines_excluded(self):
        lines = PARTIALLY_ANNOTATED.split('\n')
        index_map, warnings = _build_line_index_map(lines)
        # Marker lines should NOT be in the map
        assert "0001" in index_map
        assert "0003" in index_map
        # No marker text as key
        for key in index_map:
            assert key.isdigit()
        assert not warnings

    def test_duplicate_index_warning(self):
        lines = ["0001 first", "0001 duplicate"]
        index_map, warnings = _build_line_index_map(lines)
        assert len(warnings) == 1
        assert "Duplicate" in warnings[0]
        # First occurrence wins
        assert index_map["0001"] == 0

    def test_empty_content(self):
        index_map, warnings = _build_line_index_map([])
        assert index_map == {}
        assert not warnings


# --- Unit tests: _apply_edits ---

class TestApplyEdits:
    def _lines_and_map(self, content=PREPARED_CONTENT):
        lines = content.split('\n')
        index_map, _ = _build_line_index_map(lines)
        return lines, index_map

    def test_insert_before_line(self):
        lines, index_map = self._lines_and_map()
        result, applied, errors, warnings = _apply_edits(lines, index_map, [
            {"action": "insert_before_line", "line_index": "0003",
             "text": "<!-- phase3_q001_start -->"},
        ])
        result_str = '\n'.join(result)
        assert '<!-- phase3_q001_start -->' in result_str
        # Marker should be BEFORE the line with index 0003
        marker_pos = result.index('<!-- phase3_q001_start -->')
        line_0003_pos = next(i for i, l in enumerate(result) if l.startswith('0003'))
        assert marker_pos < line_0003_pos
        assert len(applied) == 1
        assert not errors

    def test_insert_after_line(self):
        lines, index_map = self._lines_and_map()
        result, applied, errors, warnings = _apply_edits(lines, index_map, [
            {"action": "insert_after_line", "line_index": "0005",
             "text": "<!-- phase3_q001_end -->"},
        ])
        result_str = '\n'.join(result)
        assert '<!-- phase3_q001_end -->' in result_str
        # Marker should be AFTER the line with index 0005
        line_0005_pos = next(i for i, l in enumerate(result) if l.startswith('0005'))
        marker_pos = result.index('<!-- phase3_q001_end -->')
        assert marker_pos > line_0005_pos
        assert len(applied) == 1

    def test_remove_marker(self):
        lines, index_map = self._lines_and_map(PARTIALLY_ANNOTATED)
        result, applied, errors, warnings = _apply_edits(lines, index_map, [
            {"action": "remove_marker", "marker": "<!-- phase3_q001_start -->"},
        ])
        result_str = '\n'.join(result)
        assert '<!-- phase3_q001_start -->' not in result_str
        # q001_end should still be there
        assert '<!-- phase3_q001_end -->' in result_str
        assert len(applied) == 1

    def test_insert_at_end(self):
        lines, index_map = self._lines_and_map()
        result, applied, errors, warnings = _apply_edits(lines, index_map, [
            {"action": "insert_at_end",
             "text": "<!-- phase3_q007_start -->\n<!-- phase3_q007_end -->"},
        ])
        # Last two lines should be the markers
        assert result[-1] == '<!-- phase3_q007_end -->'
        assert result[-2] == '<!-- phase3_q007_start -->'
        assert len(applied) == 1

    def test_multiple_inserts_same_line(self):
        """Two inserts before same index — order preserved from edits list."""
        lines, index_map = self._lines_and_map()
        result, applied, errors, warnings = _apply_edits(lines, index_map, [
            {"action": "insert_before_line", "line_index": "0003",
             "text": "<!-- phase3_q001_start -->"},
            {"action": "insert_before_line", "line_index": "0003",
             "text": "<!-- phase3_q001a_start -->"},
        ])
        q_start = result.index('<!-- phase3_q001_start -->')
        a_start = result.index('<!-- phase3_q001a_start -->')
        line_0003 = next(i for i, l in enumerate(result) if l.startswith('0003'))
        assert q_start < a_start < line_0003
        assert len(applied) == 2

    def test_combined_insert_and_remove(self):
        """Remove a marker and insert a new one in the same call."""
        lines, index_map = self._lines_and_map(PARTIALLY_ANNOTATED)
        result, applied, errors, warnings = _apply_edits(lines, index_map, [
            {"action": "remove_marker", "marker": "<!-- phase3_q001_end -->"},
            {"action": "insert_after_line", "line_index": "0005",
             "text": "<!-- phase3_q001_end -->"},
        ])
        result_str = '\n'.join(result)
        # Should still have exactly one q001_end
        assert result_str.count('<!-- phase3_q001_end -->') == 1
        # And it should be after line 0005
        line_0005 = next(i for i, l in enumerate(result) if l.startswith('0005'))
        end_pos = result.index('<!-- phase3_q001_end -->')
        assert end_pos > line_0005
        assert len(applied) == 2

    def test_missing_line_index(self):
        lines, index_map = self._lines_and_map()
        result, applied, errors, warnings = _apply_edits(lines, index_map, [
            {"action": "insert_before_line", "line_index": "9999",
             "text": "<!-- never -->"},
        ])
        assert len(errors) == 1
        assert "9999" in errors[0]["error"]
        assert not applied
        # Lines unchanged
        assert result == lines

    def test_remove_nonexistent_marker(self):
        lines, index_map = self._lines_and_map()
        result, applied, errors, warnings = _apply_edits(lines, index_map, [
            {"action": "remove_marker", "marker": "<!-- nonexistent -->"},
        ])
        assert len(warnings) == 1
        assert "not found" in warnings[0]
        assert not applied

    def test_unknown_action(self):
        lines, index_map = self._lines_and_map()
        result, applied, errors, warnings = _apply_edits(lines, index_map, [
            {"action": "do_something_weird"},
        ])
        assert len(errors) == 1
        assert "Unknown" in errors[0]["error"]

    def test_empty_edits(self):
        lines, index_map = self._lines_and_map()
        result, applied, errors, warnings = _apply_edits(lines, index_map, [])
        assert result == lines
        assert not applied
        assert not errors

    def test_partial_success(self):
        """Some edits succeed, some fail — both reported."""
        lines, index_map = self._lines_and_map()
        result, applied, errors, warnings = _apply_edits(lines, index_map, [
            {"action": "insert_before_line", "line_index": "0003",
             "text": "<!-- phase3_q001_start -->"},
            {"action": "insert_before_line", "line_index": "9999",
             "text": "<!-- never -->"},
        ])
        assert len(applied) == 1
        assert len(errors) == 1
        assert '<!-- phase3_q001_start -->' in '\n'.join(result)

    def test_full_annotation(self):
        """Simulate annotating a complete student file with 2 questions."""
        lines, index_map = self._lines_and_map()
        edits = [
            {"action": "insert_before_line", "line_index": "0003",
             "text": "<!-- phase3_q001_start -->"},
            {"action": "insert_after_line", "line_index": "0005",
             "text": "<!-- phase3_q001_end -->"},
            {"action": "insert_before_line", "line_index": "0007",
             "text": "<!-- phase3_q002_start -->"},
            {"action": "insert_after_line", "line_index": "0009",
             "text": "<!-- phase3_q002_end -->"},
        ]
        result, applied, errors, warnings = _apply_edits(lines, index_map, edits)
        assert len(applied) == 4
        assert not errors

        result_str = '\n'.join(result)
        # Verify marker order
        positions = [
            result_str.index('<!-- phase3_q001_start -->'),
            result_str.index('<!-- phase3_q001_end -->'),
            result_str.index('<!-- phase3_q002_start -->'),
            result_str.index('<!-- phase3_q002_end -->'),
        ]
        assert positions == sorted(positions)


# --- Integration tests ---

@pytest.fixture
def project_with_prepared(tmp_path):
    """Project with a prepared (indexed, no markers) student file."""
    (tmp_path / "project_state.json").write_text(
        json.dumps({"current_phase": 3})
    )
    dest = tmp_path / "03_material" / "student_answers"
    dest.mkdir(parents=True)
    (dest / "stu1.md").write_text(PREPARED_CONTENT)
    return tmp_path


@pytest.mark.asyncio
async def test_full_edit_cycle(project_with_prepared):
    """Insert markers and verify file content."""
    from assessment_data_mcp.tools.phase3_file_edit import phase3_file_edit_tool

    result = await phase3_file_edit_tool(
        project_path=str(project_with_prepared),
        student_id="stu1",
        edits=[
            {"action": "insert_before_line", "line_index": "0003",
             "text": "<!-- phase3_q001_start -->"},
            {"action": "insert_after_line", "line_index": "0005",
             "text": "<!-- phase3_q001_end -->"},
        ],
    )

    assert result["success"] is True
    assert result["edits_applied"] == 2
    assert result["edits_failed"] == 0
    assert result["markers_in_file"] == 2
    assert result["lines_after"] == result["lines_before"] + 2

    # Verify actual file content
    filepath = project_with_prepared / "03_material" / "student_answers" / "stu1.md"
    content = filepath.read_text()
    assert '<!-- phase3_q001_start -->' in content
    assert '<!-- phase3_q001_end -->' in content

    # Line indices unchanged
    assert '0003 1. Beskriv' in content
    assert '0005 Mitt svar' in content


@pytest.mark.asyncio
async def test_file_not_found(project_with_prepared):
    from assessment_data_mcp.tools.phase3_file_edit import phase3_file_edit_tool

    result = await phase3_file_edit_tool(
        project_path=str(project_with_prepared),
        student_id="nonexistent",
        edits=[{"action": "insert_at_end", "text": "test"}],
    )

    assert result["success"] is False
    assert "not found" in result["error"].lower()


@pytest.mark.asyncio
async def test_empty_edits_noop(project_with_prepared):
    from assessment_data_mcp.tools.phase3_file_edit import phase3_file_edit_tool

    result = await phase3_file_edit_tool(
        project_path=str(project_with_prepared),
        student_id="stu1",
        edits=[],
    )

    assert result["success"] is True
    assert result["edits_applied"] == 0


@pytest.mark.asyncio
async def test_insert_at_end_for_unanswered(project_with_prepared):
    """Append empty markers at end of file for unanswered questions."""
    from assessment_data_mcp.tools.phase3_file_edit import phase3_file_edit_tool

    result = await phase3_file_edit_tool(
        project_path=str(project_with_prepared),
        student_id="stu1",
        edits=[
            {"action": "insert_at_end",
             "text": "<!-- phase3_q007_start -->\n<!-- phase3_q007a_start -->\n<!-- phase3_q007a_end -->\n<!-- phase3_q007_end -->"},
        ],
    )

    assert result["success"] is True
    assert result["markers_in_file"] == 4

    filepath = project_with_prepared / "03_material" / "student_answers" / "stu1.md"
    content = filepath.read_text()
    assert content.rstrip().endswith('<!-- phase3_q007_end -->')


@pytest.mark.asyncio
async def test_remove_then_reinsert(project_with_prepared):
    """Remove a marker and re-insert at a different position."""
    from assessment_data_mcp.tools.phase3_file_edit import phase3_file_edit_tool

    # First: add a marker at wrong position
    await phase3_file_edit_tool(
        project_path=str(project_with_prepared),
        student_id="stu1",
        edits=[
            {"action": "insert_after_line", "line_index": "0003",
             "text": "<!-- phase3_q001_end -->"},
        ],
    )

    # Then: remove and re-insert at correct position
    result = await phase3_file_edit_tool(
        project_path=str(project_with_prepared),
        student_id="stu1",
        edits=[
            {"action": "remove_marker", "marker": "<!-- phase3_q001_end -->"},
            {"action": "insert_after_line", "line_index": "0005",
             "text": "<!-- phase3_q001_end -->"},
        ],
    )

    assert result["success"] is True
    assert result["edits_applied"] == 2

    filepath = project_with_prepared / "03_material" / "student_answers" / "stu1.md"
    content = filepath.read_text()
    lines = content.split('\n')

    # Marker should be after 0005, not after 0003
    end_pos = lines.index('<!-- phase3_q001_end -->')
    line_0005 = next(i for i, l in enumerate(lines) if l.startswith('0005'))
    line_0003 = next(i for i, l in enumerate(lines) if l.startswith('0003'))
    assert end_pos > line_0005
