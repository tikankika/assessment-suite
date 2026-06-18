"""Path validation with security checks and fuzzy matching.

Uses Path.resolve() to safely handle symlinks and path traversal.
Provides helpful suggestions when files are not found.
Includes security checks to block access to sensitive system paths.

See: docs/decisions/ADR-005 mcp directory exploration.md (lines 234-310)
"""

from pathlib import Path
from difflib import SequenceMatcher
from datetime import datetime
from typing import Tuple
import os
import platform

# Platform-specific blocked paths for security
BLOCKED_PATHS = {
    "Darwin": ["/System", "/Library/Preferences", "/private/etc"],  # macOS
    "Linux": ["/etc", "/var/log", "/usr", "/bin", "/sbin", "/root"],
    "Windows": ["C:\\Windows", "C:\\Program Files"],
}

# Allowed hidden directories in home (config files we might need)
ALLOWED_HIDDEN_DIRS = [".config"]


def assert_safe_identifier(value: str, arg_name: str = "identifier") -> Tuple[bool, str]:
    """Validate that an identifier (e.g. student_id) is safe to interpolate
    into a filesystem path.

    Workspace containment (RFC-035) is enforced on an allowlist of *path*
    argument names. Identifiers like ``student_id`` are not on that list but
    are interpolated into filenames by several tools; a value such as
    ``../../etc/evil`` would escape the workspace. Reject (rather than
    silently strip) any value containing a path separator, a ``..`` sequence,
    or a control/whitespace character. Mirrors the guard in the phase3 tools
    and ``assertSafeIdentifier`` in the TypeScript path_validator.

    Returns:
        Tuple of (is_valid, error_message). Error message is empty if valid.
    """
    if (
        not isinstance(value, str)
        or value == ""
        or "/" in value
        or "\\" in value
        or ".." in value
        or any(c.isspace() or ord(c) < 0x20 or ord(c) == 0x7F for c in value)
    ):
        return False, f"Invalid {arg_name}: {value!r}"
    return True, ""


def validate_path_security(path: str) -> Tuple[bool, str]:
    """
    Validate path is safe to access (security checks only).

    Checks:
    1. Path must be absolute after resolution
    2. Path must not be in system-blocked directories
    3. Path must not be hidden files in home directory (except allowed)

    Args:
        path: Path to validate

    Returns:
        Tuple of (is_valid, error_message). Error message is empty if valid.
    """
    resolved = Path(path).resolve()

    # Get platform-specific blocked paths
    current_platform = platform.system()
    blocked = BLOCKED_PATHS.get(current_platform, BLOCKED_PATHS["Linux"])

    # Check blocked paths. Match the directory itself or a child — not a mere
    # string prefix, so a sibling like "/etcfoo" is not caught by "/etc".
    resolved_str = str(resolved)
    for blocked_path in blocked:
        if resolved_str == blocked_path or resolved_str.startswith(blocked_path + os.sep):
            return False, f"Access to {blocked_path} is blocked for security"

    # Check for hidden files in home directory
    home = Path.home()
    if str(resolved).startswith(str(home)):
        try:
            relative = resolved.relative_to(home)
            first_part = relative.parts[0] if relative.parts else ""
            if first_part.startswith(".") and first_part not in ALLOWED_HIDDEN_DIRS:
                return False, f"Access to hidden home files ({first_part}) is blocked for security"
        except ValueError:
            pass  # Not relative to home, that's fine

    return True, ""


def validate_path(path: str, must_exist: bool = True, suggest_alternatives: bool = True) -> bool:
    """
    Validate file path for security and accessibility with helpful error messages.

    Uses Path.resolve() to handle symlinks and path traversal safely.
    When files are not found, provides fuzzy matching suggestions.

    Args:
        path: Path to validate
        must_exist: Whether path must exist (default: True)
        suggest_alternatives: Include fuzzy-matched alternatives in errors (default: True)

    Returns:
        True if valid

    Raises:
        FileNotFoundError: Path doesn't exist (if must_exist=True)
            - With suggestions if suggest_alternatives=True and parent directory exists
        PermissionError: Path not readable
        ValueError: Invalid path
    """
    try:
        # Security check first
        is_safe, security_error = validate_path_security(path)
        if not is_safe:
            raise PermissionError(security_error)

        # Resolve path (handles symlinks, .., absolute paths)
        p = Path(path).resolve()

        if must_exist and not p.exists():
            if suggest_alternatives:
                parent = Path(path).parent
                if parent.exists():
                    similar = _find_similar_files(parent, Path(path).name)
                    error_msg = f"File not found: {path}"
                    if similar:
                        error_msg += "\n\nDid you mean one of these?"
                        for alt in similar:
                            error_msg += f"\n  - {alt['path']} ({alt['size']}, modified {alt['modified']})"
                    error_msg += "\n\nTip: Use explore_directory tool to see all available files"
                    raise FileNotFoundError(error_msg)
            raise FileNotFoundError(f"Path not found: {path}")

        if p.exists() and not os.access(p, os.R_OK):
            raise PermissionError(f"Cannot read path: {path}")

        return True

    except FileNotFoundError:
        # Re-raise without wrapping (may include suggestions)
        raise
    except PermissionError:
        # Re-raise without wrapping
        raise
    except (OSError, ValueError) as e:
        raise ValueError(f"Invalid path: {path} ({e})")


def validate_workspace_access(
    path: str,
    workspace: str,
    tool: str = "unknown",
    arg_name: str = "unknown",
) -> Tuple[bool, str]:
    """Validate that path is within workspace boundary (RFC-035).

    On violation, writes an audit entry to stderr (visible in
    ~/Library/Logs/Claude/mcp-server-*.log on macOS) before returning.

    Args:
        path: Path to validate
        workspace: Workspace root directory
        tool: Optional tool name for the audit log
        arg_name: Optional argument name for the audit log

    Returns:
        Tuple of (is_valid, error_message). Error message is empty if valid.
    """
    import sys

    resolved = Path(path).resolve()
    workspace_resolved = Path(workspace).resolve()

    if not str(resolved).startswith(str(workspace_resolved) + os.sep) \
       and resolved != workspace_resolved:
        print(
            f"[WORKSPACE VIOLATION] tool={tool} arg={arg_name} "
            f"requested={resolved} workspace={workspace_resolved}",
            file=sys.stderr,
        )
        return False, f"Access denied: {resolved} is outside workspace {workspace_resolved}"

    return True, ""


def _find_similar_files(directory: Path, target_name: str) -> list[dict]:
    """
    Find files with similar names using fuzzy matching.

    Uses difflib.SequenceMatcher to find files with >50% similarity.
    Returns up to 5 best matches sorted by similarity score.

    Args:
        directory: Directory to search in
        target_name: Target filename to match against

    Returns:
        List of dicts with keys: path, size, modified, similarity
    """
    candidates = []

    try:
        for file in directory.iterdir():
            if file.is_file():
                similarity = SequenceMatcher(
                    None,
                    target_name.lower(),
                    file.name.lower()
                ).ratio()

                if similarity > 0.5:  # 50% similarity threshold
                    size_mb = file.stat().st_size / (1024 * 1024)
                    mod_time = datetime.fromtimestamp(file.stat().st_mtime)

                    candidates.append({
                        "path": file.name,
                        "size": f"{size_mb:.1f} MB",
                        "modified": mod_time.strftime("%Y-%m-%d"),
                        "similarity": similarity
                    })

        # Sort by similarity score (highest first) and return top 5
        return sorted(candidates, key=lambda x: x["similarity"], reverse=True)[:5]

    except (OSError, PermissionError):
        # If we can't read directory, return empty list
        return []
