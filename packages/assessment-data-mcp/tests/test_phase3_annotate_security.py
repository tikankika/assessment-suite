"""Security tests for Phase 3 annotate tool — student_id path traversal.

Mirrors the protections already present in phase3_file_edit; phase3_annotate
joined student_id into a path without validation.
"""

import json
import pytest

from assessment_data_mcp.tools.phase3_annotate import phase3_annotate_tool


@pytest.fixture
def project(tmp_path):
    (tmp_path / "project_state.json").write_text(json.dumps({"current_phase": 3}))
    return tmp_path


@pytest.mark.asyncio
async def test_student_id_path_traversal_blocked(project):
    result = await phase3_annotate_tool(
        project_path=str(project),
        student_id="../../../etc/passwd",
    )
    assert result["success"] is False
    assert "Invalid student_id" in result["error"]


@pytest.mark.asyncio
async def test_student_id_backslash_traversal_blocked(project):
    result = await phase3_annotate_tool(
        project_path=str(project),
        student_id="..\\..\\etc\\passwd",
    )
    assert result["success"] is False
    assert "Invalid student_id" in result["error"]


@pytest.mark.asyncio
async def test_student_id_embedded_dotdot_blocked(project):
    result = await phase3_annotate_tool(
        project_path=str(project),
        student_id="stu1/../../secret",
    )
    assert result["success"] is False
    assert "Invalid student_id" in result["error"]
