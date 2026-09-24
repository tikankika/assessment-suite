"""Retired phase labels must not reach the model.

ADR-006 moved question detection to 2B, answer boundaries to 2C and student
discovery to 2D. A retired label in a docstring, a hand-off or an error message
sends the model — and the teacher reading the error — after a phase that no
longer exists.

4D and 4E are gone outright. 4A was reassigned, not retired (Phase 4a is now
rubric construction, methodology only), so only "4A" as question detection is
stale. 4B and 4C survived. A line citing ADR-006 is exempt: those comments
record where a phase came from. Mirrors the TypeScript guard of the same name.
"""

import re
from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parents[1] / "src/assessment_data_mcp"

# Labels, then the tool names that went with them.
RETIRED = re.compile(
    r"\bphase\s+4[de]\b|\bphase\s+4a[:\s]+question|\bphase4[ade]_\w+|\bphase4c_(student_)?report\b",
    re.IGNORECASE,
)

EXEMPT = re.compile(r"ADR-006")


def test_no_retired_phase_labels_in_package_sources():
    sources = sorted(PACKAGE_DIR.rglob("*.py"))
    assert sources, f"no sources found under {PACKAGE_DIR}"

    offences = []
    for source in sources:
        for number, line in enumerate(source.read_text(encoding="utf-8").splitlines(), 1):
            if not EXEMPT.search(line) and RETIRED.search(line):
                offences.append(f"{source.relative_to(PACKAGE_DIR)}:{number}: {line.strip()}")

    assert offences == [], "retired phase labels found:\n" + "\n".join(offences)
