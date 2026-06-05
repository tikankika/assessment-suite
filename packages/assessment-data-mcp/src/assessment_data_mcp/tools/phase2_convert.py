"""
convert_to_markdown.py - PDF to Markdown conversion for Pre-Assessment MCP Server

This tool uses pdfplumber to convert PDF files to markdown format for text analysis.
Pure Python implementation - no external CLI dependencies required.

Workflow:
    01_original/*.pdf → 02_markdown/*.md

See: ROADMAP.md - Phase 4: PDF Conversion (v0.2.0)
See: docs/troubleshooting/ISSUE-002-PHASE2-CLI-DEPENDENCY.md
"""

from pathlib import Path
import pdfplumber
from ..validators import validate_path_security
import shutil
import sys
import time
from typing import List, Optional
from ..utils.state_manager import (
    update_project_state,
    log_workflow_action,
    _get_timestamp
)


def log(msg: str) -> None:
    """Print to stderr to avoid corrupting MCP JSON-RPC stdout."""
    print(msg, file=sys.stderr)


def _get_project_path(input_dir: str) -> Optional[Path]:
    """
    Derive project path from input directory.

    Validates that project_state.json exists at parent directory.

    Args:
        input_dir: Input directory path (e.g., /path/to/project/01_original)

    Returns:
        Path to project root, or None if not a valid project
    """
    try:
        input_path = Path(input_dir).resolve()
        project_path = input_path.parent

        # Check if project_state.json exists
        state_file = project_path / "project_state.json"
        if not state_file.exists():
            return None

        return project_path
    except Exception:
        return None


async def convert_to_markdown_tool(
    input_dir: str,
    output_dir: str,
    quiet: bool = False,
    skip_pdf: bool = False
) -> dict:
    """
    Convert PDF files to markdown and copy all other files to output directory.

    Creates a complete working directory at output_dir containing:
    - PDF files converted to markdown (or copied as-is when skip_pdf=True)
    - All non-PDF files copied directly
    - Conflict resolution: PDFs get _converted.md suffix if .md already exists

    Args:
        input_dir: Directory containing files to process (01_original/)
        output_dir: Output directory for all files (02_markdown/)
        quiet: Suppress progress output (default: False)
        skip_pdf: Copy PDFs as-is without converting to markdown (default: False).
                  Use for lab reports where Claude reads PDFs directly.

    Returns:
        {
            "success": bool,
            "files_processed": int,  # Total files (converted + copied)
            "output_directory": str,
            "converted_files": list[str],
            "error": str | None
        }

    Raises:
        FileNotFoundError: If input directory doesn't exist
        ValueError: If input directory contains no files
        RuntimeError: If file processing fails
    """
    # Start timer for duration tracking
    start_time = time.time()

    # Security: validate paths before any file operations
    for check_path in [input_dir, output_dir]:
        is_safe, security_error = validate_path_security(check_path)
        if not is_safe:
            return {"success": False, "error": f"Security: {security_error}"}

    # Try to determine project path (but don't fail if we can't)
    project_path = _get_project_path(input_dir)

    try:
        # Validate input directory
        input_path = Path(input_dir).resolve()
        if not input_path.exists():
            raise FileNotFoundError(f"Input directory not found: {input_dir}")

        if not input_path.is_dir():
            raise ValueError(f"Input path is not a directory: {input_dir}")

        # Find all files in input directory
        all_files = list(input_path.glob("**/*"))
        all_files = [f for f in all_files if f.is_file()]  # Filter out directories
        if not all_files:
            raise ValueError(f"No files found in: {input_dir}")

        # Categorize files: PDF vs non-PDF
        pdf_files = [f for f in all_files if f.suffix.lower() == '.pdf']
        non_pdf_files = [f for f in all_files if f.suffix.lower() != '.pdf']

        # Create output directory if it doesn't exist
        output_path = Path(output_dir).resolve()
        output_path.mkdir(parents=True, exist_ok=True)

        # Track all processed files
        converted_files = []
        errors = []

        # Copy non-PDF files first
        for source_file in non_pdf_files:
            try:
                # Preserve directory structure
                relative_path = source_file.relative_to(input_path)
                output_file = output_path / relative_path

                # Create subdirectories if needed
                output_file.parent.mkdir(parents=True, exist_ok=True)

                # Copy file
                shutil.copy2(source_file, output_file)

                converted_files.append(str(output_file))

                if not quiet:
                    log(f"Copied: {source_file.name} → {output_file.name}")

            except Exception as e:
                errors.append(f"{source_file.name}: {str(e)}")
                if not quiet:
                    log(f"Error copying {source_file.name}: {e}")

        # Process PDF files: convert to markdown or copy as-is
        for pdf_file in pdf_files:
            try:
                # Preserve directory structure for nested PDFs
                relative_path = pdf_file.relative_to(input_path)

                if skip_pdf:
                    # Copy PDF as-is (for lab reports read directly by Claude)
                    output_file = output_path / relative_path
                    output_file.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(pdf_file, output_file)
                    converted_files.append(str(output_file))
                    if not quiet:
                        log(f"Copied (skip_pdf): {pdf_file.name}")
                else:
                    output_file = output_path / relative_path.with_suffix('.md')

                    # IDEMPOTENCY: Skip if .md already exists (likely from a previous conversion run)
                    if output_file.exists():
                        if not quiet:
                            log(f"Skipped (already exists): {pdf_file.name} → {output_file.name}")
                        converted_files.append(str(output_file))
                        continue

                    # Create subdirectories if needed
                    output_file.parent.mkdir(parents=True, exist_ok=True)

                    # Extract text from PDF
                    markdown_text = _extract_pdf_to_markdown(pdf_file, quiet)

                    # Save to markdown file
                    output_file.write_text(markdown_text, encoding='utf-8')

                    converted_files.append(str(output_file))

                    if not quiet:
                        log(f"Converted: {pdf_file.name} → {output_file.name}")

            except Exception as e:
                errors.append(f"{pdf_file.name}: {str(e)}")
                if not quiet:
                    log(f"Error processing {pdf_file.name}: {e}")

        # Return results
        if errors and not converted_files:
            # All processing failed
            # Calculate duration
            duration = time.time() - start_time

            # Try to update state (don't fail conversion if state update fails)
            if project_path:
                try:
                    update_project_state(
                        project_path,
                        phase=2,
                        status="incomplete",
                        phase_name="2_convert",
                        files_processed=0,
                        output_directory=str(output_path),
                        error={
                            "type": "processing_failed",
                            "message": f"All file processing failed: {'; '.join(errors)}",
                            "timestamp": _get_timestamp()
                        }
                    )

                    log_workflow_action(
                        project_path,
                        phase=2,
                        tool="convert_to_markdown",
                        action="pdf_conversion",
                        input_data={
                            "input_dir": input_dir,
                            "output_dir": output_dir,
                            "total_files": len(all_files)
                        },
                        output_data={
                            "success": False,
                            "files_processed": 0,
                            "errors": errors
                        },
                        duration_seconds=round(duration, 2)
                    )
                except Exception as state_error:
                    if not quiet:
                        log(f"Warning: Could not update project state: {state_error}")

            return {
                "success": False,
                "phase": 2,
                "phase_name": "Convert to Markdown",
                "files_processed": 0,
                "output_directory": str(output_path),
                "converted_files": [],
                "error": f"All file processing failed: {'; '.join(errors)}",
                "next_phase": {
                    "number": "2B",
                    "name": "Question Detection",
                    "tool": "phase2b_questions (Assessment_MCP)",
                    "note": "Fix errors before proceeding"
                }
            }
        elif errors:
            # Some processing failed
            # Calculate duration
            duration = time.time() - start_time

            # Try to update state
            if project_path:
                try:
                    update_project_state(
                        project_path,
                        phase=2,
                        status="complete",
                        phase_name="2_convert",
                        files_processed=len(converted_files),
                        output_directory=str(output_path),
                        partial_errors=errors
                    )

                    log_workflow_action(
                        project_path,
                        phase=2,
                        tool="convert_to_markdown",
                        action="pdf_conversion",
                        input_data={
                            "input_dir": input_dir,
                            "output_dir": output_dir,
                            "total_files": len(all_files)
                        },
                        output_data={
                            "success": True,
                            "files_processed": len(converted_files),
                            "partial_errors": errors
                        },
                        duration_seconds=round(duration, 2)
                    )
                except Exception as state_error:
                    if not quiet:
                        log(f"Warning: Could not update project state: {state_error}")

            return {
                "success": True,
                "phase": 2,
                "phase_name": "Convert to Markdown",
                "files_processed": len(converted_files),
                "output_directory": str(output_path),
                "converted_files": converted_files,
                "error": f"Partial success. Failed files: {'; '.join(errors)}",
                "next_phase": {
                    "number": "2B",
                    "name": "Question Detection",
                    "tool": "phase2b_questions (Assessment_MCP)",
                    "instruction": "Use Assessment_MCP tools for Phase 4A-4C"
                }
            }
        else:
            # All processing succeeded
            # Calculate duration
            duration = time.time() - start_time

            # Try to update state
            if project_path:
                try:
                    # Count file types for metadata
                    pdf_count = len(pdf_files)
                    non_pdf_count = len(non_pdf_files)

                    update_project_state(
                        project_path,
                        phase=2,
                        status="complete",
                        phase_name="2_convert",
                        files_processed=len(converted_files),
                        pdf_count=pdf_count,
                        non_pdf_count=non_pdf_count,
                        output_directory=str(output_path),
                        skip_pdf=skip_pdf
                    )

                    log_workflow_action(
                        project_path,
                        phase=2,
                        tool="convert_to_markdown",
                        action="pdf_conversion",
                        input_data={
                            "input_dir": input_dir,
                            "output_dir": output_dir,
                            "total_files": len(all_files),
                            "pdf_count": pdf_count,
                            "non_pdf_count": non_pdf_count
                        },
                        output_data={
                            "success": True,
                            "files_processed": len(converted_files),
                            "pdf_count": pdf_count,
                            "non_pdf_count": non_pdf_count
                        },
                        duration_seconds=round(duration, 2)
                    )
                except Exception as state_error:
                    if not quiet:
                        log(f"Warning: Could not update project state: {state_error}")

            return {
                "success": True,
                "phase": 2,
                "phase_name": "Convert to Markdown",
                "files_processed": len(converted_files),
                "output_directory": str(output_path),
                "converted_files": converted_files,
                "error": None,
                "next_phase": {
                    "number": "2B",
                    "name": "Question Detection",
                    "tool": "phase2b_questions (Assessment_MCP)",
                    "instruction": "Use Assessment_MCP tools for Phase 4A-4C"
                }
            }

    except FileNotFoundError as e:
        raise FileNotFoundError(str(e))
    except ValueError as e:
        raise ValueError(str(e))
    except Exception as e:
        raise RuntimeError(f"Error during PDF conversion: {e}")


def _extract_pdf_to_markdown(pdf_path: Path, quiet: bool = False) -> str:
    """
    Extract text from a PDF file and convert to markdown format.

    Args:
        pdf_path: Path to PDF file
        quiet: Suppress progress output

    Returns:
        Markdown-formatted text with page separators
    """
    markdown_text = f"# PDF: {pdf_path.name}\n\n"

    try:
        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)

            for page_num, page in enumerate(pdf.pages, 1):
                # Add page header
                markdown_text += f"## Page {page_num}\n\n"

                # Extract text from page
                page_text = page.extract_text()

                if page_text:
                    markdown_text += page_text
                else:
                    markdown_text += "*[No text content on this page]*\n"

                # Add page separator (except for last page)
                if page_num < total_pages:
                    markdown_text += "\n\n---\n\n"
                else:
                    markdown_text += "\n"

        return markdown_text

    except Exception as e:
        raise RuntimeError(f"Failed to extract text from {pdf_path.name}: {e}")
