"""The default methodology folder honours METHODOLOGY_PATH.

A packaged installation lets the teacher point both servers at an editable
methodology folder. The TypeScript loader already reads METHODOLOGY_PATH; the
Python tools must resolve the same setting, and treat an empty value as unset
because an optional MCPB setting left blank is passed through as "".
"""

from pathlib import Path

import pytest

from assessment_data_mcp.tools.phase1_explore import _scan_methodology_files
from assessment_data_mcp.tools.phase1_setup import setup_project_tool
from assessment_data_mcp.utils.methodology_path import default_methodology_folder

REPO_METHODOLOGY = Path(__file__).resolve().parents[3] / "methodology"


@pytest.fixture
def custom_methodology(tmp_path):
    folder = tmp_path / "my_methodology"
    (folder / "pedagogical").mkdir(parents=True)
    (folder / "pedagogical" / "custom_marker.md").write_text("# Custom\n")
    return folder


def test_defaults_to_repository_methodology_when_unset(monkeypatch):
    monkeypatch.delenv("METHODOLOGY_PATH", raising=False)
    assert default_methodology_folder() == REPO_METHODOLOGY
    assert (REPO_METHODOLOGY / "pedagogical" / "00_foundation.md").is_file()


def test_empty_value_is_treated_as_unset(monkeypatch):
    monkeypatch.setenv("METHODOLOGY_PATH", "")
    assert default_methodology_folder() == REPO_METHODOLOGY


def test_uses_methodology_path_when_set(monkeypatch, custom_methodology):
    monkeypatch.setenv("METHODOLOGY_PATH", str(custom_methodology))
    assert default_methodology_folder() == custom_methodology


def test_methodology_listing_follows_setting(monkeypatch, custom_methodology):
    monkeypatch.setenv("METHODOLOGY_PATH", str(custom_methodology))
    listed = [name for name, _size in _scan_methodology_files()]
    assert listed == [str(Path("pedagogical") / "custom_marker.md")]


@pytest.mark.asyncio
async def test_project_setup_copies_from_setting(monkeypatch, tmp_path, custom_methodology):
    monkeypatch.setenv("METHODOLOGY_PATH", str(custom_methodology))
    exam = tmp_path / "exam.pdf"
    exam.write_text("fabricated exam")
    rubric = tmp_path / "rubric.pdf"
    rubric.write_text("fabricated rubric")
    syllabus = tmp_path / "syllabus.md"
    syllabus.write_text("# Fabricated syllabus\n")
    students = tmp_path / "students"
    students.mkdir()
    (students / "student1.pdf").write_text("fabricated answer")
    output = tmp_path / "output"
    output.mkdir()

    result = await setup_project_tool(
        exam_path=str(exam),
        rubric_path=str(rubric),
        syllabus_source=str(syllabus),
        student_answers_path=str(students),
        output_base_path=str(output),
        project_name="methodology_setting_project",
    )

    assert result["success"], result
    copied = Path(result["project_path"]) / "methodology"
    assert (copied / "pedagogical" / "custom_marker.md").is_file()
    assert not (copied / "pedagogical" / "00_foundation.md").exists()
