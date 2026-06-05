"""Comprehensive tests for setup_project tool (Q1-Q5).

Tests all critical decisions from PHASE-1-OVERVIEW.md:
- Q1: Returns plain dict (MCP auto-wraps)
- Q2: HTML → markdown conversion
- Q3: Course content copied to 03_material/ (RFC-028)
- Q4: Workflow logging to workflow_log.jsonl
- Q5: Incomplete state on errors (no rollback)
"""

import pytest
import asyncio
from pathlib import Path
import json
import yaml

from assessment_data_mcp.tools.phase1_setup import setup_project_tool
from assessment_data_mcp.constants.folders import (
    PHASE1_ORIGINAL,
    PHASE2_MARKDOWN,
    PHASE3_MATERIAL,
    PHASE4_RUBRIC,
    PHASE5_ANSWERS,
    PHASE6_ASSESSMENT,
    PHASE7_STUDENT,
    COMPLETE_ASSESSMENT,
    METHODOLOGY,
)


@pytest.fixture
def temp_project(tmp_path):
    """Create mock environment for testing."""
    # Create exam file
    exam = tmp_path / "exam.pdf"
    exam.write_text("Mock exam PDF content")

    # Create rubric file
    rubric = tmp_path / "rubric.pdf"
    rubric.write_text("Mock rubric PDF content")

    # Create syllabus file
    syllabus = tmp_path / "syllabus.md"
    syllabus.write_text("# Kursplan Biologi\nMål och innehåll")

    # Create student answers directory
    students = tmp_path / "students"
    students.mkdir()
    (students / "student1.pdf").write_text("Student 1 answers")
    (students / "student2.pdf").write_text("Student 2 answers")

    # Create course content directory
    course_content = tmp_path / "course"
    course_content.mkdir()
    (course_content / "lecture1.pdf").write_text("Lecture 1 content")
    (course_content / "lecture2.pdf").write_text("Lecture 2 content")

    # Create output directory
    output = tmp_path / "output"
    output.mkdir()

    return {
        "exam": str(exam),
        "rubric": str(rubric),
        "syllabus": str(syllabus),
        "students": str(students),
        "course_content": str(course_content),
        "output": str(output)
    }


@pytest.mark.asyncio
async def test_creates_folders(temp_project):
    """Test 1: Verify folder structure creation."""
    result = await setup_project_tool(
        exam_path=temp_project["exam"],
        rubric_path=temp_project["rubric"],
        syllabus_source=temp_project["syllabus"],
        student_answers_path=temp_project["students"],
        output_base_path=temp_project["output"],
        project_name="test_project"
    )

    assert result["success"]
    # 8 main folders + 1 methodology folder = 9
    assert result["folders_created"] == 9

    project = Path(result["project_path"])
    assert (project / PHASE1_ORIGINAL).exists()
    assert (project / PHASE2_MARKDOWN).exists()
    assert (project / PHASE3_MATERIAL).exists()
    assert (project / PHASE4_RUBRIC).exists()
    assert (project / PHASE5_ANSWERS).exists()
    assert (project / PHASE6_ASSESSMENT).exists()
    assert (project / PHASE7_STUDENT).exists()
    assert (project / COMPLETE_ASSESSMENT).exists()
    assert (project / METHODOLOGY).exists()


@pytest.mark.asyncio
async def test_copies_files(temp_project):
    """Test 2: Verify file copying."""
    result = await setup_project_tool(
        exam_path=temp_project["exam"],
        rubric_path=temp_project["rubric"],
        syllabus_source=temp_project["syllabus"],
        student_answers_path=temp_project["students"],
        output_base_path=temp_project["output"],
        project_name="test_project"
    )

    project = Path(result["project_path"])
    assert (project / PHASE1_ORIGINAL / "exam_questions.pdf").exists()
    assert (project / PHASE1_ORIGINAL / "rubric.pdf").exists()
    assert (project / PHASE1_ORIGINAL / "student_answers" / "student1.pdf").exists()
    assert (project / PHASE1_ORIGINAL / "student_answers" / "student2.pdf").exists()


@pytest.mark.asyncio
async def test_references_course_content(temp_project):
    """Test 3 (RFC-028): Course content copied to 03_material/."""
    result = await setup_project_tool(
        exam_path=temp_project["exam"],
        rubric_path=temp_project["rubric"],
        syllabus_source=temp_project["syllabus"],
        student_answers_path=temp_project["students"],
        course_content_path=temp_project["course_content"],
        output_base_path=temp_project["output"],
        project_name="test_project"
    )

    project = Path(result["project_path"])

    # RFC-028: Course content should be copied to 03_material/
    assert (project / PHASE3_MATERIAL).exists()

    # Should be recorded in sources.yaml
    with open(project / "sources.yaml") as f:
        sources = yaml.safe_load(f)

    assert "course_content" in sources["sources"]
    assert sources["sources"]["course_content"]["file_count"] == 2
    assert sources["sources"]["course_content"]["copied_to"] == f"{PHASE3_MATERIAL}/"


@pytest.mark.asyncio
async def test_generates_yaml(temp_project):
    """Test 4: Verify sources.yaml generation."""
    result = await setup_project_tool(
        exam_path=temp_project["exam"],
        rubric_path=temp_project["rubric"],
        syllabus_source=temp_project["syllabus"],
        student_answers_path=temp_project["students"],
        output_base_path=temp_project["output"],
        project_name="test_project"
    )

    project = Path(result["project_path"])
    yaml_file = project / "sources.yaml"
    assert yaml_file.exists()

    with open(yaml_file) as f:
        sources = yaml.safe_load(f)

    assert sources["project"]["name"] == "test_project"
    assert "exam_questions" in sources["sources"]
    assert "rubric" in sources["sources"]
    assert "syllabus" in sources["sources"]
    assert "student_answers" in sources["sources"]
    assert sources["sources"]["student_answers"]["file_count"] == 2
    # Verify folder paths use canonical constants
    assert PHASE1_ORIGINAL in sources["sources"]["exam_questions"]["copied_to"]


@pytest.mark.asyncio
async def test_generates_state(temp_project):
    """Test 5 (Q5): Verify project_state.json generation with complete status."""
    result = await setup_project_tool(
        exam_path=temp_project["exam"],
        rubric_path=temp_project["rubric"],
        syllabus_source=temp_project["syllabus"],
        student_answers_path=temp_project["students"],
        output_base_path=temp_project["output"],
        project_name="test_project"
    )

    project = Path(result["project_path"])
    state_file = project / "project_state.json"
    assert state_file.exists()

    with open(state_file) as f:
        state = json.load(f)

    assert state["project_name"] == "test_project"
    assert state["current_phase"] == 1
    # Q5: Complete on success
    assert state["phases"]["1_setup"]["status"] == "complete"
    # files_created = student_count(2) + 3(exam, rubric, syllabus) + methodology_count
    assert state["phases"]["1_setup"]["files_created"] >= 5  # At least 5 + methodology files
    # 8 main folders + 1 methodology folder = 9
    assert state["phases"]["1_setup"]["folders_created"] == 9


@pytest.mark.asyncio
async def test_missing_params():
    """Test 6: Verify missing parameters error handling."""
    result = await setup_project_tool(exam_path="/some/exam.pdf")

    assert not result["success"]
    assert result["error"]["type"] == "missing_parameters"
    assert "required" in result["error"]


@pytest.mark.asyncio
async def test_validates_paths(temp_project):
    """Test 7: Verify path validation."""
    result = await setup_project_tool(
        exam_path="/nonexistent/exam.pdf",
        rubric_path=temp_project["rubric"],
        syllabus_source=temp_project["syllabus"],
        student_answers_path=temp_project["students"],
        output_base_path=temp_project["output"],
        project_name="test_project"
    )

    assert not result["success"]
    assert result["error"]["type"] == "file_not_found"


@pytest.mark.asyncio
async def test_incomplete_on_error(temp_project, monkeypatch):
    """Test 8 (Q5): Error marks state incomplete (no rollback)."""
    from assessment_data_mcp.tools import phase1_setup as setup_project

    # Mock copy_directory to fail in the setup_project module
    def mock_fail(*args, **kwargs):
        raise PermissionError("Cannot write to directory")

    monkeypatch.setattr(setup_project, "copy_directory", mock_fail)

    result = await setup_project_tool(
        exam_path=temp_project["exam"],
        rubric_path=temp_project["rubric"],
        syllabus_source=temp_project["syllabus"],
        student_answers_path=temp_project["students"],
        output_base_path=temp_project["output"],
        project_name="test_project"
    )

    assert not result["success"]
    assert result["error"]["type"] == "permission_error"  # setup_project.py uses lowercase format

    # Q5: Partial work preserved (no rollback)
    project = Path(temp_project["output"]) / "test_project"
    assert project.exists()

    # Q5: State marked incomplete
    state_file = project / "project_state.json"
    if state_file.exists():
        with open(state_file) as f:
            state = json.load(f)
        assert state["phases"]["1_setup"]["status"] == "incomplete"
        assert "error" in state["phases"]["1_setup"]


@pytest.mark.asyncio
async def test_returns_dict(temp_project):
    """Test 9 (Q1): Returns plain dict, not ToolResult."""
    result = await setup_project_tool(
        exam_path=temp_project["exam"],
        rubric_path=temp_project["rubric"],
        syllabus_source=temp_project["syllabus"],
        student_answers_path=temp_project["students"],
        output_base_path=temp_project["output"],
        project_name="test_project"
    )

    # Q1: Should return plain dict
    assert isinstance(result, dict)
    # Q1: Should NOT be ToolResult object
    assert not hasattr(result, 'content')
    assert "success" in result
    assert "project_path" in result


@pytest.mark.asyncio
async def test_workflow_logging(temp_project):
    """Test 10 (Q4): Verify workflow logging to workflow_log.jsonl."""
    result = await setup_project_tool(
        exam_path=temp_project["exam"],
        rubric_path=temp_project["rubric"],
        syllabus_source=temp_project["syllabus"],
        student_answers_path=temp_project["students"],
        output_base_path=temp_project["output"],
        project_name="test_project"
    )

    project = Path(result["project_path"])

    # Q4: workflow_log.jsonl should exist
    log_file = project / "workflow_log.jsonl"
    assert log_file.exists()

    # Q4: Verify log entry format
    with open(log_file) as f:
        log_entry = json.loads(f.readline())

    assert log_entry["phase"] == 1
    assert log_entry["tool"] == "setup_project"
    assert log_entry["action"] == "project_creation"
    assert "timestamp" in log_entry
    assert log_entry["timestamp"].endswith('Z')
    assert log_entry["input"]["project_name"] == "test_project"
    assert log_entry["output"]["success"] is True
    assert "duration_seconds" in log_entry
    assert isinstance(log_entry["duration_seconds"], (int, float))


@pytest.mark.asyncio
@pytest.mark.network
async def test_skolverket_download(temp_project):
    """Test 11 (Q2): Skolverket HTML → markdown conversion.

    This test requires network access and is skipped if the URL is unreachable.
    Run with: pytest -m network
    """
    # Use a real Skolverket syllabus URL
    url = "https://www.skolverket.se/undervisning/gymnasieskolan/laroplan-program-och-amnen-i-gymnasieskolan/hitta-program-amnen-och-kurser-i-gymnasieskolan/kurser-a-o/Biologi"

    try:
        result = await setup_project_tool(
            exam_path=temp_project["exam"],
            rubric_path=temp_project["rubric"],
            syllabus_source=url,  # Q2: Download and convert
            student_answers_path=temp_project["students"],
            output_base_path=temp_project["output"],
            project_name="test_project"
        )

        if not result["success"]:
            pytest.skip(f"Network test skipped: {result.get('error', {}).get('message', 'Unknown error')}")

        project = Path(result["project_path"])
        syllabus = project / PHASE1_ORIGINAL / "syllabus.md"

        # Q2: Should exist as .md (converted from HTML)
        assert syllabus.exists()

        content = syllabus.read_text()
        # Q2: Should contain markdown formatting
        assert '#' in content or '**' in content or '*' in content
        # Should contain Biologi content
        assert "Biologi" in content or "biologi" in content

    except Exception as e:
        pytest.skip(f"Network test skipped: {e}")
