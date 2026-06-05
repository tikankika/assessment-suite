# Phase 9: Kvalitativ Generalisering

**Version:** 1.1 — Theoretical revision
**Status:** Draft — Theoretical reframing (2026-03-30)
**Teoretisk grund:** Moss (1994, 2003) hermeneutisk syntes, Kane (2006) bakgrund, Hirsh (2019), Biggs & Collis (1982), Jönsson (2010)
**Datum:** 2026-03-08 (reviderad 2026-03-30)
**Författare:** Niklas Karlsson

---

## Purpose

Phase 9 takes the question-level assessments from Phase 6 and synthesizes them into a coherent picture of what the student has demonstrated across the entire exam. It answers the question: *given these individual question results, what can we say about this student's understanding of the subject as a whole?*

### Theoretical reframing (2026-03-30)

This document originally described Phase 9 as implementing Kane's (2006) **generalization inference** — a statistical inference from observed scores to a universe of possible scores. However, review of actual Phase 9 output (an earlier course run) revealed that Phase 9 does not perform statistical generalization. It performs **hermeneutic synthesis**: identifying patterns across questions, integrating qualitative evidence, and treating inconsistencies as informative signals rather than measurement error.

This is better described by Moss (1994, 2003), who argues for an interpretive approach to assessment where the assessor actively constructs meaning from student work — looking for coherence across responses, attending to the particular rather than averaging across instances, and applying professional judgment to resolve ambiguities.

Kane's framework remains relevant as the broader validity argument structure (the *reason* we need Phase 9 is to warrant the generalization inference). But the *method* Phase 9 uses is hermeneutic, not statistical. Phase 9 does not estimate a universe score — it builds an interpretive portrait of what the student has demonstrated.

> **Note:** References to Moss (1994, 2003) are preliminary — primary reading not yet completed. This reframing is based on secondary source analysis and observed system behaviour.

Phase 9 is where patterns emerge: strengths that recur across questions, weaknesses that cluster in specific areas, and tensions between quantitative scores and qualitative observations. These patterns are the raw material for Phase 10 (extrapolation to course criteria).

This document describes the generalization process as it is actually implemented. It replaces the previous `phase9_generalization_methodology.md` (53KB, archived) and integrates relevant principles from `phases9-12_ai_assisted_methodology.md` (archived).

---

## Theoretical Foundation

### Why Phase 9 exists: the generalization inference (Kane)

Kane (2006) describes four inferences in a validity argument for assessment: Scoring → Generalization → Extrapolation → Implications. The generalization inference connects observed scores on specific test items to broader claims about student competence. Kane's framework provides the *reason* Phase 9 is needed: without some form of generalization, individual question results remain isolated data points.

### How Phase 9 works: hermeneutic synthesis (Moss)

However, the *method* Phase 9 uses to achieve this is not Kane's statistical generalization ("a statistical inference from a sample to a population," Kane 2006, p. 23). Phase 9 performs what Moss (1994) calls hermeneutic assessment:

- **Pattern identification** across questions — looking for coherence and inconsistency in the student's responses
- **Qualitative integration** — building an interpretive portrait rather than estimating a universe score
- **Inconsistency as information** — when a student's answers contradict each other, this is treated as a meaningful signal (what does the tension reveal about their understanding?), not as measurement error to be averaged away
- **Professional judgment** — the teacher's subject knowledge and contextual understanding guide interpretation

Moss (1994) argues that reliability in the traditional psychometric sense (consistency across raters/occasions) is not the only — or always the best — warrant for assessment validity. When assessment involves complex, context-dependent performances, an interpretive approach that seeks coherence across the full body of evidence can be more valid than one that treats each response as an independent measurement.

In practice, this means Phase 9 must:
1. Identify whether the student's performance is **consistent** across questions (supporting generalization) or **inconsistent** (requiring interpretive attention — what does the inconsistency mean?)
2. Distinguish **systematic patterns** (areas of strength or weakness) from **isolated results** (one answer that doesn't fit the overall picture)
3. Be explicit about the **scope of the generalization** — it applies to what the exam covered, not to the full course domain

### Domain-specific understanding

Hirsh (2019) contextualizes Kane's framework for Swedish educational assessment, arguing that generalization should be grounded in the subject's structure rather than purely statistical reasoning. A student who scores 70% may have deep understanding in three areas and nothing in two, or moderate understanding everywhere. These profiles have different pedagogical implications even though the numbers are identical.

Phase 9 addresses this by requiring area-level analysis (DEL 1) before overall generalization (DEL 3).

### Five assessment principles

The following principles, originally articulated in `phases9-12_ai_assisted_methodology.md`, govern all Phase 9 analysis:

1. **Observation before interpretation.** Phase 9 first describes what the student *wrote* (observation) before drawing conclusions about what they *understand* (interpretation). Each claim about the student's knowledge must be traceable to specific answers.

2. **"What the exam shows" — not "what the student can do."** Phase 9 conclusions are limited to what the exam evidence supports. The student may know things they did not demonstrate on this particular exam. Formulations like "eleven kan inte..." are avoided in favor of "provsvaren visar inte...".

3. **Concrete examples.** Every generalization is grounded in specific question results. "The student shows strong analytical ability" must be followed by evidence: "(Q013 6/6p, Q014 7/8p — both multi-step reasoning questions)".

4. **Constructive language.** Weaknesses are described as *development areas* rather than *failures*. The goal is formative information, not classification.

5. **Exam-limited conclusions.** Phase 9 does not claim that the student "lacks understanding" in areas not covered by the exam. The scope of generalization is bounded by the exam content.

---

## Assessment Purpose Integration

Phase 9 reads the Assessment Purpose document (see `assessment_purpose_method.md`) to determine its depth level:

- **Full:** All three steps (STEG 1–3) as described below. Standard for prov, stort prov, and tenta/prövning.
- **Short:** A single step producing an overall knowledge profile with key strengths and development areas. Evidence is cited but condensed — no separate area-level analysis or pattern identification sections. Standard for minitest.

Phase 9 always runs — there is no "off" mode. Even the lightest pipeline level (minitest) includes a short knowledge profile.

If no Assessment Purpose document exists, Phase 9 defaults to **full** (backward compatibility).

### Short mode

When Assessment Purpose declares "short," Phase 9 produces a single section:

```markdown
## KUNSKAPSPROFIL

[2–4 sentences: overall picture of what this student demonstrated]

**Styrkor:** [Key strengths with evidence, 2–3 items]
**Utvecklingsområden:** [Key development areas with evidence, 2–3 items]
```

The same quality principles apply: evidence-grounded, scope-limited, constructive language. "Short" means fewer sections, not lower rigor per claim.

---

## The Generalization Process (Full Mode)

Phase 9 in full mode follows a three-step process, each producing a distinct section in the output document.

### STEG 1: Områdesvis analys (Area-level analysis)

**What it does:** Groups the student's question results by subject area and identifies area-level patterns.

**Why it matters:** Individual question results are noisy. A student who scored 0/2p on one ecosystem question may still have strong ecosystem understanding demonstrated in other questions. Area-level analysis aggregates evidence across questions that assess the same domain concept.

**How areas are defined:** Subject areas are derived from the exam content, not predefined. For COURSE_ENV, areas might include "Ekosystem och resiliens", "Planetära gränser", "Hållbar utveckling — grundbegrepp". The areas should be meaningful groupings from the subject's perspective — not arbitrary clusters.

If `exam_config.yaml` includes question-area mappings, use those. Otherwise, AI proposes areas based on question content, and the teacher confirms.

**Output format:**
```
### [Ämnesområde]
**Frågor:** Q003, Q009, Q013
**Resultat:** 12/14p (86%)
**Observation:** [Kort sammanfattning av vad svaren visar inom detta område]
```

**Quality check for STEG 1:**
- Does every exam question appear in at least one area?
- Are the areas meaningful subject categories, not just "easy questions" / "hard questions"?
- Does the observation describe what the student *wrote*, not just the score?

### STEG 2: Övergripande mönster (Cross-area patterns)

**What it does:** Identifies patterns that cut across areas: when does the student succeed? When do difficulties arise? What characterizes the student's approach?

**Why it matters:** Area-level analysis shows *where* the student is strong or weak. Pattern analysis shows *how* — the qualitative nature of their understanding. A student who consistently scores well on recall but poorly on analysis has a different profile from one who scores well on analysis but poorly on recall, even if their total scores are similar.

**Three pattern categories:**

1. **"När studenten lyckas"** — What characterizes questions where the student performs well? Question type (recall, application, analysis)? Specific cognitive operations (naming, explaining, connecting, evaluating)?

2. **"När svårigheter uppstår"** — What characterizes questions where the student struggles? Are the difficulties systematic (always in the same type of question) or sporadic?

3. **"Övergripande mönster"** — A synthesis: what kind of understanding does the student demonstrate overall? This is where tensions and contradictions are noted — e.g., strong analytical ability but weak factual foundation, or strong recall but limited ability to connect concepts.

**Output format:**
```
### När studenten lyckas
[Observation with evidence from specific questions]

### När svårigheter uppstår
[Observation with evidence from specific questions]

### Övergripande mönster
[Synthesis — what characterizes this student's demonstrated knowledge?]
```

**Quality check for STEG 2:**
- Does each pattern claim cite specific question results?
- Are "lyckas" and "svårigheter" genuinely different observations, not just "high scores" and "low scores"?
- Does the synthesis add insight beyond what STEG 1 already showed?

### STEG 3: Övergripande generalisering (Overall generalization)

**What it does:** Produces a single, coherent generalization of what this student has demonstrated on this exam. Includes a summary of strengths, development areas, and critical questions for Phase 10.

**Why it matters:** This is the deliverable that Phase 10 takes as input. It must be complete enough to support extrapolation to course criteria, but honest about what the exam evidence does and does not support.

**Output format:**
```
### Kunskapsprofil
[2–3 sentences: what does this student's exam show overall?]

### Övergripande styrkor
- [Strength 1 — with evidence]
- [Strength 2 — with evidence]

### Övergripande utvecklingsområden
- [Area 1 — with evidence]
- [Area 2 — with evidence]

### Kritiska frågor för Phase 10
- [Question 1 — what needs to be resolved in extrapolation?]
- [Question 2]
```

**Important:** Each section contains *distinct* content. The strengths list is not a subset of the Kunskapsprofil text. The development areas are not a truncation of the strengths section. If content would be repeated, it should be cross-referenced ("see Kunskapsprofil above") rather than duplicated.

**Quality check for STEG 3:**
- Is the Kunskapsprofil a genuine synthesis, not a list of scores?
- Are strengths and development areas supported by evidence from STEG 1 and STEG 2?
- Are the critical questions for Phase 10 genuinely open — things the generalization alone cannot resolve?
- Is there any duplicated text between sections? If so, restructure.

---

## Output Format

### Complete document structure

```markdown
# KVALITATIV GENERALISERING — [student_id]

**Kurs:** [course_code]
**Prov:** [exam_name]
**Student:** [student_id]
**Datum:** [ISO date]
**Teoretisk grund:** Moss (1994, 2003) hermeneutisk syntes, Kane (2006) bakgrund

---

## KVANTITATIV SAMMANFATTNING (från Phase 8)
**Totalpoäng:** X/Yp
**Procent:** Z%
**Besvarade frågor:** N/M

---

## DEL 1: OMRÅDESVIS ANALYS
[STEG 1 output — one subsection per subject area]

---

## DEL 2: ÖVERGRIPANDE MÖNSTER
[STEG 2 output — three subsections]

---

## DEL 3: ÖVERGRIPANDE GENERALISERING
[STEG 3 output — four subsections, no duplicated text]

---

*Genererat: [ISO timestamp]*
*Phase 9 Complete — Ready for Phase 10 (Extrapolering)*
```

### Metadata

The output file is named `Student_[id]_generalization.md` and placed in `09_qualitative/`.

---

## Human-AI Collaboration

### The dialogue process

Phase 9 is implemented as a **3-step dialogue** between AI and teacher. For each student:

1. **AI presents STEG 1** (area-level analysis) → Teacher confirms or adjusts area groupings and observations
2. **AI presents STEG 2** (patterns) → Teacher confirms or adjusts pattern identification
3. **AI presents STEG 3** (overall generalization) → Teacher confirms or adjusts the synthesis and critical questions

The teacher may proceed quickly through students with clear profiles and spend more time on students with contradictory or ambiguous results. The tool supports both modes.

### What AI contributes

AI's contribution is systematic coverage and pattern detection. Given 15 question results per student, AI can identify cross-question patterns (e.g., "consistently strong on multi-step reasoning questions") that a human might miss when reading through individual assessments sequentially. AI also maintains internal consistency in how patterns are described across students. **Cross-student comparison itself is performed only in Phase 13** — never in Phase 9 output. The Phase 9 document for student X must read as if X were the only student in the class.

### What the teacher contributes

The teacher's contribution is contextual interpretation and pedagogical judgement:

- **Subject knowledge:** Is the pattern AI identified meaningful from a subject perspective? "Consistently low on definition questions" may be significant (the student can't define terms) or trivial (the student defined things in their own words, penalized by rigid rubric application)
- **Teaching context:** What was emphasized in class? What are reasonable expectations?
- **Class patterns:** If many students show the same weakness, it may be a teaching issue rather than a student issue — the teacher can flag this for Phase 13
- **Proportionality:** How much weight should an unanswered question carry? (Timing issues vs. knowledge gaps)

### Teacher annotations in Phase 9

Teacher interventions during generalization are logged using `teacher_annotation`:

| Intervention | Type | Example |
|-------------|------|---------|
| Teacher regroups questions into different areas | `rubric_clarification` | "Q008 and Q009 belong to the same area" |
| Teacher identifies a class-level pattern | `calibration_note` | "Q008-Q009 weakness is common — likely a teaching gap" |
| Teacher adds context to explain a result | `context_addition` | "This student was absent for the resilience lecture" |
| Teacher adjusts a characterization | `score_adjustment` | "Not 'fragmented knowledge' — more 'uneven depth'" |

---

## Quality Criteria

### For individual generalizations

1. **Evidence-grounded:** Every claim about the student is traceable to specific Phase 6 results
2. **Scope-limited:** Conclusions are about *this exam*, not about the student's general ability
3. **Non-repetitive:** Each section (DEL 1, 2, 3) contains distinct content; no copy-paste between sections
4. **Balanced:** Both strengths and development areas are identified, even for very strong or very weak students
5. **Forward-pointing:** Critical questions for Phase 10 are genuine questions, not rhetorical

### For the full cohort (all students generalized)

1. **Consistent terminology:** The same patterns are described in the same way across students (e.g., if "fragmentarisk kunskap" is used for one student, similar profiles in other students should use the same term)
2. **Differentiated profiles:** Different students should have recognizably different generalizations — not templates with numbers swapped
3. **Class-level patterns visible:** If multiple students share a weakness, this should be visible across their individual generalizations (supporting Phase 13 analysis)

### What Phase 9 does NOT do

- It does not assign grades or grade levels (E/C/A). That is Phase 10–11.
- It does not match against course criteria or ILOs. That is Phase 10.
- It does not produce student-facing feedback. That is Phase 12/14.
- **It does not compare students to each other in any form** — neither normatively nor descriptively. Each generalization is criterion-referenced and stands as if the student were the only one in the cohort. Cross-student observation is reserved for Phase 13.

### Concrete prohibitions for Phase 9 output

The "no cross-student comparison" rule above implies these concrete prohibitions in the Phase 9 document body:

- No phrases such as "klassens högsta", "den enda eleven", "few students", "bland de bästa"
- No naming of other students by ID or description
- No SOLO terminology in section bodies (Extended Abstract, Relational, etc.) — if SOLO mapping is internally useful for the teacher, it belongs in `process_memo`, not in the Phase 9 document
- No "Lärarreflektion" sections that contain class-level observations
- No invalid grade extensions (the Swedish gymnasium scale is E/D/C/B/A; "A+" is not valid)

See §3.7 of `00_foundation.md` for the full audience-discipline framework.

---

## Relationship to Other Methodology Files

| File | Relationship |
|------|-------------|
| `phase6_assessment_method.md` | **Upstream:** Phase 6 produces the question-level assessments that Phase 9 synthesizes. Phase 9 reads Phase 6 output. |
| `phase10_extrapolation_method.md` | **Downstream:** Phase 10 takes Phase 9 generalizations and maps them to course criteria. The "Kritiska frågor för Phase 10" section bridges the two phases. |
| Rubric (`bedömningsanvisningar`) | **Reference:** Phase 9 may consult the rubric to verify whether area groupings align with the exam's intended structure. |
| `exam_config.yaml` | **Configuration:** May contain question-area mappings that inform STEG 1 grouping. |

---

## Common Edge Cases

**Student answered very few questions (≤3)?** Perform area analysis for the areas covered. Note in the generalization that limited breadth makes patterns less certain. The "Kritiska frågor för Phase 10" section should flag the gap explicitly.

**All answers are excellent?** Identify patterns anyway — *what* makes the student excellent? "No weaknesses identified on this exam" is a valid generalization. Phase 10 still needs to map the strengths to course criteria.

**Teacher cannot identify patterns?** That is fine. Some exams show no clear patterns — the student performs evenly. Document "prestation är jämn över alla frågor" or "inget tydligt mönster identifierat". An absence of pattern is itself informative.

**Qualitative patterns contradict quantitative data?** Note the contradiction explicitly. Example: "Quantitatively 62%, but qualitative analysis reveals deep understanding in three areas offset by two unanswered questions." This tension is precisely what Phase 10 needs to resolve.

**How detailed should area analysis be?** 2–3 strengths, 2–3 development areas per area. More than that becomes fragmented and loses the forest for the trees.

---

## Relationship to Assessment Purpose

| Assessment level | Phase 9 mode | What is produced |
|-----------------|--------------|------------------|
| Minitest | Short | Single knowledge profile section |
| Prov | Full | All three steps (STEG 1–3) |
| Stort prov | Full | All three steps (STEG 1–3) |
| Tenta/prövning | Full | All three steps (STEG 1–3) |

---

## References

- Biggs, J. B., & Collis, K. F. (1982). *Evaluating the Quality of Learning: The SOLO Taxonomy (Structure of the Observed Learning Outcome)*. Academic Press.
- Hirsh, Å. (2019). *Formativ undervisning: Utveckla klassrumspraktiker med lärande i fokus*. Natur & Kultur.
- Jönsson, A. (2010). *Lärande bedömning* (3rd ed.). Gleerups.
- Kane, M. T. (2006). Validation. In R. L. Brennan (Ed.), *Educational Measurement* (4th ed., pp. 17–64). American Council on Education/Praeger.
- Moss, P. A. (1994). Can there be validity without reliability? *Educational Researcher*, 23(2), 5–12. *(Preliminary — primary reading pending)*
- Moss, P. A. (2003). Reconceptualizing validity for classroom assessment. *Educational Measurement: Issues and Practice*, 22(4), 13–25. *(Preliminary — primary reading pending)*
