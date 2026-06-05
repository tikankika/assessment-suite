"""
Phase 8 — an assessment that is PRESENT but in an unrecognised format must be
surfaced loudly (the student is excluded from quantitative totals), and must be
distinguishable from a student who simply has no assessment.
"""

import logging

from assessment_data_mcp.phase8.qfile_parser import parse_qfile_for_student


def test_unparseable_present_assessment_warns(tmp_path, caplog):
    qf = tmp_path / "Q001a_alla_elever_2026-01-06_X.md"
    qf.write_text(
        "## Elev 100001 (40 ord)\n\nSvar.\n\n"
        "### BEDÖMNING:\n\n"
        "Bedömning: tre av fem poäng\n",  # present but no recognised numeric pattern
        encoding="utf-8",
    )
    with caplog.at_level(logging.WARNING):
        result = parse_qfile_for_student(qf, "100001")

    assert result is None
    # The drop must be surfaced as a WARNING that flags the format / exclusion.
    warnings = [r.message for r in caplog.records if r.levelno >= logging.WARNING]
    assert any("format" in m.lower() or "exclud" in m.lower() for m in warnings)


def test_absent_assessment_does_not_warn_about_format(tmp_path, caplog):
    qf = tmp_path / "Q001a_alla_elever_2026-01-06_X.md"
    qf.write_text(
        "## Elev 100001 (40 ord)\n\nSvar utan någon bedömning alls.\n",
        encoding="utf-8",
    )
    with caplog.at_level(logging.WARNING):
        result = parse_qfile_for_student(qf, "100001")

    assert result is None
    # A genuinely absent assessment must NOT raise a format warning.
    warnings = [r.message for r in caplog.records if r.levelno >= logging.WARNING]
    assert not any("format" in m.lower() for m in warnings)
