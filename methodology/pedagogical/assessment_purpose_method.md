# Assessment Purpose — Bedömningens syfte och djup

**Version:** 0.2 — Draft
**Status:** Draft — Not yet tested
**Teoretisk grund:** Messick (1989) konsekvensvaliditet, Moss (1994/2003) professionellt omdöme, Parasuraman & Manzey (2010) automation bias
**Datum:** 2026-03-30
**Författare:** Niklas Karlsson

---

## Purpose

Assessment Purpose is not a phase. It is a **living document** — a professional declaration that follows the assessment from start to finish. The teacher articulates the assessment's purpose before the first student answer is read, and revisits that declaration as data becomes available.

The document has three touch points across the pipeline:

1. **Touch point 1 — Deklaration** (project setup, before Phase 6): The teacher states what this assessment is for and sets the default pipeline level. This happens *before* assessment begins, because the purpose must be conscious from the start.

2. **Touch point 2 — Påverkan** (Phase 6, future): The declared purpose influences how detailed the analytic assessment needs to be. A formative minitest may not require per-question qualitative comments. *(Not yet implemented — noted as future development.)*

3. **Touch point 3 — Bekräftelse/justering** (after Phase 8): The teacher sees quantitative data and confirms or adjusts the original declaration. This is where per-student differentiation happens: borderline students may need deeper analysis than the default level provides.

### Why this exists

Assessment Suite was designed for depth. Every phase produces thorough, evidence-grounded output. This is exactly right for a grading exam where every inference must be warranted. But the same depth applied to a formative 8-question quiz produces hundreds of pages that the teacher cannot realistically review.

Messick (1989) argues that validity includes the *consequences* of assessment use — what an assessment is used for determines what evidence is needed. A formative quiz with no grading consequences needs lighter analysis than a formal examination. Assessment Purpose implements this: the teacher's declared purpose determines the pipeline depth.

Parasuraman & Manzey (2010) document the automation bias risk: when systems produce more output than humans can review, the output gets rubber-stamped rather than critically examined. Unread analysis and no analysis produce the same practical outcome — no human judgment applied.

### The core principle

> *Consciously choosing lower depth is not data loss — it is a prioritization that increases the probability that the teacher actually reviews what is produced.*

---

## Touch Point 1: Deklaration (Project Setup)

The first touch point happens early — at project setup, before Phase 6 begins. The teacher answers two questions:

### FRÅGA 1: Vad är syftet med den här bedömningen?

The teacher declares the assessment purpose. This is a pedagogical act: the examiner makes the purpose explicit before any assessment work begins.

**Four levels:**

| Level | Typical use | What the teacher needs |
|-------|-------------|----------------------|
| **Minitest** | KK, quiz, diagnostic | Feedback to students + formative overview for the teacher |
| **Prov** | Partial exam, not sole grading basis | Pattern analysis + indication of student standing |
| **Stort prov** | Major assessment, heavy evidence | Full analysis, criteria mapping, may inform grading |
| **Tenta/prövning** | Formal examination, grading | Complete validity documentation, grade decisions |

### FRÅGA 2: Vilka faser och vilket djup?

Based on the teacher's answer, the AI proposes a pipeline configuration. The teacher confirms or adjusts.

**Minitest:**
- Phase 9: **short** — overall knowledge profile, key strengths and development areas
- Phase 10: off
- Phase 11: off
- Phase 12: **short** — where is the student, key next steps
- Phase 13: **short** — top 3 misconceptions, one teaching recommendation
- Phase 14: **short** — strengths, development areas, 2–3 tips + per-question assessments

**Prov:**
- Phase 9: full
- Phase 10: **short** — criterion indications without full interpretive analysis
- Phase 11: off
- Phase 12: **short**
- Phase 13: full
- Phase 14: full

**Stort prov:**
- Phase 9: full
- Phase 10: full
- Phase 11: rare — only if teacher explicitly wants a grade indication
- Phase 12: full
- Phase 13: full
- Phase 14: full

**Tenta/prövning:**
- All phases: full

The teacher can override any suggestion:
- "Hoppa över Phase 10 helt"
- "Ge mig full Phase 12 istället för kort"
- "Jag vill ha Phase 11 trots att det är ett prov — vi har en gränsfallsstudent"

### Why before Phase 6

The purpose must be conscious *before* the teacher starts assessing. Two reasons:

1. **Syftemedvetenhet:** The act of formulating purpose forces the examiner to think about what the assessment is for. This is itself a quality measure — an examiner who has articulated the purpose makes better assessment decisions.

2. **Future Phase 6 impact:** When Touch Point 2 is implemented, the declared purpose will influence how detailed the analytic assessment (Phase 6) needs to be. Setting purpose early makes this possible.

---

## Touch Point 2: Påverkan på Phase 6 (Future)

> *Not yet implemented. Documented here as design intent.*

When the teacher has declared "minitest," the Phase 6 assessment process could be adapted: less detailed per-question comments, focus on total scores and overall patterns rather than fine-grained qualitative analysis. This reduces the teacher's workload at the earliest possible point in the pipeline.

The design question is how much Phase 6 can be lightened without losing the data needed for Phase 9+ at the declared depth. This requires careful analysis of what Phase 9 short, Phase 12 short, and Phase 13 short actually need as input.

---

## Touch Point 3: Bekräftelse/justering (After Phase 8)

After Phase 8 delivers quantitative results, the teacher revisits the declaration. The AI presents:

- Phase 8 quantitative summary (total scores, class mean, score distribution)
- The teacher's original declaration from Touch Point 1
- Any notable patterns: bimodal distribution, many blank answers, borderline students

### FRÅGA 3: Finns det enskilda studenter som behöver djupare analys?

The AI suggests candidates based on Phase 8 data:

- **Gränsfall:** Students near pass/fail thresholds
- **Extremfall:** Very low or very high scores that may need investigation
- **Ojämna profiler:** Students with high variance between questions

**What the AI says:**

> "Din deklaration: [minitest/prov/stort prov/tenta]. Phase 8 visar [N] studenter, medel [X]%, spridning [Y–Z].
>
> Tre studenter sticker ut:
> - två studenter nära godkäntgränsen (~52%)
> - en student med extremt ojämn profil (stark i ett delområde, nära noll i ett annat)
>
> Vill du bekräfta [minitest]-nivå för alla, eller justera för någon?"

The teacher can:
- Confirm the original declaration unchanged
- Upgrade individual students to deeper analysis
- Change the overall level if Phase 8 data suggests the original was wrong
- Add students the AI didn't suggest

---

## Output

Assessment Purpose produces a **living document** stored in the project. It is created at Touch Point 1 and updated at Touch Point 3. All subsequent phases reference it.

```markdown
# ASSESSMENT PURPOSE — [exam_name]

**Kurs:** [course_code]
**Prov:** [exam_name]

---

## Touch Point 1: Deklaration ([date])

**Bedömningstyp:** [Minitest / Prov / Stort prov / Tenta-prövning]
**Syfte:** [Teacher's stated purpose in their own words]

### Pipeline-konfiguration

| Fas | Djup | Kommentar |
|-----|------|-----------|
| Phase 9 | [full/short/off] | |
| Phase 10 | [full/short/off] | |
| Phase 11 | [full/short/off] | |
| Phase 12 | [full/short/off] | |
| Phase 13 | [full/short/off] | |
| Phase 14 | [full/short/off] | |

## Touch Point 3: Bekräftelse ([date])

**Bekräftad nivå:** [Same / Changed to X]
**Antal studenter:** [N]

### Individuella undantag

| Student | Djup | Anledning |
|---------|------|-----------|
| [student_id] | [full pipeline] | [Gränsfall — 52%] |

---

*Assessment Purpose — Ready for Phase 9*
```

---

## What "Short" Means

"Short" is not "less careful." The core principles from 00_foundation.md apply at every depth level: observation before interpretation (§3.1), generous interpretation (§3.2), cite the student's words (§3.3), forward-looking feedback (§3.5).

"Short" means: fewer sections, less text, same rigor per claim.

| Phase | Full | Short |
|-------|------|-------|
| **9** | Three steps: area analysis → patterns → generalization | One step: knowledge profile with key strengths and development areas. Evidence cited but condensed. |
| **10** | Three steps: criteria matching → interpretations → summary | One step: criterion indications with confidence, no full interpretive analysis |
| **12** | Three sections: Var / Vart / Hur. Pattern-to-strategy logic. | Two sections: Var / Hur. Key next steps, fewer strategies per area. |
| **13** | Full: misconceptions, question analysis, teaching recs, support needs | Overview: top 3 misconceptions with counts, key teaching recommendation |
| **14** | Full feedback with per-question assessments, strategies | Shorter synthesis + per-question assessments. 2–3 key tips. |

---

## Human-AI Collaboration

### What AI contributes

- **Default suggestion:** Proposes pipeline level based on exam_config defaults
- **Data presentation:** At Touch Point 3, summarizes Phase 8 to support the confirmation/adjustment decision
- **Candidate identification:** Flags borderline, extreme, and uneven students for potential deeper analysis
- **Consistency:** Ensures the purpose document is complete and that downstream phases respect it

### What the teacher contributes

- **Purpose declaration:** Only the teacher knows what this assessment is *for* — and they declare it before assessment begins
- **Proportionality judgment:** How much time and attention can the teacher invest in reviewing?
- **Student knowledge:** Which students might need special attention beyond what the numbers show?
- **Override authority:** The teacher can deviate from any suggestion at any touch point

---

## Quality Criteria

1. **The teacher declared a purpose before assessment began.** Touch Point 1 happened before Phase 6.
2. **The pipeline matches the purpose.** A formative quiz doesn't produce grade decisions; an exam doesn't skip criteria mapping.
3. **The declaration was revisited.** Touch Point 3 happened after Phase 8 — the teacher confirmed or adjusted with data.
4. **Exceptions are justified.** If a student gets deeper analysis than the default, the reason is documented.
5. **The purpose document exists.** Every project that runs Phase 9+ has an Assessment Purpose document.

---

## Relationship to Other Methodology Files

| File | Relationship |
|------|-------------|
| `00_foundation.md` | **Upstream:** Assessment Purpose assumes the teacher has access to core principles (§3). The purpose declaration does not change the principles — only the depth of their application. |
| `phase9_generalization_method.md` | **Downstream:** Phase 9 reads the purpose document to determine depth (full or short). |
| `phase10_extrapolation_method.md` | **Downstream:** Phase 10 activates only if the purpose document says so. |
| `phase12_feedback_method.md` | **Downstream:** Phase 12 reads depth setting from purpose document. |
| `phase14_student_feedback_method.md` | **Downstream:** Phase 14 reads depth setting. |

---

## References (Preliminary)

> **Note:** Primary sources not yet read in full. References are based on secondary reading and will be verified during the methodology literature review.

- Messick, S. (1989). Validity. In R. L. Linn (Ed.), *Educational Measurement* (3rd ed., pp. 13–103). American Council on Education/Macmillan. — *Consequences as a facet of validity; assessment purpose determines required evidence.*
- Moss, P. A. (1994). Can there be validity without reliability? *Educational Researcher*, 23(2), 5–12. — *Professional judgment as a valid approach to assessment interpretation.*
- Moss, P. A. (2003). Reconceptualizing validity for classroom assessment. *Educational Measurement: Issues and Practice*, 22(4), 13–25. — *Hermeneutic approach; the assessor's interpretive role.*
- Parasuraman, R., & Manzey, D. H. (2010). Complacency and bias in human use of automation. *Human Factors*, 52(3), 381–410. — *Automation bias; unreviewed output provides no validity.*
