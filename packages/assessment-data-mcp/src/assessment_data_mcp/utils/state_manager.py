"""Project state management with logging.

Manages project_state.json and workflow_log.jsonl.
Critical: Supports incomplete status for error recovery (Q5).
"""

import json
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional


def _get_timestamp() -> str:
    """Generate ISO 8601 timestamp with Z suffix."""
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def create_project_state(
    project_path: Path,
    project_name: str,
    phase: int = 1
) -> dict:
    """
    Create initial project_state.json structure.

    Args:
        project_path: Project root directory
        project_name: Name of the project
        phase: Current phase number (default: 1)

    Returns:
        dict: Initial state structure
    """
    return {
        "version": "1.0",
        "project_name": project_name,
        "created": _get_timestamp(),
        "last_updated": _get_timestamp(),
        "current_phase": phase,
        "phases": {
            f"{phase}_setup": {
                "status": "in_progress",
                "timestamp": _get_timestamp()
            }
        }
    }


def save_project_state(project_path: Path, state: dict) -> None:
    """
    Save project_state.json with UTF-8 encoding.

    Args:
        project_path: Project root directory
        state: State dictionary to save

    Key settings:
    - encoding='utf-8' for Swedish characters
    - indent=2 for readability
    - ensure_ascii=False for Unicode
    """
    state_file = project_path / "project_state.json"
    state["last_updated"] = _get_timestamp()

    with open(state_file, 'w', encoding='utf-8') as f:
        json.dump(state, f, indent=2, ensure_ascii=False)


def load_project_state(project_path: Path) -> dict:
    """
    Load existing project_state.json.

    Args:
        project_path: Project root directory

    Returns:
        dict: Loaded state

    Raises:
        FileNotFoundError: No state file exists
    """
    state_file = project_path / "project_state.json"

    if not state_file.exists():
        raise FileNotFoundError(f"No state found at {project_path}")

    with open(state_file, 'r', encoding='utf-8') as f:
        return json.load(f)


def update_project_state(
    project_path: Path,
    phase: int,
    status: str,
    phase_name: Optional[str] = None,
    **kwargs
) -> None:
    """
    Update existing state with new phase info.

    Args:
        project_path: Project root directory
        phase: Phase number to update
        status: Phase status (complete, incomplete, in_progress)
        phase_name: Optional custom phase name (default: "{phase}_setup")
        **kwargs: Additional phase data (files_created, error, etc.)
    """
    state = load_project_state(project_path)
    state["current_phase"] = phase

    # Use custom name if provided, otherwise default to "{phase}_setup"
    phase_key = phase_name or f"{phase}_setup"
    state["phases"][phase_key] = {
        "status": status,
        "timestamp": _get_timestamp(),
        **kwargs
    }

    save_project_state(project_path, state)


def log_workflow_action(
    project_path: Path,
    phase: int,
    tool: str,
    action: str,
    input_data: dict,
    output_data: Optional[dict] = None,
    duration_seconds: Optional[float] = None
) -> None:
    """
    Append action to workflow_log.jsonl (Q4 decision).

    Format: JSONL (one JSON object per line)
    Purpose: Debugging, audit trail, workflow analysis

    Args:
        project_path: Project root directory
        phase: Phase number
        tool: Tool name (e.g., "setup_project")
        action: Action description (e.g., "project_creation")
        input_data: Input parameters
        output_data: Output results (optional)
        duration_seconds: Execution time (optional)

    Example log entry:
        {"timestamp": "2025-12-25T10:15:30Z", "phase": 1, "tool": "setup_project",
         "action": "project_creation", "input": {...}, "output": {...},
         "duration_seconds": 3.5}
    """
    log_file = project_path / "workflow_log.jsonl"

    log_entry = {
        "timestamp": _get_timestamp(),
        "phase": phase,
        "tool": tool,
        "action": action,
        "input": input_data,
        "output": output_data or {},
    }

    if duration_seconds is not None:
        log_entry["duration_seconds"] = duration_seconds

    # Append to JSONL file (one JSON per line)
    with open(log_file, 'a', encoding='utf-8') as f:
        f.write(json.dumps(log_entry, ensure_ascii=False) + '\n')
