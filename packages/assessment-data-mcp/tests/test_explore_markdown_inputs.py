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


@pytest.mark.asyncio
async def test_unreadable_subdirectory_does_not_stop_the_scan(tmp_path):
    """A folder the teacher cannot read must be skipped, not abort the scan.

    Volumes carry folders such as .Spotlight-V100 that deny access. Counting
    answer files must survive them.
    """
    answers = tmp_path / "svar"
    answers.mkdir()
    for name in ("student-a.md", "student-b.md"):
        (answers / name).write_text("Svar.\n")
    closed = tmp_path / "private"
    closed.mkdir()
    closed.chmod(0o000)
    try:
        result = await explore_directory_tool(str(tmp_path))
    finally:
        closed.chmod(0o700)
    assert result["suggestions"]["student_answers_path"].endswith("svar")


@pytest.mark.asyncio
async def test_the_folder_with_most_answers_wins_over_a_notes_folder(tmp_path):
    """Counting Markdown made ordinary material folders candidates too.

    The suggestion must be the folder that looks most like a set of answers,
    not whichever folder the file system happens to list last.
    """
    (tmp_path / "prov.md").write_text("# Prov\n")
    answers = tmp_path / "01_student_answers"
    answers.mkdir()
    for name in ("student-a.md", "student-b.md", "student-c.md", "student-d.md"):
        (answers / name).write_text("Svar.\n")
    notes = tmp_path / "kursmaterial"
    notes.mkdir()
    for name in ("lecture-1.md", "lecture-2.md", "lecture-3.md"):
        (notes / name).write_text("Anteckningar.\n")
    result = await explore_directory_tool(str(tmp_path))
    assert result["suggestions"]["student_answers_path"].endswith("01_student_answers")


@pytest.mark.asyncio
async def test_a_matching_pdf_is_preferred_over_a_markdown_near_miss(tmp_path):
    """Both file-name heuristics must read the formats in the same order."""
    (tmp_path / "Dugga_2.pdf").write_bytes(b"%PDF-1.4\n")
    (tmp_path / "provschema.md").write_text("# Schema\n")
    result = await explore_directory_tool(str(tmp_path))
    assert result["suggestions"]["exam_path"].endswith("Dugga_2.pdf")
