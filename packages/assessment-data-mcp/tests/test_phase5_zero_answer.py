"""
Phase 5 — a student who is read but yields zero extracted answers must be
surfaced explicitly in stats['errors'], not left implicit.

(The student is still counted in students_processed so the coverage-warning
denominator stays correct; the explicit error is the non-silent signal.)
"""

from assessment_data_mcp.tools.phase5_qfiles import process_student_files_from_markers


def test_zero_answer_student_is_surfaced(tmp_path):
    sf = tmp_path / "stu1.md"
    sf.write_text(
        "<!-- phase3_q001_start -->\n0001 ett svar\n<!-- phase3_q001_end -->\n",
        encoding="utf-8",
    )
    # Ask for a question whose markers are absent → nothing extracted.
    questions = [{"id": "q999"}]

    questions_db, stats = process_student_files_from_markers(
        [sf], questions, quiet=True
    )

    assert stats["answers_extracted"] == 0
    # The read-but-empty student must be reported, not silently dropped.
    assert any("stu1" in e for e in stats["errors"])
