"""Validate the --workspace argument at server startup (RFC-035 §9).

Refuses obviously dangerous workspace values (system roots, home directory
exactly, non-existent paths, files instead of directories, non-writable
paths). Warns on broad home top-level directories like ~/Documents,
~/Desktop, ~/Nextcloud.

Symmetric to packages/assessment-mcp/src/core/workspace_preflight.ts.
"""

import os
from pathlib import Path
from typing import TypedDict, Union


class _ValidationOk(TypedDict, total=False):
    ok: bool  # True
    warning: str


class _ValidationFail(TypedDict):
    ok: bool  # False
    error: str


WorkspaceValidationResult = Union[_ValidationOk, _ValidationFail]


REFUSED_ABSOLUTE_PATHS = {
    "/",
    "/Users",
    "/home",
    "/var",
    "/tmp",
    "/etc",
    "/usr",
    "/bin",
    "/sbin",
    "/root",
    # macOS aliases — /tmp, /var, /etc are symlinks to /private/* and
    # Path.resolve() follows symlinks, so the resolved path lands here.
    "/private",
    "/private/tmp",
    "/private/var",
    "/private/etc",
}

WARN_HOME_TOP_LEVEL = {
    "Documents",
    "Desktop",
    "Downloads",
    "Nextcloud",
    "iCloud Drive",
}


def validate_workspace_arg(workspace: str) -> WorkspaceValidationResult:
    """Validate the workspace argument before the MCP server starts."""
    resolved = Path(workspace).resolve()
    resolved_str = str(resolved)

    if resolved_str in REFUSED_ABSOLUTE_PATHS:
        return {
            "ok": False,
            "error": (
                f"Workspace path is too broad or system-critical: {resolved_str}. "
                "Choose a dedicated subfolder."
            ),
        }

    home = Path.home().resolve()
    if resolved == home:
        return {
            "ok": False,
            "error": (
                f"Workspace path is your home directory ({home}). "
                f"Choose a dedicated subfolder, e.g. {home}/assessment_workspace."
            ),
        }

    if not resolved.exists():
        return {
            "ok": False,
            "error": (
                f"Workspace path does not exist: {resolved_str}. "
                f"Create it first: mkdir -p {resolved_str}"
            ),
        }

    if not resolved.is_dir():
        return {
            "ok": False,
            "error": f"Workspace path is not a directory: {resolved_str}.",
        }

    if not os.access(resolved, os.W_OK):
        return {
            "ok": False,
            "error": f"Workspace path is not writable: {resolved_str}.",
        }

    try:
        relative = resolved.relative_to(home)
    except ValueError:
        return {"ok": True}

    parts = relative.parts
    if len(parts) == 1 and parts[0] in WARN_HOME_TOP_LEVEL:
        return {
            "ok": True,
            "warning": (
                f"Workspace is a broad top-level home directory ({resolved_str}). "
                "Consider a dedicated subfolder for tighter isolation."
            ),
        }

    return {"ok": True}
