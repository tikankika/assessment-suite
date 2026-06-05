"""
Logging Configuration for Assessment Data MCP

Configures Python logging to write to project-specific log files.
Supports both file and stderr output with rotation.

Usage:
    from assessment_data_mcp.utils.logging_config import setup_project_logging

    # At the start of any phase tool:
    setup_project_logging(project_path)

    # Then use standard logging:
    import logging
    logger = logging.getLogger(__name__)
    logger.info("Processing started")
"""

from __future__ import annotations

import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path
from datetime import datetime
from typing import Optional, Union

# Track if logging has been configured for a project
_configured_projects: set = set()

# Default settings
DEFAULT_LOG_LEVEL = logging.INFO
MAX_LOG_SIZE = 5 * 1024 * 1024  # 5 MB
BACKUP_COUNT = 3
LOG_FORMAT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def setup_project_logging(
    project_path: Union[Path, str],
    log_level: int = DEFAULT_LOG_LEVEL,
    also_stderr: bool = True,
    force_reconfigure: bool = False
) -> Path:
    """
    Configure logging to write to project's logs directory.

    Args:
        project_path: Path to project root directory
        log_level: Logging level (default: INFO)
        also_stderr: Also output to stderr (default: True)
        force_reconfigure: Force reconfiguration even if already done

    Returns:
        Path to the log file

    Example:
        >>> log_file = setup_project_logging("/path/to/project")
        >>> # Now all loggers will write to /path/to/project/logs/assessment.log
    """
    project_path = Path(project_path)
    project_key = str(project_path.resolve())

    # Skip if already configured (unless forced)
    if project_key in _configured_projects and not force_reconfigure:
        logs_dir = project_path / "logs"
        return logs_dir / "assessment.log"

    # Create logs directory
    logs_dir = project_path / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)

    # Log file path
    log_file = logs_dir / "assessment.log"

    # Get root logger
    root_logger = logging.getLogger()

    # Remove existing handlers if reconfiguring
    if force_reconfigure:
        for handler in root_logger.handlers[:]:
            root_logger.removeHandler(handler)

    # Set level
    root_logger.setLevel(log_level)

    # Create formatter
    formatter = logging.Formatter(LOG_FORMAT, LOG_DATE_FORMAT)

    # Add rotating file handler
    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=MAX_LOG_SIZE,
        backupCount=BACKUP_COUNT,
        encoding='utf-8'
    )
    file_handler.setLevel(log_level)
    file_handler.setFormatter(formatter)
    root_logger.addHandler(file_handler)

    # Add stderr handler if requested
    if also_stderr:
        stderr_handler = logging.StreamHandler(sys.stderr)
        stderr_handler.setLevel(logging.WARNING)  # Only warnings and above to stderr
        stderr_handler.setFormatter(formatter)
        root_logger.addHandler(stderr_handler)

    # Mark as configured
    _configured_projects.add(project_key)

    # Log startup message
    logger = logging.getLogger(__name__)
    logger.info(f"=== Logging started for project: {project_path.name} ===")
    logger.info(f"Log file: {log_file}")
    logger.debug(f"Log level: {logging.getLevelName(log_level)}")

    return log_file


def get_log_file_path(project_path: Union[Path, str]) -> Path:
    """Get the log file path for a project (without configuring)."""
    return Path(project_path) / "logs" / "assessment.log"


def log_phase_start(phase: int | str, tool: str, **kwargs) -> None:
    """
    Log the start of a phase with consistent formatting.

    Args:
        phase: Phase number or name
        tool: Tool name
        **kwargs: Additional context to log
    """
    logger = logging.getLogger(__name__)
    context = ", ".join(f"{k}={v}" for k, v in kwargs.items()) if kwargs else ""
    logger.info(f"[Phase {phase}] {tool} started{': ' + context if context else ''}")


def log_phase_complete(phase: int | str, tool: str, success: bool, **kwargs) -> None:
    """
    Log the completion of a phase with consistent formatting.

    Args:
        phase: Phase number or name
        tool: Tool name
        success: Whether the phase completed successfully
        **kwargs: Additional results to log
    """
    logger = logging.getLogger(__name__)
    status = "completed" if success else "FAILED"
    context = ", ".join(f"{k}={v}" for k, v in kwargs.items()) if kwargs else ""

    if success:
        logger.info(f"[Phase {phase}] {tool} {status}{': ' + context if context else ''}")
    else:
        logger.error(f"[Phase {phase}] {tool} {status}{': ' + context if context else ''}")
