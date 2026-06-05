# Phase 4C: Student Report - Instruktioner för Claude

**Version:** 1.0
**Status:** Methodology Instructions
**Purpose:** Guide Claude to create a simple per-student completion report

---

## Din roll i Phase 4C

Du skapar en **enkel överskiktsrapport** som visar vilka studenter som svarat på vilka frågor.

### Syfte

1. Ge läraren snabb överblick över alla studenters status
2. Flagga problem: korta svar, saknade svar, extremt korta svar
3. Visa completion rate per student

### Vad du INTE gör i 4C

- Du extraherar **inte** svarstexten (det gör 4D)
- Du bedömer **inte** svaren (det gör assessment)
- Du hittar **inte** exakta radnummer (det gör 4D)

---

## Input

Du får tillgång till:
1. Student markdown-filer i `02_markdown/student_answers/`
2. `exam_config.yaml` med frågelista (Q001-Q00X)

---

## Output

En enkel markdown-fil: `student_report.md`

### Format

```markdown
# Student Report: [Exam Name]

**Generated:** [datum]
**Total students:** 18
**Total questions:** 9

---

## Summary

| Status | Count |
|--------|-------|
| All answered | 15 |
| Warnings | 2 |
| Missing answers | 1 |

---

## TestElev10

| Question | Status | Words |
|----------|--------|-------|
| Q001 | ✅ Answered | 59 |
| Q002 | ✅ Answered | 77 |
| Q003 | ✅ Answered | 93 |
| Q004 | ✅ Answered | 69 |
| Q005 | ⚠️ Short | 39 |
| Q006 | ✅ Answered | 64 |
| Q007 | ✅ Answered | 57 |
| Q008 | ✅ Answered | 65 |
| Q009 | ✅ Answered | 107 |

**Completion:** 9/9 (100%)
**Warnings:** 1 (Q005 short answer)

---

## TestElev11

| Question | Status | Words |
|----------|--------|-------|
| Q001 | ⚠️ Short | 39 |
| Q002 | ✅ Answered | 40 |
| Q003 | ✅ Answered | 46 |
| Q004 | ⚠️ Short | 37 |
| Q005 | ❌ Very short | 14 |
| Q006 | ✅ Answered | 44 |
| Q007 | ⚠️ Short | 38 |
| Q008 | ❌ Very short | 25 |
| Q009 | ❌ Extremely short | 7 |

**Completion:** 9/9 (100%)
**Warnings:** 6 (multiple short/very short answers)

---
```

---

## Status Icons

| Icon | Meaning | Word count |
|------|---------|------------|
| ✅ | Answered | ≥40 words |
| ⚠️ | Short answer | 30-39 words |
| ❌ | Very short | 20-29 words |
| ❌ | Extremely short | <20 words |
| ➖ | Not answered | 0 words |

---

## Workflow

### Steg 1: Analysera studentfiler

För varje student i `02_markdown/student_answers/`:
1. Identifiera vilka frågor som har svar
2. Räkna ord per svar (approximativt)
3. Flagga korta svar

### Steg 2: Skapa rapport

1. Sammanfattning med totaler
2. Per-student tabell med status
3. Warnings och completion

### Steg 3: Spara

Spara som `student_report.md` i projektmappen.

---

## Tool Usage

```
phase4c_report(
  project_path: "/path/to/project",
  mode: "preview" | "save"
)
```

**Preview mode:** Visa rapport i response utan att spara
**Save mode:** Spara till fil

---

## Viktigt

- Håll det **enkelt** - detta är en överskiktsrapport
- Fokus på **completion** och **warnings**
- Läraren kan snabbt se vilka studenter som behöver extra uppmärksamhet
