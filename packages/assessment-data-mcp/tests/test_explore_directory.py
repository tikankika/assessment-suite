"""
Tests for explore_directory tool - Pattern matching and confidence scoring

Tests the intelligent file discovery logic from ADR-005.
"""

import pytest
from pathlib import Path
import tempfile
import shutil

from assessment_data_mcp.tools.phase1_explore import explore_directory_tool


@pytest.mark.asyncio
async def test_identify_exam_by_size():
    """Test that large PDFs (>10MB) are identified as exams."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Create a large PDF (>20MB for high confidence)
        large_pdf = tmp / "98100200_exam.pdf"
        large_pdf.write_bytes(b"x" * (25 * 1024 * 1024))  # 25MB

        # Create small PDF (should be ignored)
        small_pdf = tmp / "small.pdf"
        small_pdf.write_bytes(b"x" * (1 * 1024 * 1024))  # 1MB

        result = await explore_directory_tool(str(tmp))

        assert "exam_path" in result["suggestions"]
        assert "98100200_exam.pdf" in result["suggestions"]["exam_path"]
        assert result["confidence_scores"]["exam"] == "high"


@pytest.mark.asyncio
async def test_identify_exam_medium_confidence():
    """Test that medium-sized PDFs (10-20MB) get medium confidence."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Create medium PDF (15MB)
        medium_pdf = tmp / "exam_questions.pdf"
        medium_pdf.write_bytes(b"x" * (15 * 1024 * 1024))  # 15MB

        result = await explore_directory_tool(str(tmp))

        assert "exam_path" in result["suggestions"]
        assert result["confidence_scores"]["exam"] == "medium"


@pytest.mark.asyncio
async def test_identify_rubric_by_name():
    """Test that files with 'rubric' in name are identified."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Create rubric files with different patterns
        (tmp / "Rubric_COURSE_BIO2.md").write_text("# Rubric")
        (tmp / "bedömningsmatris.pdf").write_bytes(b"x" * 100)

        result = await explore_directory_tool(str(tmp))

        assert "rubric_path" in result["suggestions"]
        assert result["confidence_scores"]["rubric"] == "high"

        # Should match either file (both contain rubric patterns)
        rubric_file = result["suggestions"]["rubric_path"]
        assert "Rubric" in rubric_file or "bedömning" in rubric_file or "matris" in rubric_file


@pytest.mark.asyncio
async def test_identify_student_directory_inspera():
    """Test that directories with 'inspera' are identified (high confidence)."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Create Inspera directory with student PDFs
        inspera_dir = tmp / "InsperaAssessment_1412035715"
        inspera_dir.mkdir()
        (inspera_dir / "student1.pdf").write_bytes(b"x" * 100)
        (inspera_dir / "student2.pdf").write_bytes(b"x" * 100)

        result = await explore_directory_tool(str(tmp))

        assert "student_answers_path" in result["suggestions"]
        assert "Inspera" in result["suggestions"]["student_answers_path"]
        assert result["confidence_scores"]["students"] == "high"


@pytest.mark.asyncio
async def test_identify_student_directory_multiple_pdfs():
    """Test that directories with >1 PDF get medium confidence."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Create directory with multiple PDFs (not named 'inspera')
        student_dir = tmp / "student_submissions"
        student_dir.mkdir()
        (student_dir / "answer1.pdf").write_bytes(b"x" * 100)
        (student_dir / "answer2.pdf").write_bytes(b"x" * 100)
        (student_dir / "answer3.pdf").write_bytes(b"x" * 100)

        result = await explore_directory_tool(str(tmp))

        assert "student_answers_path" in result["suggestions"]
        assert result["confidence_scores"]["students"] == "medium"


@pytest.mark.asyncio
async def test_confidence_scoring_all_found():
    """Test that finding all 3 files gives 'high' overall confidence."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Create all required files
        # 1. Exam (large PDF)
        (tmp / "exam.pdf").write_bytes(b"x" * (25 * 1024 * 1024))

        # 2. Rubric
        (tmp / "Rubric.md").write_text("# Rubric")

        # 3. Student directory
        inspera = tmp / "InsperaAssessment_XXX"
        inspera.mkdir()
        (inspera / "s1.pdf").write_bytes(b"x" * 100)

        result = await explore_directory_tool(str(tmp))

        assert len(result["suggestions"]) == 3
        assert result["overall_confidence"] == "high"
        assert result["ready_for_auto_setup"] is True


@pytest.mark.asyncio
async def test_confidence_scoring_two_found():
    """Test that finding 2/3 files gives 'medium' overall confidence."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Create only exam and rubric (no students)
        (tmp / "exam.pdf").write_bytes(b"x" * (25 * 1024 * 1024))
        (tmp / "Rubric.md").write_text("# Rubric")

        result = await explore_directory_tool(str(tmp))

        assert len(result["suggestions"]) == 2
        assert result["overall_confidence"] == "medium"
        assert result["ready_for_auto_setup"] is False


@pytest.mark.asyncio
async def test_missing_files_low_confidence():
    """Test that empty/minimal directories give 'low' overall confidence."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Create only one file (just a rubric)
        (tmp / "Rubric.md").write_text("# Rubric")

        result = await explore_directory_tool(str(tmp))

        assert len(result["suggestions"]) <= 1
        assert result["overall_confidence"] == "low"
        assert result["ready_for_auto_setup"] is False


@pytest.mark.asyncio
async def test_files_found_counts():
    """Test that file counts are correctly reported."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Create various files
        (tmp / "file1.pdf").write_bytes(b"x" * 100)
        (tmp / "file2.pdf").write_bytes(b"x" * 100)
        (tmp / "readme.md").write_text("# README")
        (tmp / "rubric.md").write_text("# Rubric")

        subdir = tmp / "subdirectory"
        subdir.mkdir()

        result = await explore_directory_tool(str(tmp))

        assert result["files_found"]["pdfs"] == 2
        assert result["files_found"]["markdown"] == 2
        assert result["files_found"]["subdirs"] == 1


@pytest.mark.asyncio
async def test_directory_not_found():
    """Test that non-existent directories raise FileNotFoundError."""
    with pytest.raises(FileNotFoundError):
        await explore_directory_tool("/nonexistent/path/to/directory")


@pytest.mark.asyncio
async def test_file_not_directory():
    """Test that passing a file (not directory) raises ValueError."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        file = tmp / "test.txt"
        file.write_text("test")

        with pytest.raises(ValueError, match="not a directory"):
            await explore_directory_tool(str(file))
