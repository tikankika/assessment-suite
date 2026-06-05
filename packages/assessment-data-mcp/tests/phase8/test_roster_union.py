"""
Phase 8 roster — find_all_students_in_qfiles must union students across ALL
assessed Q-files, not trust qfiles[0] alone.

A question that part of the cohort did not answer has those `## Elev` blocks
pruned from that Q-file; reading only the first Q-file would silently drop those
students from the entire Phase 8 roster.
"""

from assessment_data_mcp.phase8.qfile_parser import find_all_students_in_qfiles


def _write_qfile(d, qid, students):
    body = "\n\n".join(f"## Elev {s} (40 ord)\n\nSvar.\n\n**BEDÖMNING: 2/2p**" for s in students)
    (d / f"{qid}_alla_elever_2026-01-06_Lärare.md").write_text(body, encoding="utf-8")


def test_roster_unions_across_all_qfiles(tmp_path):
    # Q001a is missing 100003; Q002a has all three.
    _write_qfile(tmp_path, "Q001a", ["100001", "100002"])
    _write_qfile(tmp_path, "Q002a", ["100001", "100002", "100003"])

    students = find_all_students_in_qfiles(tmp_path)

    assert set(students) == {"100001", "100002", "100003"}
