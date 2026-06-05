"""
Shared regex patterns used across Phase 7 and Phase 8 parsers.

These patterns match the Phase 6 assessment output format (RFC-021).
Centralized here to avoid duplication (RFC-029 §3.5).
"""

from __future__ import annotations

import re

# RFC-021: PHASE6_ASSESSMENT v2 metadata block (includes format_version: 2)
# Used by: phase7/standard_parser.py, phase8/qfile_parser.py
PHASE6_V2_METADATA = re.compile(
    r'<!--\s*PHASE6_ASSESSMENT\s*\n'
    r'student_id:\s*(\S+)\s*\n'
    r'total_points:\s*(\S+)\s*\n'  # Can be "null" or number
    r'max_points:\s*(\S+)\s*\n'    # Can be "null" or number
    r'assessed_by:\s*(\S+)\s*\n'
    r'assessed_at:\s*(\S+)\s*\n'
    r'format_version:\s*2\s*\n'    # Must be version 2
    r'-->',
    re.DOTALL
)

# Legacy PHASE6_ASSESSMENT metadata block (v1, without format_version)
# Used by: phase7/standard_parser.py, phase8/qfile_parser.py
PHASE6_LEGACY_METADATA = re.compile(
    r'<!--\s*PHASE6_ASSESSMENT\s*\n'
    r'student_id:\s*(\S+)\s*\n'
    r'total_points:\s*([\d.,]+)\s*\n'
    r'max_points:\s*([\d.,?]+)\s*\n'
    r'.*?-->',
    re.DOTALL
)

# Next step line: "**→ Next step:** feedback" or "**→ Nästa steg:** feedback"
# Used by: phase7/standard_parser.py, phase8/parser.py
NEXT_STEP_LINE = re.compile(
    r'^\*\*→\s*(?:Next step|Nästa steg):\*\*\s*(.+)$',
    re.IGNORECASE | re.MULTILINE
)
