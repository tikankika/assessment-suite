"""scan_source_directory must recognise Markdown input, and its guidance must
name the tools that exist.

The fabricated example, and material converted from PDF once, is Markdown. The
scan previously looked for exams among txt, docx and pdf only, counted only
PDFs in a student folder, and told the model to call setup_project, a tool
that is registered as initialize_project.
"""

import subprocess
import sys
from pathlib import Path

import pytest

from assessment_data_mcp.tools.phase1_explore import explore_directory_tool

EXAMPLE_INPUTS = (
    Path(__file__).resolve().parents[3]
    / "examples/biog2000x_immunforsvaret/immune_system_exam/01_original"
)


@pytest.mark.asyncio
async def test_fabricated_example_inputs_are_all_found():
    result = await explore_directory_tool(str(EXAMPLE_INPUTS))
    suggestions = result["suggestions"]
    assert suggestions["exam_path"].endswith("exam_questions.md")
    assert suggestions["rubric_path"].endswith("rubric.md")
    assert suggestions["student_answers_path"].endswith("student_answers")
    assert result["overall_confidence"] == "high"
    assert result["ready_for_auto_setup"] is True


@pytest.mark.asyncio
async def test_markdown_exam_is_found_by_name(tmp_path):
    (tmp_path / "prov_ht26.md").write_text("# Prov\n")
    result = await explore_directory_tool(str(tmp_path))
    assert result["suggestions"]["exam_path"].endswith("prov_ht26.md")


@pytest.mark.asyncio
async def test_folder_with_several_markdown_answers_is_student_folder(tmp_path):
    answers = tmp_path / "svar"
    answers.mkdir()
    for name in ("student-a.md", "student-b.md"):
        (answers / name).write_text("Svar.\n")
    result = await explore_directory_tool(str(tmp_path))
    assert result["suggestions"]["student_answers_path"].endswith("svar")


@pytest.mark.asyncio
async def test_single_markdown_file_in_a_folder_is_not_a_student_folder(tmp_path):
    (tmp_path / "notes").mkdir()
    (tmp_path / "notes" / "readme.md").write_text("Notes.\n")
    result = await explore_directory_tool(str(tmp_path))
    assert "student_answers_path" not in result["suggestions"]


@pytest.mark.asyncio
async def test_guidance_names_the_registered_setup_tool(tmp_path):
    result = await explore_directory_tool(str(tmp_path))
    text = str(result["next_steps"])
    assert "initialize_project" in text
    assert "setup_project" not in text


def test_modules_import_without_syntax_warnings():
    completed = subprocess.run(
        [sys.executable, "-W", "error::SyntaxWarning", "-W", "error::DeprecationWarning",
         "-c", "import assessment_data_mcp.phase7.assessment_format_config"],
        capture_output=True, text=True,
    )
    assert completed.returncode == 0, completed.stderr
