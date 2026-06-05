"""
Phase 8 — Swedish comma-decimal consistency.

Swedish assessors write decimals with a comma (``2,5``) rather than a dot.
Every numeric path in the Phase 8 parsers must accept comma decimals, otherwise
a legitimately-scored student is silently dropped from the quantitative totals.

These tests exercise the REAL parser functions (not raw fs / hand-massaged
strings) with comma input, mirroring the production failure mode.
"""

import pytest

from assessment_data_mcp.phase8.qfile_parser import extract_bedömning
from assessment_data_mcp.phase8.table_parser import parse_summary_table


class TestExtractBedömningCommaDecimals:
    """extract_bedömning must accept comma decimals in every pattern."""

    def test_v2_metadata_comma_decimal(self):
        """Pattern 1 (v2 metadata) with comma decimals → parsed, not dropped."""
        section = """## Elev 100001 (47 ord)

<!-- PHASE6_ASSESSMENT
student_id: 100001
total_points: 2,5
max_points: 5,0
assessed_by: Claude
assessed_at: 2026-02-28T10:00:00Z
format_version: 2
-->
"""
        earned, max_pts = extract_bedömning(section)
        assert earned == 2.5
        assert max_pts == 5.0

    def test_bold_bedömning_comma_decimal(self):
        """Pattern 3 (**BEDÖMNING: X/Yp**) with comma decimals."""
        section = """## Elev 100002 (30 ord)

### BEDÖMNING:

**BEDÖMNING: 2,5/5,0p**
"""
        earned, max_pts = extract_bedömning(section)
        assert earned == 2.5
        assert max_pts == 5.0

    def test_bold_total_comma_decimal(self):
        """Pattern 4 (**TOTAL: X/Yp**) with comma decimals."""
        section = """## Elev 100003 (30 ord)

**TOTAL: 4,5/5,0p**
"""
        earned, max_pts = extract_bedömning(section)
        assert earned == 4.5
        assert max_pts == 5.0


class TestParseSummaryTableCommaDecimals:
    """parse_summary_table must accept comma decimals in table cells."""

    def test_table_comma_decimals(self, tmp_path):
        report = tmp_path / "Analytic_100100.md"
        report.write_text(
            "### Poäng per fråga\n\n"
            "| Fråga | Poäng | Max | Procent |\n"
            "|-------|-------|-----|---------|\n"
            "| Q001A | 2,5 | 5,0 | 50% |\n"
            "| Q001B | 1,5 | 2,0 | 75% |\n",
            encoding="utf-8",
        )
        result = parse_summary_table(report)
        assert result is not None
        assert result["total_points"] == 4.0
        assert result["max_points"] == 7.0
        assert result["questions"]["Q001A"]["points"] == 2.5
