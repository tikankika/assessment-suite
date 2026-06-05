"""
explore_directory.py - Intelligent directory exploration for Pre-Assessment MCP Server

This tool solves the "Session 2 failure" problem where Claude couldn't explore
local directories due to environment mismatch (container tools vs MCP tools).

Pattern matching logic:
- Exam: Large PDF in root (>10MB = medium, >20MB = high confidence)
- Rubric: Filename contains "rubric", "bedömning", "matris" (high confidence)
- Student answers: Directory with "inspera" (high) or >1 PDF (medium confidence)

See: docs/decisions/ADR-005 mcp directory exploration.md
"""

from pathlib import Path
from typing import Dict, Optional, List, Tuple
from ..validators import validate_path_security
from ..constants.folders import METHODOLOGY


def _get_default_methodology_folder() -> Path:
    """Get methodology folder path relative to this package."""
    # Navigate: tools/ -> assessment_data_mcp/ -> src/ -> assessment-data-mcp/ -> packages/ -> Assessment_suite/
    this_file = Path(__file__).resolve()
    monorepo_root = this_file.parents[5]  # Up 5 levels to Assessment_suite
    return monorepo_root / METHODOLOGY


def _scan_methodology_files() -> List[Tuple[str, int]]:
    """Scan methodology folder recursively and return list of (relative_path, size_kb) tuples."""
    methodology_path = _get_default_methodology_folder()
    if not methodology_path.exists():
        return []

    files = []
    for md_file in sorted(methodology_path.rglob("*.md")):
        if '_archive' in md_file.parts:
            continue
        rel_path = md_file.relative_to(methodology_path)
        size_kb = md_file.stat().st_size // 1024
        files.append((str(rel_path), size_kb))
    return files


def _format_methodology_list() -> str:
    """Format methodology files as a bullet list for display."""
    files = _scan_methodology_files()
    if not files:
        return "   (Ingen metodikfolder hittad)"

    lines = []
    for filename, size_kb in files:
        lines.append(f"   • {filename} ({size_kb}KB)")
    return "\n".join(lines)


async def explore_directory_tool(directory_path: str) -> dict:
    """
    Scan directory and identify files with intelligent pattern matching.

    Args:
        directory_path: Path to directory to explore

    Returns:
        {
            "directory": str,
            "files_found": {"pdfs": int, "markdown": int, "subdirs": int},
            "suggestions": {
                "exam_path": str | None,
                "rubric_path": str | None,
                "student_answers_path": str | None
            },
            "confidence_scores": {"exam": str, "rubric": str, "students": str},
            "overall_confidence": str,  # "high" | "medium" | "low"
            "ready_for_auto_setup": bool,
            "next_steps": {
                "instruction": str,
                "required_questions": list[str],
                "optional_questions": list[str],
                "then": str
            }
        }

    Raises:
        FileNotFoundError: If directory doesn't exist
        PermissionError: If directory not accessible
    """
    # Security: Validate path before any operations
    is_safe, security_error = validate_path_security(directory_path)
    if not is_safe:
        raise PermissionError(f"Security: {security_error}")

    try:
        path = Path(directory_path).resolve(strict=True)

        if not path.is_dir():
            raise ValueError(f"Path is not a directory: {directory_path}")

        # Scan files
        pdf_files = list(path.glob("*.pdf"))
        md_files = list(path.glob("*.md"))
        txt_files = list(path.glob("*.txt"))
        docx_files = list(path.glob("*.docx"))
        subdirs = [d for d in path.iterdir() if d.is_dir()]

        suggestions = {}
        confidence_scores = {}

        # EXAM DETECTION
        # Heuristic 1: Large PDFs (>10MB) in root are likely exams
        for pdf in pdf_files:
            size_mb = pdf.stat().st_size / (1024 * 1024)
            if size_mb > 10:
                suggestions["exam_path"] = str(pdf)
                confidence_scores["exam"] = "high" if size_mb > 20 else "medium"
                break

        # Heuristic 2: Filename pattern matching for txt/docx/smaller pdfs
        if "exam_path" not in suggestions:
            exam_patterns = ["exam", "dugga", "tenta", "prov", "test"]
            for file in txt_files + docx_files + pdf_files:
                if any(pattern in file.name.lower() for pattern in exam_patterns):
                    suggestions["exam_path"] = str(file)
                    confidence_scores["exam"] = "medium"
                    break

        # RUBRIC DETECTION
        # Pattern matching on filename
        rubric_patterns = ["rubric", "bedömning", "bedomning", "matris"]
        for file in pdf_files + md_files + txt_files + docx_files:
            if any(pattern in file.name.lower() for pattern in rubric_patterns):
                suggestions["rubric_path"] = str(file)
                confidence_scores["rubric"] = "high"
                break

        # STUDENT ANSWERS DETECTION
        # 1. Inspera directory (specific pattern)
        # 2. Directory with multiple PDFs (>1)
        for subdir in subdirs:
            pdf_count = len(list(subdir.glob("*.pdf")))
            if "inspera" in subdir.name.lower():
                suggestions["student_answers_path"] = str(subdir)
                confidence_scores["students"] = "high"
                break
            elif pdf_count > 1:
                suggestions["student_answers_path"] = str(subdir)
                confidence_scores["students"] = "medium"

        # OVERALL CONFIDENCE
        # High: All 3 files found
        # Medium: 2 files found
        # Low: 0-1 files found
        overall_confidence = "high" if len(suggestions) >= 3 else "medium"
        if len(suggestions) < 2:
            overall_confidence = "low"

        return {
            "directory": str(path),
            "files_found": {
                "pdfs": len(pdf_files),
                "markdown": len(md_files),
                "txt": len(txt_files),
                "docx": len(docx_files),
                "subdirs": len(subdirs)
            },
            "suggestions": suggestions,
            "confidence_scores": confidence_scores,
            "overall_confidence": overall_confidence,
            "ready_for_auto_setup": overall_confidence == "high",
            "next_steps": {
                "instruction": "BEFORE calling setup_project, you MUST ask the teacher these questions:",
                "required_questions": [
                    "1. Syllabus: 'Vilken kursplan ska användas? (URL eller filsökväg)'",
                    "2. Output location: 'Var ska projektet sparas? (output_base_path)'",
                    "3. Project name: 'Vad ska projektet heta?'",
                    f"4. Methodology för Phase 6 bedömning - Följande dokument styr hur AI-assisterad bedömning utförs:\n"
                    f"{_format_methodology_list()}\n"
                    "   Alternativ:\n"
                    "   a) STANDARD (Rekommenderas) - Kopiera dessa dokument till projektet\n"
                    "   b) EGEN MAPP - Ange sökväg till egna metodikdokument\n"
                    "   c) INGEN - Skippa (använd methodology_folder='none')"
                ],
                "optional_questions": [
                    "5. Course content: 'Har du kursmaterial (föreläsningar, anteckningar)?'"
                ],
                "then": "Confirm ALL parameters with teacher before calling setup_project"
            }
        }

    except FileNotFoundError:
        raise FileNotFoundError(f"Directory not found: {directory_path}")
    except PermissionError:
        raise PermissionError(f"Permission denied accessing: {directory_path}")
    except ValueError:
        # Re-raise ValueError (e.g., "not a directory") without wrapping
        raise
    except Exception as e:
        raise RuntimeError(f"Error exploring directory: {e}")
