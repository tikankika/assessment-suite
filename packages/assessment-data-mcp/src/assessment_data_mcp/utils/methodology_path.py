"""Resolve the default methodology folder.

METHODOLOGY_PATH, when set to a non-empty value, points at a teacher-maintained
methodology folder. Otherwise the folder at the repository root is used, which
is also where a packaged bundle places it.
"""

import os
from pathlib import Path

from ..constants.folders import METHODOLOGY


def default_methodology_folder() -> Path:
    configured = os.environ.get("METHODOLOGY_PATH", "")
    if configured:
        return Path(configured)
    # utils/ -> assessment_data_mcp/ -> src/ -> assessment-data-mcp/ -> packages/ -> root
    return Path(__file__).resolve().parents[5] / METHODOLOGY
