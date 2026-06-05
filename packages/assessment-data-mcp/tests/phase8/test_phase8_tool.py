"""
Tests for Phase 8 MCP tool - phase8_quantitative.

RFC-018: Input from 07_analytic_student/Analytic_*.md
Output to 08_quantitative/Student_*_quantitative.json
"""

import pytest
import json
from pathlib import Path
import tempfile
import shutil

from assessment_data_mcp.tools.phase8_quantitative import phase8_quantitative_tool
from assessment_data_mcp.constants.folders import (
    PHASE7_STUDENT,
    PHASE8_QUANTITATIVE,
)


# Copy fixtures to temp project structure
FIXTURES_DIR = Path(__file__).parent / "fixtures" / "student_reports"


@pytest.fixture
def temp_project(tmp_path):
    """Create temporary project with student reports."""
    project = tmp_path / "test_project"
    project.mkdir()

    # Create input directory (RFC-018: 07_analytic_student/)
    reports_dir = project / PHASE7_STUDENT
    reports_dir.mkdir()

    # Copy fixture files (RFC-018: Analytic_*.md)
    for fixture in FIXTURES_DIR.glob("Analytic_*.md"):
        shutil.copy(fixture, reports_dir)

    return project


class TestPhase8QuantitativeTool:
    """Test phase8_quantitative MCP tool."""

    @pytest.mark.asyncio
    async def test_process_all_students(self, temp_project):
        """Process all students in project."""
        result = await phase8_quantitative_tool(
            project_path=str(temp_project),
            dry_run=False
        )

        assert result["success"] is True
        assert result["processed"] == 2  # TestElev01 and TestElev02
        assert len(result["outputs"]) == 2
        assert len(result["summaries"]) == 2

    @pytest.mark.asyncio
    async def test_process_single_student(self, temp_project):
        """Process specific student."""
        result = await phase8_quantitative_tool(
            project_path=str(temp_project),
            student_id="TestElev01",
            dry_run=False
        )

        assert result["success"] is True
        assert result["processed"] == 1
        assert len(result["outputs"]) == 1
        assert "TestElev01" in result["outputs"][0]

    @pytest.mark.asyncio
    async def test_dry_run_no_files(self, temp_project):
        """Dry run validates but doesn't write files."""
        result = await phase8_quantitative_tool(
            project_path=str(temp_project),
            dry_run=True
        )

        assert result["success"] is True
        assert result["processed"] == 2
        assert len(result["outputs"]) == 0  # No files written
        assert result["dry_run"] is True

        # Output directory should not exist
        output_dir = temp_project / PHASE8_QUANTITATIVE
        assert not output_dir.exists()

    @pytest.mark.asyncio
    async def test_creates_output_directory(self, temp_project):
        """Tool creates output directory."""
        result = await phase8_quantitative_tool(
            project_path=str(temp_project),
            dry_run=False
        )

        output_dir = temp_project / PHASE8_QUANTITATIVE
        assert output_dir.exists()
        assert len(list(output_dir.glob("*.json"))) == 2

    @pytest.mark.asyncio
    async def test_json_output_structure(self, temp_project):
        """Generated JSON has correct structure."""
        await phase8_quantitative_tool(
            project_path=str(temp_project),
            dry_run=False
        )

        json_file = temp_project / PHASE8_QUANTITATIVE / "Student_TestElev01_quantitative.json"
        assert json_file.exists()

        with open(json_file) as f:
            data = json.load(f)

        # Required fields
        assert data["student_id"] == "TestElev01"
        assert "total_points" in data
        assert "max_points" in data
        assert "percentage" in data
        assert "questions_answered" in data
        assert "questions" in data
        assert "metadata" in data

        # Questions should be an array of dicts
        assert isinstance(data["questions"], list)
        assert len(data["questions"]) > 0
        for q in data["questions"]:
            assert "question_id" in q
            assert "points" in q
            assert "max_points" in q

        # Metadata structure
        assert "source" in data["metadata"]
        assert "strategy" in data["metadata"]

    @pytest.mark.asyncio
    async def test_summaries_in_response(self, temp_project):
        """Response includes student summaries."""
        result = await phase8_quantitative_tool(
            project_path=str(temp_project),
            dry_run=False
        )

        summaries = result["summaries"]
        assert len(summaries) == 2

        # Check summary structure
        for summary in summaries:
            assert "student_id" in summary
            assert "total_points" in summary
            assert "percentage" in summary

    @pytest.mark.asyncio
    async def test_missing_reports_directory(self, tmp_path):
        """Handle missing reports directory."""
        project = tmp_path / "empty_project"
        project.mkdir()

        result = await phase8_quantitative_tool(
            project_path=str(project),
            dry_run=False
        )

        assert result["success"] is False
        assert "No students found" in result["error"]

    @pytest.mark.asyncio
    async def test_nonexistent_project(self):
        """Handle nonexistent project path."""
        result = await phase8_quantitative_tool(
            project_path="/nonexistent/path",
            dry_run=False
        )

        assert result["success"] is False
        assert "does not exist" in result["error"]

    @pytest.mark.asyncio
    async def test_custom_directories(self, temp_project):
        """Support custom output directory."""
        result = await phase8_quantitative_tool(
            project_path=str(temp_project),
            output_dir="custom_output",
            dry_run=False
        )

        assert result["success"] is True
        assert (temp_project / "custom_output").exists()
