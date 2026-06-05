"""Tests for phase5 extract_answer_by_markers – issue #13 regression test."""

import pytest
from assessment_data_mcp.tools.phase5_qfiles import extract_answer_by_markers


# Simulated Inspera student file (after PDF→MD conversion)
INSPERA_STUDENT_FILE = """# PDF: 100100_200100.pdf

## Page 1

COURSE_AI, grundbegrepp Candidate 100100
STUDENT
100100

## Page 2

COURSE_AI, grundbegrepp Candidate 100100
Section 1
Uppgift Uppgiftstyp
1 Textområde
2 Textområde
3 Textområde
1 I materialet introduceras flera viktiga begrepp som artificiell intelligens, autonomi, adaptivitet,
maskininlärning och data. **Välj 3 av dessa begrepp och förklara kort vad de betyder:**
- Artificiell intelligens (AI) - Autonomi - Adaptivitet - Maskininlärning - Data (i AI-sammanhang)
Skriv ditt svar här. Ändringar sparas automatiskt.
maskininlärning - innebär att man stärker en AI's förståelse genom att ge den massvis med
information.
autonomi - innebär att en AI blir självständig.
adaptivitet - den genererar svar beroende på vad man frågar.
Ord: 50
Besvarad.

## Page 3

COURSE_AI, grundbegrepp Candidate 100100
2 I materialet nämns tre huvudorsaker till varför artificiell intelligens är svårt att definiera. Beskriv
minst två av dessa orsaker och förklara varför de gör det svårt att avgöra vad som är AI och vad
som inte är det.
Skriv ditt svar här. Ändringar sparas automatiskt.
Det är svårt att identifiera pga att vi inte kan definera vad intelligens är.
Ord: 20
Besvarad.
3
Beskriv förhållandet mellan begreppen datavetenskap, artificiell intelligens, maskininlärning och
djupinlärning. Vilket är det bredaste området och vilket är mest specifikt? Motivera ditt svar.
Skriv ditt svar här. Ändringar sparas automatiskt.
Datavetenskap är det bredaste begreppet.
Ord: 7
Besvarad.
"""

# Inspera export with a SKIPPED question. Skipped questions carry the marker
# "Unanswered." (lowercase a) instead of "Answered." — so an end_marker of
# "Answered." must still terminate Q1 at its "Unanswered." line and NOT run on
# into Q2's answer. Synthetic data (no real student content). Regression for the
# skipped-question case: Q1 swallowed all following questions.
INSPERA_SKIPPED_FILE = """## Page 1

Section 1
1 Signalsubstans vs hormon
What is the difference between a signal substance and a hormone?
Enter your answer here...
Words: 0
Unanswered.
2 Synapsens funktion
Explain what a synapse is.
Enter your answer here...
A synapse is the junction between two neurons where signals pass.
Words: 11
Answered.
"""

# Classic exam format where TOC has question title + "Textområde"
CLASSIC_EXAM_FILE = """## Page 1

Section 1
Uppgift Uppgiftstyp
1 Restriktionsenzym (a-d) Textområde
2 DNA-replikation Textområde
1 Restriktionsenzym (a-d)
Beskriv vad restriktionsenzym är.
Skriv ditt svar här. Ändringar sparas automatiskt.
Ett restriktionsenzym klipper DNA.
Ord: 6
Besvarad.
"""


class TestExtractAnswerByMarkers:
    """Tests for question header matching logic (issue #13)."""

    def test_wrapped_question_text_startswith_fallback(self):
        """endswith fails for wrapped text, startswith fallback should work."""
        answer, ctx_before, ctx_after, wc = extract_answer_by_markers(
            file_content=INSPERA_STUDENT_FILE,
            question_header="1 I materialet introduceras",
            start_marker="sparas automatiskt.",
            end_marker="Ord:",
            answer_start_type="after_text",
            answer_end_type="marker",
        )
        assert answer is not None, "Should extract answer using startswith fallback"
        assert "maskininlärning" in answer
        assert wc > 0

    def test_question_header_on_separate_line(self):
        """Question 3 has number on its own line – header is the text line."""
        answer, _, _, wc = extract_answer_by_markers(
            file_content=INSPERA_STUDENT_FILE,
            question_header="Beskriv förhållandet mellan begreppen",
            start_marker="sparas automatiskt.",
            end_marker="Ord:",
            answer_start_type="after_text",
            answer_end_type="marker",
        )
        assert answer is not None, "Should match question with number on separate line"
        assert "bredaste" in answer

    def test_second_question_wrapped(self):
        """Question 2 also wraps across lines."""
        answer, _, _, wc = extract_answer_by_markers(
            file_content=INSPERA_STUDENT_FILE,
            question_header="2 I materialet nämns",
            start_marker="sparas automatiskt.",
            end_marker="Ord:",
            answer_start_type="after_text",
            answer_end_type="marker",
        )
        assert answer is not None
        assert "intelligens" in answer

    def test_endswith_still_works_for_classic_format(self):
        """endswith should still match classic format (no regression)."""
        answer, _, _, wc = extract_answer_by_markers(
            file_content=CLASSIC_EXAM_FILE,
            question_header="1 Restriktionsenzym (a-d)",
            start_marker="sparas automatiskt.",
            end_marker="Ord:",
            answer_start_type="after_text",
            answer_end_type="marker",
        )
        assert answer is not None, "endswith should match classic format"
        assert "restriktionsenzym" in answer.lower()

    def test_toc_entry_not_matched_in_classic_format(self):
        """TOC line '1 Restriktionsenzym (a-d) Textområde' must NOT be matched as header."""
        answer, _, _, wc = extract_answer_by_markers(
            file_content=CLASSIC_EXAM_FILE,
            question_header="1 Restriktionsenzym (a-d)",
            start_marker="sparas automatiskt.",
            end_marker="Ord:",
            answer_start_type="after_text",
            answer_end_type="marker",
        )
        assert answer is not None
        # Answer should be the actual student answer, not TOC content
        assert "klipper DNA" in answer

    def test_no_match_returns_none(self):
        """Non-existent question returns None."""
        answer, _, _, wc = extract_answer_by_markers(
            file_content=INSPERA_STUDENT_FILE,
            question_header="99 Nonexistent question",
            start_marker="sparas automatiskt.",
            end_marker="Ord:",
        )
        assert answer is None
        assert wc == 0


class TestSkippedQuestionBoundary:
    """Regression for the skipped-question case: a skipped question ('Unanswered.')
    must terminate at its own marker and not swallow following questions."""

    def test_skipped_question_does_not_swallow_next(self):
        """Q1 is skipped (Unanswered.). With end_marker 'Answered.' it must NOT
        run on into Q2's answer text."""
        answer, _, _, wc = extract_answer_by_markers(
            file_content=INSPERA_SKIPPED_FILE,
            question_header="1 Signalsubstans vs hormon",
            start_marker="Enter your answer here...",
            end_marker="Answered.",
            answer_start_type="after_text",
            answer_end_type="marker",
        )
        # Q1 was skipped → its answer must be empty/near-empty, and must NOT
        # contain Q2's content.
        assert answer is None or "synapse" not in (answer or "").lower(), (
            f"Skipped Q1 swallowed Q2's answer: {answer!r}"
        )

    def test_answered_question_still_extracted(self):
        """Q2 is answered → still extracts correctly (no regression)."""
        answer, _, _, wc = extract_answer_by_markers(
            file_content=INSPERA_SKIPPED_FILE,
            question_header="2 Synapsens funktion",
            start_marker="Enter your answer here...",
            end_marker="Answered.",
            answer_start_type="after_text",
            answer_end_type="marker",
        )
        assert answer is not None
        assert "synapse" in answer.lower()
        assert "junction" in answer.lower()
