# Phase 13: Klassanalys — Vad bedömningen säger om undervisningen

**Version:** 1.0 — Rewritten from scratch
**Status:** Draft — Theoretical grounding added, arbitrary thresholds removed
**Teoretisk grund:** Black & Wiliam (2009), Hattie & Timperley (2007), 00_foundation.md §3
**Datum:** 2026-03-30
**Författare:** Niklas Karlsson

---

## Purpose

Phase 13 is the only class-level document in the pipeline. Its audience is the teacher *as instructor* — not as assessor (that was Phase 6-12), but as someone who will teach these students again, or teach this content again to new students.

The question Phase 13 answers: *What do these assessment results, taken together, tell me about my teaching and my students' collective needs?*

This is a different kind of synthesis than Phase 9. Phase 9 builds an interpretive portrait of one student. Phase 13 looks across all students for patterns that are invisible at the individual level: misconceptions shared by many, questions that didn't work as intended, groups of students who need different kinds of support.

### Theoretical basis

Black & Wiliam (2009) define formative assessment as "evidence elicited about student achievement to be interpreted and used by teachers to make decisions about the next steps in instruction." Phase 13 implements the *teacher-facing* dimension of this: it is not about grading or student feedback, but about what the teacher should do differently.

Hattie & Timperley (2007) note that feedback operates at multiple levels, including the *process level* (how the task was approached) and the *self-regulation level* (how the learner monitors their own learning). Phase 13 helps the teacher see these levels across the class — not just per student, but as collective patterns.

### What Phase 13 is NOT

- It is not a statistical report. Phase 8 already provides quantitative summaries.
- It is not a quality assurance document. It does not evaluate the exam itself (though it may note exam design issues).
- It is not a ranking or comparison of students. Individual students are mentioned only when their results illustrate a class-level pattern.

---

## Assessment Purpose Integration

Phase 13 reads the Assessment Purpose document to determine its depth level. Phase 13 always runs — even a minitest generates useful class-level insights.

- **Full:** All four parts as described below, with full dialogue. Standard for prov, stort prov, and tenta/prövning.
- **Short:** Class overview + top misconceptions + one key teaching recommendation. Standard for minitest.

If no Assessment Purpose document exists, Phase 13 defaults to **full** (backward compatibility).

### Short mode

When Assessment Purpose declares "short," Phase 13 produces:

```markdown
## KLASSÖVERSIKT
[Quantitative summary from Phase 8: N students, mean, range]

## VIKTIGASTE MÖNSTREN
[Top 2–3 misconceptions or shared difficulties, with evidence from Phase 9]

## REKOMMENDATION
[One concrete teaching action based on the patterns above]
```

Short mode is not just "less" — it focuses on what the teacher can *act on* immediately.

---

## Input

Phase 13 reads from all available upstream phases:

| Source | What it provides | Required? |
|--------|-----------------|-----------|
| Phase 8 (`08_quantitative/`) | Scores per student per question, totals, percentages | Yes |
| Phase 9 (`09_qualitative/`) | Knowledge profiles, strengths, weaknesses, patterns per student | Yes |
| Phase 10 (`10_extrapolation/`) | Criterion indications per student | No — enriches DEL 2 |
| Phase 12 (`12_feedback/`) | Development areas and strategies per student | No — enriches DEL 3 |

Phase 11 output is NOT used as input — grade decisions are not relevant to class-level teaching analysis.

---

## The Analysis Process (Full Mode)

Phase 13 follows a four-part process. Each part is presented to the teacher for confirmation and adjustment before proceeding.

### DEL 1: Klassöversikt (Class Overview)

**What it does:** Presents the quantitative landscape — a factual starting point before interpretation begins.

**Content from Phase 8:**
- Number of students
- Mean score and percentage
- Score range (min — max)
- Score distribution: how many students fall in each quartile?
- Per-question summary: which questions had highest/lowest class average?

**Presentation:** Table format. No interpretation yet — just the numbers.

**Teacher dialogue:** "Stämmer bilden med ditt intryck? Fanns det yttre faktorer som påverkar resultaten?" (illness, schedule issues, incomplete teaching coverage)

### DEL 2: Kollektiva mönster (Shared Patterns)

**What it does:** This is the core of Phase 13. It identifies understanding patterns that appear across multiple students — not by counting thresholds, but by looking for *qualitative similarity* in Phase 9 observations.

**Method:**

Read all Phase 9 documents. For each development area or weakness identified in Phase 9, ask: *Does a similar pattern appear in other students' Phase 9 profiles?*

"Similar" means qualitatively similar — not identical wording, but the same type of difficulty:
- Multiple students struggle to *connect* concepts that they can individually define (synthesis gap)
- Multiple students give correct but superficial answers to questions that require depth (depth gap)
- Multiple students leave the same question or area blank (coverage gap — may indicate teaching, not student, issue)
- Multiple students make the same factual error (specific misconception)

**For each shared pattern, document:**
- **Description:** What the pattern is, in pedagogical terms
- **Evidence:** Cite specific observations from Phase 9 documents. Name student IDs only if necessary to show the pattern; prefer anonymized descriptions ("6 av 14 elever visar samma mönster").
- **Which questions/areas it appears in:** Connect to exam content
- **Possible interpretation:** Is this likely a teaching gap, a common misconception, or a reflection of the exam design? *The teacher decides* — AI proposes.

**Important:** Do not use fixed numerical thresholds to define "shared." A pattern that appears in 3 of 14 students may be significant if it involves a central concept. A pattern in 8 of 14 students may be trivial if it reflects a poorly worded question. The teacher's professional judgment determines significance.

**If Phase 10 exists:** Add criterion-level analysis. Which criteria show weak class-level evidence? This connects teaching gaps to the formal learning objectives.

**Teacher dialogue:** "Känner du igen dessa mönster? Saknas något som du lagt märke till? Finns det mönster som beror på provets utformning snarare än elevernas förståelse?"

### DEL 3: Stödstrukturer (Support Structures)

**What it does:** Groups students by the *type of support they need* — not by score level.

**Method:**

Read Phase 9 and Phase 12 (if available). Identify groups based on qualitative need, not quantitative thresholds:

- **Students who need foundational support:** Phase 9 shows fragmented or absent understanding in core areas. These students need to revisit fundamentals.
- **Students who need depth support:** Phase 9 shows broad but shallow understanding. They know the concepts but can't connect or apply them.
- **Students who need challenge:** Phase 9 shows strong, integrated understanding. These students are ready for extension.
- **Students who need targeted intervention:** Phase 9 shows uneven profiles — strong in some areas, weak in others. They need specific, focused support.

**For each group:**
- Which students (by ID — this is an internal teacher document)
- What characterizes the group (qualitative description, not score range)
- Suggested approach (the teacher decides; AI proposes based on Phase 12 strategies if available)

**Why no percentage thresholds:** A student at 55% who has fragmented knowledge needs different support than a student at 55% who has depth in some areas and gaps in others. Percentage alone does not determine the type of support needed. Phase 9 data — the qualitative profile — is the basis for grouping.

**Explicit statement:** This section contains individual student IDs. It is an *internal teacher working document* — not for distribution to students, parents, or administration.

**Teacher dialogue:** "Stämmer grupperingarna? Finns det elever som du tycker hamnar i fel grupp? Vill du justera?"

### DEL 4: Undervisningsrekommendationer (Teaching Recommendations)

**What it does:** Translates the patterns from DEL 2 and the groups from DEL 3 into concrete teaching actions.

**Two time horizons:**

**For these students now:**
- Based on the shared patterns: what should the teacher address in upcoming lessons?
- Based on the support groups: how can the teacher differentiate instruction?
- Based on Phase 12 strategies (if available): which strategies recur and could be addressed at class level?

**For next time this content is taught:**
- Based on DEL 2: which concepts need more teaching time or a different approach?
- Based on DEL 1 per-question data: are there questions that should be revised? (Too hard for everyone? Too easy? Poorly worded — everyone misunderstood the same way?)

**Quality criteria for recommendations:**
- Each recommendation connects to a specific finding in DEL 1, 2, or 3
- Recommendations are concrete actions ("Lägg till en övning som kopplar X till Y") not abstract advice ("Undervisa bättre om X")
- Number is limited: 3–5 recommendations total, prioritized

**Teacher dialogue:** "Vad vill du lägga till, ändra, eller ta bort? Vilken rekommendation är viktigast att agera på?"

---

## Output Format

```markdown
# KLASSANALYS — [exam_name]

**Kurs:** [course_code]
**Prov:** [exam_name]
**Datum:** [ISO date]
**Antal studenter:** [N]
**Typ:** Lärarens arbetsdokument (Phase 13)

---

## DEL 1: KLASSÖVERSIKT

[Quantitative summary — table format]
[Teacher's contextual notes if any]

---

## DEL 2: KOLLEKTIVA MÖNSTER

### Mönster 1: [Description]
**Evidens:** [Phase 9 citations]
**Berörda frågor/områden:** [...]
**Tolkning:** [Teacher-confirmed interpretation]

### Mönster 2: [...]

---

## DEL 3: STÖDSTRUKTURER

### Behöver grundstöd
[Students, characterization, suggested approach]

### Behöver fördjupningsstöd
[Students, characterization, suggested approach]

### Behöver utmaning
[Students, characterization, suggested approach]

### Behöver riktad insats
[Students, characterization, suggested approach]

---

## DEL 4: UNDERVISNINGSREKOMMENDATIONER

### För dessa elever nu
1. [Recommendation with link to DEL 2/3 finding]
2. [...]

### Inför nästa kursomgång
1. [Recommendation with link to DEL 1/2 finding]
2. [...]

---

*Genererat: [ISO timestamp]*
*Phase 13 Complete*
```

Output file: `13_teacher_summary/Class_Summary.md`

---

## Human-AI Collaboration

### What AI contributes

- **Pattern detection:** AI reads all Phase 9 documents and identifies qualitative similarities that a teacher might miss when reviewing students one at a time
- **Data aggregation:** AI compiles Phase 8 data into class-level summaries
- **Draft recommendations:** AI proposes teaching actions based on observed patterns and Phase 12 strategies

### What the teacher contributes

- **Pattern validation:** Not every AI-detected pattern is meaningful. The teacher knows whether a shared weakness reflects a teaching gap, a common misconception, or a poorly designed question
- **Contextual knowledge:** External factors (missed lessons, substitute teacher, curriculum changes) that explain results
- **Priority setting:** Which patterns matter most? Which recommendations are actionable given real constraints?
- **Student grouping:** The teacher may know reasons to group students differently than the data suggests

---

## Quality Criteria

1. **Evidence-grounded:** Every pattern claim traces to specific Phase 9 observations or Phase 8 data
2. **Qualitatively grouped:** Support structures are based on the type of need, not score cutoffs
3. **Actionable:** Each recommendation is concrete enough for the teacher to act on
4. **Teacher-validated:** The teacher has confirmed or adjusted every pattern, grouping, and recommendation
5. **Observation before interpretation:** (00_foundation.md §3.1) — "Datan visar att 8 av 14 elever..." not "Eleverna förstår inte..."
6. **Privacy-conscious:** Individual student IDs appear only in DEL 3 (support structures), which is explicitly marked as internal

---

## Relationship to Other Methodology Files

| File | Relationship |
|------|-------------|
| `phase9_generalization_method.md` | **Upstream (primary):** Phase 9 provides the individual student profiles that Phase 13 aggregates into class patterns. |
| `phase10_extrapolation_method.md` | **Upstream (enriches):** Phase 10 criterion indications add a criterion-level dimension to class analysis. |
| `phase12_feedback_method.md` | **Upstream (enriches):** Phase 12 development strategies, when aggregated, reveal class-level teaching opportunities. |
| `assessment_purpose_method.md` | **Configuration:** Determines full vs short mode. |
| `00_foundation.md` | **Principles:** §3.1 (observation not interpretation), §3.2 (generous interpretation), §3.3 (cite evidence). |

---

## References

- Black, P., & Wiliam, D. (2009). Developing the theory of formative assessment. *Educational Assessment, Evaluation and Accountability*, 21(1), 5–31. — *Formative assessment as evidence for instructional decisions.*
- Hattie, J., & Timperley, H. (2007). The power of feedback. *Review of Educational Research*, 77(1), 81–112. — *Multi-level feedback; process and self-regulation levels relevant to class analysis.*
