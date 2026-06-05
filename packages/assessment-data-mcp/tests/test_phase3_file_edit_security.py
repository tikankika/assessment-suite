"""Security tests for Phase 3 file edit tool — student_id path traversal."""

import json
import pytest

from assessment_data_mcp.tools.phase3_file_edit import phase3_file_edit_tool


@pytest.fixture
def project_with_prepared(tmp_path):
    """Project with a prepared student file."""
    (tmp_path / "project_state.json").write_text(
        json.dumps({"current_phase": 3})
    )
    dest = tmp_path / "03_material" / "student_answers"
    dest.mkdir(parents=True)
    (dest / "stu1.md").write_text("0001 <!-- student: stu1 -->\n0002\n0003 Test answer.\n")
    return tmp_path


@pytest.mark.asyncio
async def test_student_id_path_traversal_blocked(project_with_prepared):
    """student_id with ../ should be rejected."""
    result = await phase3_file_edit_tool(
        project_path=str(project_with_prepared),
        student_id="../../../etc/passwd",
        edits=[{"action": "insert_at_end", "text": "exploit"}],
    )
    assert result["success"] is False
    assert "Invalid student_id" in result["error"]


@pytest.mark.asyncio
async def test_student_id_backslash_traversal_blocked(project_with_prepared):
    """student_id with backslash traversal should be rejected."""
    result = await phase3_file_edit_tool(
        project_path=str(project_with_prepared),
        student_id="..\\..\\etc\\passwd",
        edits=[{"action": "insert_at_end", "text": "exploit"}],
    )
    assert result["success"] is False
    assert "Invalid student_id" in result["error"]


@pytest.mark.asyncio
async def test_student_id_dotdot_blocked(project_with_prepared):
    """student_id containing .. in any form should be rejected."""
    result = await phase3_file_edit_tool(
        project_path=str(project_with_prepared),
        student_id="stu1/../../secret",
        edits=[{"action": "insert_at_end", "text": "exploit"}],
    )
    assert result["success"] is False
    assert "Invalid student_id" in result["error"]


@pytest.mark.asyncio
async def test_normal_student_id_accepted(project_with_prepared):
    """Normal student IDs should work fine."""
    result = await phase3_file_edit_tool(
        project_path=str(project_with_prepared),
        student_id="stu1",
        edits=[{"action": "insert_at_end", "text": "<!-- phase3_q001_end -->"}],
    )
    assert result["success"] is True


@pytest.mark.asyncio
async def test_alphanumeric_student_id_accepted(project_with_prepared):
    """Student IDs with mixed chars should work."""
    dest = project_with_prepared / "03_material" / "student_answers"
    (dest / "AbcDef2002.md").write_text("0001 <!-- student: AbcDef2002 -->\n0002\nTest.\n")

    result = await phase3_file_edit_tool(
        project_path=str(project_with_prepared),
        student_id="AbcDef2002",
        edits=[{"action": "insert_at_end", "text": "<!-- test -->"}],
    )
    assert result["success"] is True
