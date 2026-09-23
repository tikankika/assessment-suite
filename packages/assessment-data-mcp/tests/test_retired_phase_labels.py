"""Retired phase labels must not reach the model.

ADR-006 retired Phase 4A, 4D and 4E: question detection became 2B, answer
boundaries 2C, student discovery 2D. A retired label in a docstring, a hand-off
or an error message sends the model — and the teacher reading the error — after
a phase that no longer exists. Phase 4B and 4C survived the renumbering.

A line that cites ADR-006 is exempt: those comments record where a phase came
from, which is the one place the old numbers still belong.
"""

import re
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parents[1] / "src/assessment_data_mcp/tools"

RETIRED = [
    re.compile(r"\bphase\s+4a\b", re.IGNORECASE),
    re.compile(r"\bphase\s+4d\b", re.IGNORECASE),
    re.compile(r"\bphase\s+4e\b", re.IGNORECASE),
    re.compile(r"\bphase4a_questions\b"),
    re.compile(r"\bphase4d_boundaries\b"),
    re.compile(r"\bphase4e_students\b"),
    re.compile(r"\bphase4c_report\b"),
    re.compile(r"\bphase4c_student_report\b"),
]

EXEMPT = re.compile(r"ADR-006")


def test_no_retired_phase_labels_in_tool_sources():
    sources = sorted(TOOLS_DIR.glob("*.py"))
    assert sources, f"no tool sources found under {TOOLS_DIR}"

    offences = []
    for source in sources:
        for number, line in enumerate(source.read_text(encoding="utf-8").splitlines(), 1):
            if EXEMPT.search(line):
                continue
            if any(pattern.search(line) for pattern in RETIRED):
                offences.append(f"{source.name}:{number}: {line.strip()}")

    assert offences == [], "retired phase labels found:\n" + "\n".join(offences)
