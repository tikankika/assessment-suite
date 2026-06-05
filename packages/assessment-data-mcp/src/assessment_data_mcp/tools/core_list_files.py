"""
core_list_files.py - List directory contents for navigation and debugging

RFC-016: Cross-MCP Core Tools Architecture

This tool provides directory listing for debugging and navigation purposes.
"""

from pathlib import Path
from typing import Dict, Any, List
from datetime import datetime
from ..validators import validate_path_security

MAX_ENTRIES = 10000  # Maximum entries to return


async def list_files_tool(
    directory_path: str,
    pattern: str = "*",
    recursive: bool = False,
    include_stats: bool = False
) -> Dict[str, Any]:
    """
    List directory contents for navigation and debugging.

    Use this tool to list student reports, find Q-files,
    explore project structure, or verify file existence.

    Args:
        directory_path: Absolute path to directory
        pattern: Glob pattern filter (default: *)
        recursive: Include subdirectories (default: false)
        include_stats: Include file size and modified time (default: false)

    Returns:
        Dict with success, directory, files list, count
    """
    # Security: Validate path before any operations
    is_safe, security_error = validate_path_security(directory_path)
    if not is_safe:
        return {"success": False, "error": f"Security: {security_error}"}

    path = Path(directory_path)

    if not path.exists():
        return {"success": False, "error": f"Directory not found: {directory_path}"}

    if not path.is_dir():
        return {"success": False, "error": f"Not a directory: {directory_path}"}

    try:
        glob_pattern = f"**/{pattern}" if recursive else pattern
        files: List[Dict[str, Any]] = []
        entry_count = 0

        for item in path.glob(glob_pattern):
            entry_count += 1
            if entry_count > MAX_ENTRIES:
                break

            entry: Dict[str, Any] = {
                "name": item.name,
                "path": str(item),
                "type": "directory" if item.is_dir() else "file"
            }

            if include_stats and item.is_file():
                try:
                    stat = item.stat()
                    entry["size"] = stat.st_size
                    entry["modified"] = datetime.fromtimestamp(stat.st_mtime).isoformat()
                except OSError:
                    # Skip stats if we can't read them
                    pass

            files.append(entry)

        # Sort by name
        files.sort(key=lambda x: x["name"])

        response: Dict[str, Any] = {
            "success": True,
            "directory": str(path),
            "files": files,
            "count": len(files)
        }

        # Add warning if truncated
        if entry_count > MAX_ENTRIES:
            response["warning"] = f"Results truncated at {MAX_ENTRIES} entries"
            response["truncated"] = True

        # Add pattern info if not default
        if pattern != "*":
            response["pattern"] = pattern

        if recursive:
            response["recursive"] = True

        return response

    except PermissionError as e:
        return {"success": False, "error": f"Permission denied: {e}"}
    except Exception as e:
        return {"success": False, "error": str(e)}
