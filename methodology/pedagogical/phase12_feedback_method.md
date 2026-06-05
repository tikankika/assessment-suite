# Phase 12: Formativ Återkoppling — Lärarens Arbetsdokument

**Version:** 1.1 — Assessment Purpose integration
**Status:** Draft — Updated 2026-03-30 with proportionality integration
**Teoretisk grund:** Hattie & Timperley (2007), Sadler (1989), Lundahl (2014)
**Datum:** 2026-03-08 (reviderad 2026-03-30)
**Författare:** Niklas Karlsson

---

## Purpose

Phase 12 produces a **comprehensive feedback document** for each student — the teacher's internal working document that synthesizes everything the assessment process has revealed about this student's performance on this exam.

This document is not what the student sees. It is the teacher's complete analysis: where the student is, what the evidence shows, what patterns emerge, and what the student needs to do next. Phase 14 subsequently selects and rewrites from this document to produce the student-facing feedback.

Phase 12 is where the assessment process becomes genuinely formative. Phases 6–10 analyzed performance. Phase 12 translates that analysis into actionable information. The key question shifts from "how did the student perform?" to "what should the student do next, and why?"

### What Phase 12 adds beyond Phase 6 "Nästa steg"

Phase 6 produces question-level feedback ("Nästa steg" per question). Phase 12 produces *student-level* feedback — synthesizing across all questions to identify:

- Recurring patterns (strengths that appear across questions, weaknesses that recur)
- Cross-question strategies (not "study Q8 better" but "practice connecting concepts across domains")
- Prioritized development areas (which areas matter most for the student's progression)

A student who received 15 separate "Nästa steg" in Phase 6 gets one coherent development plan in Phase 12.

### Input sources

Phase 12 draws from:

1. **Phase 9 (generalization):** Student-level patterns — when the student succeeds, when difficulties arise, overall knowledge profile. This is the primary analytical input.
2. **Phase 10 (extrapolation):** Criterion-level indications — how the student's performance maps to course criteria. Provides the "Vart?" (where is the student heading?) dimension.
3. **Phase 8 (quantitative):** Point totals per question — provides concrete data points for reference.

If Phase 10 has not been completed, Phase 12 works from Phase 9 alone. The "Vart?" section then focuses on exam-demonstrated level rather than criterion mapping.

Phase 12 does **not** depend on Phase 11 (grading decision). Feedback can and should be produced independently of grading.

---

## Theoretical Foundation

### Feedback as bridge between assessment and learning

Hattie and Timperley (2007) identify feedback as among the most powerful influences on learning, but only when it answers three questions:

1. **Where am I going?** (Feed up) — What are the learning goals?
2. **How am I going?** (Feed back) — How does my current performance relate to those goals?
3. **Where to next?** (Feed forward) — What concrete steps will move me toward the goals?

Their meta-analysis shows that feed-forward (Question 3) has the strongest effect on learning, yet is the most frequently omitted in practice. Phase 12 therefore structures its output to ensure all three questions are answered, with particular emphasis on the third.

> "The most effective feedback provides cues or reinforcement to learners; is in the form of video-, audio-, or computer-assisted instructional feedback; and/or relates to goals." (Hattie & Timperley, 2007, p. 84)

### The student must understand the quality gap

Sadler (1989) argues that formative assessment works only when the student can perceive the gap between their current performance and the desired performance, and has strategies for closing that gap:

> "The indispensable conditions for improvement are that the student comes to hold a concept of quality roughly similar to that held by the teacher, is able to monitor continuously the quality of what is being produced during the act of production itself, and has a repertoire of alternative moves or strategies from which to draw at any given point." (Sadler, 1989, p. 121)

Phase 12 addresses this by:
- Making the quality standard explicit (what does good performance look like in this area?)
- Describing the student's current position relative to that standard
- Providing concrete strategies the student can use to close the gap

### Pattern-to-strategy logic

The distinctive contribution of Phase 12 is the **pattern-to-strategy** connection: using Phase 9 patterns to generate strategies that leverage the student's existing strengths.

The logic: if Phase 9 identified that a student succeeds when they can use concrete examples but struggles with abstract reasoning, then Phase 12 should recommend strategies that *start from* concrete examples and *build toward* abstract reasoning — not simply say "improve your abstract reasoning."

This aligns with Lundahl's (2014) emphasis on feedback that connects to the student's demonstrated abilities rather than treating weaknesses in isolation.

---

## Assessment Purpose Integration

Phase 12 reads the Assessment Purpose document (see `assessment_purpose_method.md`) to determine its depth level. Phase 12 *always* runs — feedback is valuable regardless of assessment type.

- **Full:** All three steps (Var/Vart/Hur) with full pattern-to-strategy logic. Standard for stort prov and tenta/prövning.
- **Short:** Two sections: Var + Hur. Key next steps, fewer strategies per area. "Vart?" is omitted or abbreviated to one sentence. Standard for minitest and prov.

If no Assessment Purpose document exists, Phase 12 defaults to **full** (backward compatibility).

### Short mode

When Assessment Purpose declares "short," Phase 12 produces:

```markdown
## VAR ÄR ELEVEN NU?
[Performance summary, strengths, development areas — same quality as full, briefer]

## NÄSTA STEG
[1–2 key strategies per development area, leveraging strengths]
```

The "Vart?" (goal/criterion context) section is omitted — for a minitest or prov, the criterion-level analysis from Phase 10 is either absent or abbreviated. The feed-forward dimension ("Hur?") is renamed "Nästa steg" and focuses on the most important 2–3 actions.

---

## The Feedback Process (Full Mode)

Phase 12 in full mode follows Lundahl's three-step structure, adapted to the Assessment Suite's data.

### STEG 1: Var är eleven nu? (Feed back)

**What it does:** Summarizes the student's demonstrated performance on this exam, grounded in Phase 9 observations.

**Content:**
- Brief performance summary (2–3 sentences, including quantitative context from Phase 8)
- Concrete strengths with evidence ("Du visar stark förståelse för X — på Q13 och Q14 utvecklade du flerleddiga resonemang med korrekt begreppsanvändning")
- Concrete development areas with evidence ("Dina svar på korta definitionsfrågor (Q1, Q7) visar att du har kunskapen men formulerar dig oprecist")

**Quality criteria:**
- Every claim cites specific exam evidence
- Both strengths and development areas are present (even for very strong or very weak students)
- Language is descriptive, not evaluative ("provsvaren visar", not "du är dålig på")

### STEG 2: Vart är eleven på väg? (Feed up)

**What it does:** Connects the student's current position to the course goals, drawing on Phase 10 if available.

**If Phase 10 exists:**
- Which criteria/ILOs are well-supported by the exam evidence?
- Which criteria need more evidence or development?
- What does the next quality level look like in concrete terms?

**If Phase 10 does not exist:**
- What level of understanding does the exam demonstrate?
- What would stronger performance look like on the areas where the student is weakest?
- What are the most important areas for development given the course goals?

**Quality criteria:**
- Goals are expressed in terms the student can understand
- "The next level" is described concretely, not abstractly ("utvecklade resonemang som kopplar minst två orsaker till konsekvenser" — not just "mer utvecklade resonemang")
- The description does not require the student to read the rubric to understand it

### STEG 3: Hur tar eleven sig dit? (Feed forward)

**What it does:** Provides concrete, actionable strategies for each key development area. This is the most critical section.

**The pattern-to-strategy method:**

1. **Identify the Phase 9 pattern** — what characterizes the student's success/difficulty?
2. **Leverage existing strengths** — how can what the student already does well support development?
3. **Propose 2–3 concrete strategies** per development area, formulated as actions the student can take

**Example:**
```
Phase 9 pattern: "Studenten lyckas med resonemangsfrågor men missar korta definitioner"
→ Strength: Kan resonera, har kunskapen
→ Strategy: "Innan du svarar på en kort definitionsfråga, tänk igenom ett längre
  resonemang om begreppet — och kondensera sedan till kärnan. Din styrka i resonemang
  kan hjälpa dig formulera bättre definitioner."
```

**Quality criteria:**
- Each strategy is specific enough for the student to act on
- Strategies build on Phase 9-identified strengths, not just "study more"
- Strategies are calibrated to the student's level (a student at 20% needs different advice than one at 80%)
- Number of strategies is limited (2–3 per area) — not overwhelming

---

## Output Format

### Complete document structure

```markdown
# ÅTERKOPPLING — [student_id]

**Kurs:** [course_code]
**Prov:** [exam_name]
**Student:** [student_id]
**Datum:** [ISO date]
**Typ:** Lärarens arbetsdokument (Phase 12)

---

## VAR ÄR ELEVEN NU?

[Performance summary with quantitative context]

**Styrkor:**
- [Strength 1 — with evidence]
- [Strength 2 — with evidence]

**Utvecklingsområden:**
- [Area 1 — with evidence]
- [Area 2 — with evidence]

---

## VART ÄR ELEVEN PÅ VÄG?

[Criterion/goal context from Phase 10, or level description from Phase 9]

**Starka områden:**
- [Area with indication level]

**Områden att utveckla:**
- [Area with description of next level]

---

## HUR TAR ELEVEN SIG DIT?

### Utvecklingsområde 1: [Area]

**Mönster (från Phase 9):** [Pattern description]
**Strategier:**
1. [Concrete strategy leveraging strength]
2. [Concrete strategy]

### Utvecklingsområde 2: [Area]

**Mönster (från Phase 9):** [Pattern description]
**Strategier:**
1. [Concrete strategy]
2. [Concrete strategy]

---

## SAMMANFATTNING

[2–3 sentences: key message for this student]

---

*Genererat: [ISO timestamp]*
*Phase 12 Complete — Ready for Phase 14 (Elevåterkoppling)*
```

### Metadata

Output file: `12_feedback/Student_{id}_feedback.md`

---

## Human-AI Collaboration

### The dialogue process

Phase 12 follows a 3-step dialogue:

1. **AI presents STEG 1** (Var?) → Teacher confirms performance summary, adjusts emphasis
2. **AI presents STEG 2** (Vart?) → Teacher adds course context, adjusts goal descriptions
3. **AI presents STEG 3** (Hur?) → Teacher reviews strategies, adds course-specific recommendations, adjusts calibration

### What AI contributes

- **Pattern synthesis:** AI draws on Phase 9 patterns to propose the pattern-to-strategy connections
- **Consistency:** AI ensures all three steps are complete and evidence-grounded
- **Draft generation:** AI produces a complete feedback draft that the teacher can refine rather than write from scratch

### What the teacher contributes

- **Authenticity:** The teacher makes the feedback feel like it comes from a real teacher who knows the student
- **Course context:** "Read chapter 5" or "Practice with the exercises from week 3" — specific to what was taught
- **Calibration:** Is this the right amount of criticism? The right level of encouragement?
- **Priority:** With limited student attention, which development area matters most?

---

## Quality Criteria

### For individual feedback documents

1. **Complete:** All three steps (Var/Vart/Hur) are present and substantive
2. **Evidence-grounded:** Every claim traces back to specific exam evidence
3. **Actionable:** The student (or teacher, for Phase 12) can identify concrete next steps
4. **Pattern-connected:** Strategies explicitly connect to Phase 9 patterns
5. **Strength-leveraging:** At least one strategy builds on the student's identified strengths
6. **Appropriately calibrated:** Tone and expectations match the student's demonstrated level

### For the full cohort

1. **Differentiated:** Different students receive recognizably different feedback, not templates
2. **Consistent standards:** What counts as a "strength" is calibrated similarly across students

### Class-level pattern handling in Phase 12

Phase 12 **is** a teacher-internal document **but** it is the **sole input** to Phase 14 (student-facing). Therefore Phase 12 must be careful with class-level observations: anything written here will surface to the student unless explicitly filtered out at the Phase 12 → Phase 14 transition.

**Allowed in Phase 12:**

- A single descriptive sentence flagging that "this development area appears in several students' Phase 9 profiles" — for the teacher's awareness during comparison with Phase 13.
- Internal calibration notes ("verified consistent with Phase 9 profile of similar students") — provided these notes are kept in `process_memo` or `Teacher_Insights.md`, **not** in the Phase 12 document body.

**Not allowed in Phase 12 (because they will leak into Phase 14):**

- Comparative phrasing ("klassens högsta", "klassens topp-elev", "den enda eleven")
- Naming other students by ID or description
- Class averages, rankings, percentiles
- "Most sophisticated", "first to do X", "only student to..."
- Research terminology that would be inappropriate if the student read it (SOLO, Relational, Extended Abstract, etc.)
- Any language the AI would not willingly include in Phase 14 — the test for Phase 12 phrasing is *"would I be comfortable with the student reading this?"*

If a class-level pattern is genuinely important for course planning, it belongs in **Phase 13** (class-level teacher summary), not in Phase 12.

### What Phase 12 does NOT do

- It does not assign grades (that is Phase 10/11)
- It is not the document the student receives (that is Phase 14)
- It does not aggregate or analyse class-level patterns (that is Phase 13)

---

## Relationship to Other Methodology Files

| File | Relationship |
|------|-------------|
| `phase9_generalization_method.md` | **Upstream (primary):** Phase 9 provides the student-level patterns that Phase 12 translates into feedback. The pattern-to-strategy logic depends on Phase 9 quality. |
| `phase10_extrapolation_method.md` | **Upstream (optional):** Phase 10 provides criterion-level indications that enrich the "Vart?" section. Phase 12 works without Phase 10 but is stronger with it. |
| `phase14_student_feedback_method.md` | **Downstream:** Phase 14 selects from and rewrites Phase 12 for the student. Phase 12 is Phase 14's sole input source. |
| `phase6_assessment_method.md` | **Upstream (indirect):** Phase 6 "Nästa steg" provides question-level feedback. Phase 12 synthesizes across questions for student-level feedback. |

---

## References

- Hattie, J., & Timperley, H. (2007). The power of feedback. *Review of Educational Research*, 77(1), 81–112.
- Lundahl, C. (2014). *Bedömning för lärande*. Studentlitteratur.
- Sadler, D. R. (1989). Formative assessment and the design of instructional systems. *Instructional Science*, 18, 119–144.
