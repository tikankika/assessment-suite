"""Security tests for Phase 8 quantitative tool — student_id path traversal (Vuln 4).

quantitative_summary accepts a `student_id` that is interpolated into
`Analytic_{student_id}.md` and read. It is not a PATH_ARG_NAME, so the
server-level workspace gate never validates it. These tests pin the guard.
"""

import json
import pytest

from assessment_data_mcp.tools.phase8_quantitative import phase8_quantitative_tool


@pytest.fixture
def project(tmp_path):
    (tmp_path / "project_state.json").write_text(json.dumps({"current_phase": 8}))
    # Plant a secret one level above the project that a traversal would reach.
    (tmp_path.parent / "Analytic_secret.md").write_text("# SECRET DATA\n")
    return tmp_path


@pytest.mark.asyncio
async def test_student_id_forward_traversal_blocked(project):
    result = await phase8_quantitative_tool(
        project_path=str(project),
        student_id="../../Analytic_secret",
        quiet=True,
    )
    assert result["success"] is False
    assert "student_id" in result["error"].lower()
    # The secret content must never come back in the response.
    assert "SECRET" not in json.dumps(result)


@pytest.mark.asyncio
async def test_student_id_backslash_traversal_blocked(project):
    result = await phase8_quantitative_tool(
        project_path=str(project),
        student_id="..\\..\\Analytic_secret",
        quiet=True,
    )
    assert result["success"] is False
    assert "student_id" in result["error"].lower()


@pytest.mark.asyncio
async def test_student_id_bare_slash_blocked(project):
    result = await phase8_quantitative_tool(
        project_path=str(project),
        student_id="a/b",
        quiet=True,
    )
    assert result["success"] is False
    assert "student_id" in result["error"].lower()


@pytest.mark.asyncio
async def test_normal_student_id_not_rejected_by_guard(project):
    # A clean id passes the guard (it may still fail later for missing files,
    # but the failure must NOT be the traversal guard).
    result = await phase8_quantitative_tool(
        project_path=str(project),
        student_id="10001",
        quiet=True,
    )
    if result.get("success") is False:
        assert "student_id" not in result.get("error", "").lower()
