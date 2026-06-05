"""
Tests for convert_to_markdown tool - Pure Python PDF to markdown conversion

Tests the pdfplumber-based PDF extraction for Phase 4.
"""

import pytest
from pathlib import Path
import tempfile
import json
from unittest.mock import patch, MagicMock

from assessment_data_mcp.tools.phase2_convert import (
    convert_to_markdown_tool,
    _extract_pdf_to_markdown
)


# Helper to create minimal valid PDF for testing
def create_test_pdf(path: Path, content: str = "Test content"):
    """Create a minimal PDF file that pdfplumber can parse."""
    # This is a minimal PDF structure that pdfplumber can read
    # In real tests, we'll mock pdfplumber instead
    pdf_content = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources 4 0 R /MediaBox [0 0 612 792] >>
endobj
4 0 obj
<< >>
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000214 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
235
%%EOF"""
    path.write_bytes(pdf_content)


@pytest.mark.asyncio
async def test_successful_conversion():
    """Test successful PDF conversion with mocked pdfplumber."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Create input directory with PDF
        input_dir = tmp / "input"
        input_dir.mkdir()
        pdf_file = input_dir / "test.pdf"
        create_test_pdf(pdf_file)

        output_dir = tmp / "output"

        # Mock pdfplumber.open
        mock_page = MagicMock()
        mock_page.extract_text.return_value = "Sample page content"

        mock_pdf = MagicMock()
        mock_pdf.pages = [mock_page]
        mock_pdf.__enter__ = MagicMock(return_value=mock_pdf)
        mock_pdf.__exit__ = MagicMock(return_value=False)

        with patch('pdfplumber.open', return_value=mock_pdf):
            result = await convert_to_markdown_tool(
                input_dir=str(input_dir),
                output_dir=str(output_dir),
                quiet=False
            )

        assert result["success"] is True
        assert result["files_processed"] == 1
        assert str(output_dir) in result["output_directory"]
        assert result["error"] is None
        assert len(result["converted_files"]) == 1

        # Check output file was created
        output_file = output_dir / "test.md"
        assert output_file.exists()


@pytest.mark.asyncio
async def test_quiet_mode():
    """Test that quiet flag suppresses output."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        input_dir = tmp / "input"
        input_dir.mkdir()
        pdf_file = input_dir / "test.pdf"
        create_test_pdf(pdf_file)

        output_dir = tmp / "output"

        # Mock pdfplumber
        mock_page = MagicMock()
        mock_page.extract_text.return_value = "Content"

        mock_pdf = MagicMock()
        mock_pdf.pages = [mock_page]
        mock_pdf.__enter__ = MagicMock(return_value=mock_pdf)
        mock_pdf.__exit__ = MagicMock(return_value=False)

        with patch('pdfplumber.open', return_value=mock_pdf):
            # In quiet mode, no print statements should occur
            result = await convert_to_markdown_tool(
                input_dir=str(input_dir),
                output_dir=str(output_dir),
                quiet=True
            )

        assert result["success"] is True
        assert result["files_processed"] == 1


@pytest.mark.asyncio
async def test_input_directory_not_found():
    """Test that FileNotFoundError is raised for non-existent directory."""
    with pytest.raises(FileNotFoundError, match="Input directory not found"):
        await convert_to_markdown_tool(
            input_dir="/nonexistent/directory",
            output_dir="/some/output"
        )


@pytest.mark.asyncio
async def test_input_path_not_directory():
    """Test that ValueError is raised when input is a file, not directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        file = tmp / "test.txt"
        file.write_text("not a directory")

        with pytest.raises(ValueError, match="not a directory"):
            await convert_to_markdown_tool(
                input_dir=str(file),
                output_dir=str(tmp / "output")
            )


@pytest.mark.asyncio
async def test_no_files_in_directory():
    """Test that ValueError is raised when directory has no files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        input_dir = tmp / "input"
        input_dir.mkdir()
        # Empty directory - no files at all

        with pytest.raises(ValueError, match="No files found"):
            await convert_to_markdown_tool(
                input_dir=str(input_dir),
                output_dir=str(tmp / "output")
            )


@pytest.mark.asyncio
async def test_output_directory_created():
    """Test that output directory is created if it doesn't exist."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        input_dir = tmp / "input"
        input_dir.mkdir()
        pdf_file = input_dir / "test.pdf"
        create_test_pdf(pdf_file)

        output_dir = tmp / "output" / "nested" / "directory"

        # Mock pdfplumber
        mock_page = MagicMock()
        mock_page.extract_text.return_value = "Content"

        mock_pdf = MagicMock()
        mock_pdf.pages = [mock_page]
        mock_pdf.__enter__ = MagicMock(return_value=mock_pdf)
        mock_pdf.__exit__ = MagicMock(return_value=False)

        with patch('pdfplumber.open', return_value=mock_pdf):
            result = await convert_to_markdown_tool(
                input_dir=str(input_dir),
                output_dir=str(output_dir)
            )

        assert output_dir.exists()
        assert result["success"] is True


@pytest.mark.asyncio
async def test_conversion_failure():
    """Test handling of failed conversion (pdfplumber exception)."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        input_dir = tmp / "input"
        input_dir.mkdir()
        pdf_file = input_dir / "test.pdf"
        create_test_pdf(pdf_file)

        output_dir = tmp / "output"

        # Mock pdfplumber to raise exception
        with patch('pdfplumber.open', side_effect=Exception("Invalid PDF structure")):
            result = await convert_to_markdown_tool(
                input_dir=str(input_dir),
                output_dir=str(output_dir)
            )

        # Should return partial success (all failed)
        assert result["success"] is False
        assert result["files_processed"] == 0
        assert "Invalid PDF structure" in result["error"]


@pytest.mark.asyncio
async def test_multiple_pdfs():
    """Test converting multiple PDF files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        input_dir = tmp / "input"
        input_dir.mkdir()

        # Create multiple PDFs
        for i in range(3):
            create_test_pdf(input_dir / f"test{i}.pdf")

        output_dir = tmp / "output"

        # Mock pdfplumber
        mock_page = MagicMock()
        mock_page.extract_text.return_value = "Content"

        mock_pdf = MagicMock()
        mock_pdf.pages = [mock_page]
        mock_pdf.__enter__ = MagicMock(return_value=mock_pdf)
        mock_pdf.__exit__ = MagicMock(return_value=False)

        with patch('pdfplumber.open', return_value=mock_pdf):
            result = await convert_to_markdown_tool(
                input_dir=str(input_dir),
                output_dir=str(output_dir)
            )

        assert result["success"] is True
        assert result["files_processed"] == 3
        assert len(result["converted_files"]) == 3


@pytest.mark.asyncio
async def test_nested_directory_structure():
    """Test that nested directory structure is preserved."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        input_dir = tmp / "input"
        nested_dir = input_dir / "subdir" / "nested"
        nested_dir.mkdir(parents=True)

        pdf_file = nested_dir / "test.pdf"
        create_test_pdf(pdf_file)

        output_dir = tmp / "output"

        # Mock pdfplumber
        mock_page = MagicMock()
        mock_page.extract_text.return_value = "Content"

        mock_pdf = MagicMock()
        mock_pdf.pages = [mock_page]
        mock_pdf.__enter__ = MagicMock(return_value=mock_pdf)
        mock_pdf.__exit__ = MagicMock(return_value=False)

        with patch('pdfplumber.open', return_value=mock_pdf):
            result = await convert_to_markdown_tool(
                input_dir=str(input_dir),
                output_dir=str(output_dir)
            )

        assert result["success"] is True

        # Check that nested structure is preserved
        expected_output = output_dir / "subdir" / "nested" / "test.md"
        assert expected_output.exists()


@pytest.mark.asyncio
async def test_partial_conversion_success():
    """Test that some files convert successfully while others fail."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        input_dir = tmp / "input"
        input_dir.mkdir()

        # Create multiple PDFs
        for i in range(3):
            create_test_pdf(input_dir / f"test{i}.pdf")

        output_dir = tmp / "output"

        # Mock pdfplumber to fail on second file
        call_count = 0
        def mock_open_side_effect(path):
            nonlocal call_count
            call_count += 1
            if call_count == 2:
                raise Exception("Corrupted PDF")

            mock_page = MagicMock()
            mock_page.extract_text.return_value = "Content"

            mock_pdf = MagicMock()
            mock_pdf.pages = [mock_page]
            mock_pdf.__enter__ = MagicMock(return_value=mock_pdf)
            mock_pdf.__exit__ = MagicMock(return_value=False)
            return mock_pdf

        with patch('pdfplumber.open', side_effect=mock_open_side_effect):
            result = await convert_to_markdown_tool(
                input_dir=str(input_dir),
                output_dir=str(output_dir)
            )

        # Partial success
        assert result["success"] is True
        assert result["files_processed"] == 2
        assert "Partial success" in result["error"]
        assert "Corrupted PDF" in result["error"]


@pytest.mark.asyncio
async def test_copy_non_pdf_files():
    """Test that .md files are copied to output directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        input_dir = tmp / "input"
        input_dir.mkdir()

        # Create .md file and PDF file
        (input_dir / "rubric.md").write_text("# Rubric content")
        create_test_pdf(input_dir / "exam.pdf")

        output_dir = tmp / "output"

        # Mock pdfplumber
        mock_page = MagicMock()
        mock_page.extract_text.return_value = "Exam content"

        mock_pdf = MagicMock()
        mock_pdf.pages = [mock_page]
        mock_pdf.__enter__ = MagicMock(return_value=mock_pdf)
        mock_pdf.__exit__ = MagicMock(return_value=False)

        with patch('pdfplumber.open', return_value=mock_pdf):
            result = await convert_to_markdown_tool(
                input_dir=str(input_dir),
                output_dir=str(output_dir)
            )

        assert result["success"] is True
        assert result["files_processed"] == 2  # 1 .md file + 1 PDF

        # Check both files exist in output
        assert (output_dir / "rubric.md").exists()
        assert (output_dir / "exam.md").exists()


@pytest.mark.asyncio
async def test_copy_all_file_types():
    """Test that all non-PDF file types are copied."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        input_dir = tmp / "input"
        input_dir.mkdir()

        # Create various file types
        (input_dir / "notes.txt").write_text("Text notes")
        (input_dir / "data.json").write_text('{"key": "value"}')
        (input_dir / "syllabus.md").write_text("# Syllabus")

        output_dir = tmp / "output"

        result = await convert_to_markdown_tool(
            input_dir=str(input_dir),
            output_dir=str(output_dir)
        )

        assert result["success"] is True
        assert result["files_processed"] == 3

        # Check all files were copied
        assert (output_dir / "notes.txt").exists()
        assert (output_dir / "data.json").exists()
        assert (output_dir / "syllabus.md").exists()


@pytest.mark.asyncio
async def test_conflict_resolution():
    """Test that PDF conversion is skipped when .md file already exists (IDEMPOTENCY)."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        input_dir = tmp / "input"
        input_dir.mkdir()

        # Create both exam.md and exam.pdf - CONFLICT!
        (input_dir / "exam.md").write_text("# Original markdown exam")
        create_test_pdf(input_dir / "exam.pdf")

        output_dir = tmp / "output"

        # Mock pdfplumber
        mock_page = MagicMock()
        mock_page.extract_text.return_value = "PDF exam content"

        mock_pdf = MagicMock()
        mock_pdf.pages = [mock_page]
        mock_pdf.__enter__ = MagicMock(return_value=mock_pdf)
        mock_pdf.__exit__ = MagicMock(return_value=False)

        with patch('pdfplumber.open', return_value=mock_pdf):
            result = await convert_to_markdown_tool(
                input_dir=str(input_dir),
                output_dir=str(output_dir)
            )

        assert result["success"] is True
        # Both files counted (md copied + pdf skipped as already exists)
        assert result["files_processed"] == 2

        # Original .md file is preserved
        assert (output_dir / "exam.md").exists()
        original_content = (output_dir / "exam.md").read_text()
        assert "Original markdown exam" in original_content

        # IDEMPOTENCY: PDF conversion is skipped when output .md already exists
        # No _converted.md suffix is created


@pytest.mark.asyncio
async def test_only_non_pdf_files():
    """Test that tool works with directory containing only non-PDF files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        input_dir = tmp / "input"
        input_dir.mkdir()

        # Only non-PDF files
        (input_dir / "rubric.md").write_text("# Rubric")
        (input_dir / "syllabus.md").write_text("# Syllabus")
        (input_dir / "notes.txt").write_text("Notes")

        output_dir = tmp / "output"

        result = await convert_to_markdown_tool(
            input_dir=str(input_dir),
            output_dir=str(output_dir)
        )

        assert result["success"] is True
        assert result["files_processed"] == 3
        assert result["error"] is None

        # All files should be copied
        assert (output_dir / "rubric.md").exists()
        assert (output_dir / "syllabus.md").exists()
        assert (output_dir / "notes.txt").exists()


def test_extract_pdf_to_markdown_basic():
    """Test the _extract_pdf_to_markdown helper function."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        pdf_file = tmp / "test.pdf"
        create_test_pdf(pdf_file)

        # Mock pdfplumber
        mock_page1 = MagicMock()
        mock_page1.extract_text.return_value = "Page 1 content"

        mock_page2 = MagicMock()
        mock_page2.extract_text.return_value = "Page 2 content"

        mock_pdf = MagicMock()
        mock_pdf.pages = [mock_page1, mock_page2]
        mock_pdf.__enter__ = MagicMock(return_value=mock_pdf)
        mock_pdf.__exit__ = MagicMock(return_value=False)

        with patch('pdfplumber.open', return_value=mock_pdf):
            result = _extract_pdf_to_markdown(pdf_file, quiet=True)

        # Check markdown structure
        assert "# PDF: test.pdf" in result
        assert "## Page 1" in result
        assert "Page 1 content" in result
        assert "## Page 2" in result
        assert "Page 2 content" in result
        assert "---" in result  # Page separator


def test_extract_pdf_to_markdown_empty_page():
    """Test handling of pages with no text content."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        pdf_file = tmp / "test.pdf"
        create_test_pdf(pdf_file)

        # Mock page with no text
        mock_page = MagicMock()
        mock_page.extract_text.return_value = None

        mock_pdf = MagicMock()
        mock_pdf.pages = [mock_page]
        mock_pdf.__enter__ = MagicMock(return_value=mock_pdf)
        mock_pdf.__exit__ = MagicMock(return_value=False)

        with patch('pdfplumber.open', return_value=mock_pdf):
            result = _extract_pdf_to_markdown(pdf_file, quiet=True)

        assert "## Page 1" in result
        assert "*[No text content on this page]*" in result


def test_extract_pdf_to_markdown_exception():
    """Test that exceptions during extraction are properly raised."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        pdf_file = tmp / "test.pdf"
        create_test_pdf(pdf_file)

        # Mock pdfplumber to raise exception
        with patch('pdfplumber.open', side_effect=Exception("PDF read error")):
            with pytest.raises(RuntimeError, match="Failed to extract text"):
                _extract_pdf_to_markdown(pdf_file, quiet=True)


@pytest.mark.asyncio
async def test_state_tracking_success():
    """Test that successful conversion updates project_state.json."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Create project structure with state file
        project_path = tmp / "test_project"
        project_path.mkdir()

        # Create initial state
        state = {
            "version": "1.0",
            "project_name": "test_project",
            "created": "2025-12-26T10:00:00Z",
            "last_updated": "2025-12-26T10:00:00Z",
            "current_phase": 1,
            "phases": {
                "1_setup": {
                    "status": "complete",
                    "timestamp": "2025-12-26T10:00:00Z"
                }
            }
        }

        state_file = project_path / "project_state.json"
        with open(state_file, 'w') as f:
            json.dump(state, f)

        # Create input/output dirs
        input_dir = project_path / "01_original"
        input_dir.mkdir()
        create_test_pdf(input_dir / "test.pdf")

        output_dir = project_path / "02_markdown"

        # Mock pdfplumber
        mock_page = MagicMock()
        mock_page.extract_text.return_value = "Content"

        mock_pdf = MagicMock()
        mock_pdf.pages = [mock_page]
        mock_pdf.__enter__ = MagicMock(return_value=mock_pdf)
        mock_pdf.__exit__ = MagicMock(return_value=False)

        with patch('pdfplumber.open', return_value=mock_pdf):
            result = await convert_to_markdown_tool(
                input_dir=str(input_dir),
                output_dir=str(output_dir)
            )

        assert result["success"] is True

        # Check state was updated
        with open(state_file, 'r') as f:
            updated_state = json.load(f)

        assert "2_convert" in updated_state["phases"]
        assert updated_state["phases"]["2_convert"]["status"] == "complete"
        assert updated_state["phases"]["2_convert"]["files_processed"] == 1
        assert updated_state["current_phase"] == 2

        # Check workflow log exists
        log_file = project_path / "workflow_log.jsonl"
        assert log_file.exists()

        with open(log_file, 'r') as f:
            log_entries = [json.loads(line) for line in f]

        assert len(log_entries) == 1
        assert log_entries[0]["phase"] == 2
        assert log_entries[0]["tool"] == "convert_to_markdown"
        assert log_entries[0]["action"] == "pdf_conversion"


@pytest.mark.asyncio
async def test_state_tracking_with_errors():
    """Test that failed conversion marks state as incomplete."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Create project with state
        project_path = tmp / "test_project"
        project_path.mkdir()

        state = {
            "version": "1.0",
            "project_name": "test_project",
            "created": "2025-12-26T10:00:00Z",
            "last_updated": "2025-12-26T10:00:00Z",
            "current_phase": 1,
            "phases": {
                "1_setup": {"status": "complete"}
            }
        }

        state_file = project_path / "project_state.json"
        with open(state_file, 'w') as f:
            json.dump(state, f)

        input_dir = project_path / "01_original"
        input_dir.mkdir()
        create_test_pdf(input_dir / "test.pdf")

        output_dir = project_path / "02_markdown"

        # Mock pdfplumber to fail
        with patch('pdfplumber.open', side_effect=Exception("PDF error")):
            result = await convert_to_markdown_tool(
                input_dir=str(input_dir),
                output_dir=str(output_dir)
            )

        assert result["success"] is False

        # Check state marked as incomplete
        with open(state_file, 'r') as f:
            updated_state = json.load(f)

        assert updated_state["phases"]["2_convert"]["status"] == "incomplete"
        assert "error" in updated_state["phases"]["2_convert"]


@pytest.mark.asyncio
async def test_conversion_without_state_file():
    """Test that conversion works even without project_state.json."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Create input dir WITHOUT state file (not a managed project)
        input_dir = tmp / "standalone" / "input"
        input_dir.mkdir(parents=True)
        create_test_pdf(input_dir / "test.pdf")

        output_dir = tmp / "standalone" / "output"

        # Mock pdfplumber
        mock_page = MagicMock()
        mock_page.extract_text.return_value = "Content"

        mock_pdf = MagicMock()
        mock_pdf.pages = [mock_page]
        mock_pdf.__enter__ = MagicMock(return_value=mock_pdf)
        mock_pdf.__exit__ = MagicMock(return_value=False)

        with patch('pdfplumber.open', return_value=mock_pdf):
            result = await convert_to_markdown_tool(
                input_dir=str(input_dir),
                output_dir=str(output_dir)
            )

        # Should still succeed
        assert result["success"] is True
        assert result["files_processed"] == 1

        # No state file should be created
        assert not (tmp / "standalone" / "project_state.json").exists()
