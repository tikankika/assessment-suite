"""
Phase 8 table_parser robustness.

The summary-table parser must:
1. only harvest rows from the "Poäng per fråga" section — not unrelated Q###
   tables elsewhere in the report (e.g. per-aspect breakdowns); and
2. skip a single malformed numeric cell rather than dropping the whole student.
"""

import pytest

from assessment_data_mcp.phase8.table_parser import parse_summary_table


def test_only_poäng_per_fråga_section_counted(tmp_path):
    """A Q### table outside the 'Poäng per fråga' section must not be summed."""
    report = tmp_path / "Analytic_100200.md"
    report.write_text(
        "### Poäng per fråga\n\n"
        "| Fråga | Poäng | Max | Procent |\n"
        "|-------|-------|-----|---------|\n"
        "| Q001A | 2.0 | 2.0 | 100% |\n"
        "| Q001B | 1.0 | 2.0 | 50% |\n"
        "\n---\n\n"
        "## Detaljerade bedömningar\n\n"
        "### Fråga Q001A\n\n"
        "Per-aspekt-tabell (ska INTE räknas in i totalen):\n\n"
        "| Q001A | 9.0 | 9.0 |\n",
        encoding="utf-8",
    )
    result = parse_summary_table(report)
    assert result is not None
    # Only the two rows under 'Poäng per fråga' (2.0 + 1.0 = 3.0 / 4.0)
    assert result["total_points"] == 3.0
    assert result["max_points"] == 4.0
    assert result["questions_answered"] == 2


def test_malformed_cell_skips_row_not_student(tmp_path):
    """One malformed numeric cell must skip only that row, not drop the student."""
    report = tmp_path / "Analytic_100201.md"
    report.write_text(
        "### Poäng per fråga\n\n"
        "| Fråga | Poäng | Max | Procent |\n"
        "|-------|-------|-----|---------|\n"
        "| Q001A | 2.0 | 2.0 | 100% |\n"
        "| Q001B | 2.0.5 | 2.0 | ? |\n"   # malformed earned → float() would raise
        "| Q001C | 1.0 | 2.0 | 50% |\n",
        encoding="utf-8",
    )
    result = parse_summary_table(report)
    assert result is not None  # student NOT dropped
    # Good rows still counted: 2.0 + 1.0 = 3.0 / 4.0
    assert result["total_points"] == 3.0
    assert result["max_points"] == 4.0
    assert "Q001A" in result["questions"]
    assert "Q001C" in result["questions"]
    assert "Q001B" not in result["questions"]
