"""
Phase 8 aggregator — duplicate question IDs must not desync the per-question
breakdown from the totals.

If a q_id appears twice (e.g. table duplication or a Q-file row plus a sub-aspect
keyed the same), the `questions` dict keeps only the last entry, so the totals
must be computed from those de-duplicated entries — not by summing every raw item.
"""

from assessment_data_mcp.phase8.aggregator import aggregate_question_data


def test_duplicate_question_id_totals_match_breakdown():
    items = [
        ("Q001A", 2.0, 2.0),
        ("Q001B", 1.0, 2.0),
        ("Q001A", 3.0, 3.0),  # duplicate q_id — last wins
    ]
    result = aggregate_question_data("100001", items, source="table")

    assert result["questions_answered"] == 2
    # last-wins per q_id: Q001A = 3.0/3.0, Q001B = 1.0/2.0
    assert result["questions"]["Q001A"]["points"] == 3.0
    assert result["questions"]["Q001A"]["max"] == 3.0
    # totals must equal the sum of the de-duplicated breakdown, not all raw items
    assert result["total_points"] == 4.0   # 3.0 + 1.0  (not 6.0)
    assert result["max_points"] == 5.0     # 3.0 + 2.0  (not 7.0)
