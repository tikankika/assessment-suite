"""
core_inspect_file.py - Read text file contents for debugging

RFC-016: Cross-MCP Core Tools Architecture

This tool provides raw file access for debugging purposes.
For structured data, use domain-specific tools (rubric_read, etc.)
"""

from pathlib import Path
from typing import Dict, Any, Tuple
from ..validators import validate_path_security

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB hard limit
WARN_FILE_SIZE = 1 * 1024 * 1024  # 1MB warning


def _is_binary_file(file_path: Path, sample_size: int = 8192) -> bool:
    """Check if file appears to be binary."""
    try:
        with open(file_path, 'rb') as f:
            chunk = f.read(sample_size)
        if not chunk:
            return False
        # Check for null bytes (common in binary files)
        if b'\x00' in chunk:
            return True
        # Check for high ratio of non-printable characters
        text_chars = bytearray({7, 8, 9, 10, 12, 13, 27} | set(range(0x20, 0x100)))
        non_text = sum(1 for b in chunk if b not in text_chars)
        return non_text / len(chunk) > 0.30 if chunk else False
    except Exception:
        return True  # Assume binary on error


def _read_with_fallback(file_path: Path, preferred: str = "utf-8") -> Tuple[str, str]:
    """Read file with encoding fallback."""
    encodings = [preferred, 'utf-8', 'latin-1', 'cp1252']
    # Remove duplicates while preserving order
    seen = set()
    unique_encodings = []
    for enc in encodings:
        if enc not in seen:
            seen.add(enc)
            unique_encodings.append(enc)

    for enc in unique_encodings:
        try:
            with open(file_path, 'r', encoding=enc) as f:
                return f.read(), enc
        except UnicodeDecodeError:
            continue
    raise UnicodeDecodeError(
        'utf-8', b'', 0, 1,
        f"Could not decode file with any encoding: {unique_encodings}"
    )


async def inspect_file_tool(
    file_path: str,
    encoding: str = "utf-8",
    max_lines: int = 1000,
    offset: int = 0
) -> Dict[str, Any]:
    """
    Inspect text file contents for debugging.

    Use this tool to debug Phase 7 student reports, inspect Q-files,
    or verify config file contents.

    For structured data (YAML, JSON), use domain-specific tools instead.

    Args:
        file_path: Absolute path to file
        encoding: File encoding (default: utf-8)
        max_lines: Maximum lines to return (default: 1000)
        offset: Start from line N (default: 0)

    Returns:
        Dict with success, content, line_count, truncated, encoding, file_size
    """
    # Security: Validate path before any file operations
    valid, error_msg = validate_path_security(file_path)
    if not valid:
        return {"success": False, "error": f"Security: {error_msg}"}

    path = Path(file_path).resolve()

    # Validate path exists
    if not path.exists():
        return {"success": False, "error": f"File not found: {file_path}"}

    if not path.is_file():
        return {"success": False, "error": f"Not a file: {file_path}"}

    # Check file size
    size = path.stat().st_size
    if size > MAX_FILE_SIZE:
        return {
            "success": False,
            "error": f"File too large ({size / 1024 / 1024:.1f}MB > 5MB limit)",
            "file_size": size
        }

    # Check if binary
    if _is_binary_file(path):
        return {
            "success": False,
            "error": f"Binary file detected. Use appropriate tool for: {path.suffix}",
            "file_type": "binary",
            "file_size": size
        }

    try:
        # Read with encoding fallback
        content, used_encoding = _read_with_fallback(path, encoding)
        lines = content.split('\n')
        total_lines = len(lines)
        selected_lines = lines[offset:offset + max_lines]

        response: Dict[str, Any] = {
            "success": True,
            "file_path": str(path),
            "content": '\n'.join(selected_lines),
            "line_count": total_lines,
            "truncated": len(selected_lines) < total_lines - offset,
            "encoding": used_encoding,
            "file_size": size
        }

        # Add warning for large files
        if size > WARN_FILE_SIZE:
            response["warning"] = f"Large file ({size / 1024 / 1024:.1f}MB)"

        # Add offset info if used
        if offset > 0:
            response["offset"] = offset
            response["lines_returned"] = len(selected_lines)

        return response

    except UnicodeDecodeError as e:
        return {"success": False, "error": str(e)}
    except Exception as e:
        return {"success": False, "error": str(e)}
