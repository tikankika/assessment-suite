# ADR-003: Progressive Methodology Loading and Project-Specific Sources

**Status:** Proposed
**Date:** 2025-12-31
**Deciders:** Niklas Karlsson
**Technical Story:** Methodology loading too heavy, rubric section not found

---

## Context and Problem Statement

When `phase6_start` initiates an assessment session, it currently:

1. **Loads methodology from the DEFAULT location** (`methodology/` at monorepo root) instead of the PROJECT's methodology folder defined in `sources.yaml`

2. **Dumps 50+ KB of methodology text** in a single response, making it difficult for Claude Desktop and the teacher to process

3. **Fails to find rubric sections** for questions (returns `"[Rubric section for Q1 not found in rubric.md]"`) because `exam_config.yaml` lacks `section_title` field

---

## Decision Drivers

* **Processability:** Claude Desktop and teachers need digestible chunks, not massive text dumps
* **Project Isolation:** Each assessment project should use its own methodology folder
* **Rubric Accuracy:** Each question must reliably map to its rubric section
* **Explicit Control:** Teachers should control the pace of methodology loading

---

## Considered Options

### Option 1: Parameter in phase6_start
Add `methodology_loading: "progressive" | "full"` parameter to existing tool.

**Pros:** Single entry point, less new code
**Cons:** Tool becomes more complex, return value changes based on parameter

### Option 2: New Tool `phase6_methodology`
Create separate tool for loading methodology documents one at a time.

**Pros:** Single responsibility, explicit workflow, flexible, easier testing
**Cons:** More tool calls, slightly more complex workflow

---

## Decision Outcome

**Chosen Option:** Option 2 - New Tool `phase6_methodology`

### Rationale

1. **Single Responsibility Principle:** Each tool does one thing well
2. **Explicit Workflow:** Claude Desktop sees clear progress ("Document 1/8, 2/8...")
3. **Flexibility:** Can reload specific documents, skip irrelevant ones
4. **Testability:** Separate tools are easier to test independently
5. **Long-term Maintainability:** Cleaner to extend and modify

---

## Solution Design

### Part 0: Phase 1 Setup - Methodology Source Selection

**Context:** During `phase1_setup`, the system must determine where to get methodology documents.

**Workflow:**

```
phase1_setup:

1. ASK teacher specific questions about methodology:

   Q1: "Vilken bedömningsmetodik vill du använda?"

   Options (visa som lista):
   ┌─────────────────────────────────────────────────────────────┐
   │ a) STANDARD (Recommended)                                   │
   │    └─ Analytisk bedömning enligt Anders Jönsson             │
   │    └─ AI-stödd bedömning med dialog                         │
   │    └─ 8 dokument (52 KB)                                    │
   │                                                              │
   │ b) FYSIOLOGI-MALL                                           │
   │    └─ Anpassad för naturvetenskapliga ämnen                 │
   │    └─ Inkluderar laborationsexempel                         │
   │                                                              │
   │ c) SAMHÄLLSKUNSKAP-MALL                                     │
   │    └─ Anpassad för resonerande svar                         │
   │    └─ Fokus på argumentation                                │
   │                                                              │
   │ d) EGEN MAPP                                                │
   │    └─ Ange sökväg till egna metodologi-dokument             │
   │                                                              │
   │ e) INGEN (ej rekommenderat)                                 │
   │    └─ Hoppa över metodologi-kopiering                       │
   └─────────────────────────────────────────────────────────────┘

   Q2 (om EGEN vald): "Ange sökväg till din metodologi-mapp:"

   Q3: "Vill du anpassa metodologin för denna specifika kurs/prov?"
   └─ Om JA: Notera i sources.yaml för senare redigering

2. COPY selected methodology to project/methodology/

3. RECORD in sources.yaml:
   - original_path
   - template_used: "standard" | "fysiologi" | "samhällskunskap" | "custom"
   - is_customizable: true/false
```

**Template Locations (Future):**
```
methodology/                # At monorepo root (shared by both packages)
├── templates/
│   ├── standard/           # Default - generell
│   ├── naturvetenskap/     # Fysiologi, kemi, biologi
│   ├── samhällskunskap/    # Samhälle, historia
│   └── matematik/          # Matematik, fysik
└── *.md                    # Current default files
```

---

### Methodology Document Types

**Fyra kategorier av metodologi-dokument:**

| Typ | Laddning | Användare ser? | Syfte |
|-----|----------|----------------|-------|
| **CORE** | Automatiskt av verktyg | **NEJ** | Intern logik för Phase 4 verktyg |
| **ASSESSMENT** | Progressivt, användare väljer | **JA** | Bedömningsmetodik för Phase 6 |
| **INSIGHTS** | Progressivt, användare väljer | **JA** | Insiktsdokumentation Phase 7 |
| **REPORTING** | Progressivt, användare väljer | **JA** | Rapporter Phase 8/9 (FUTURE) |

---

### CORE Documents (Automatisk laddning - användare ser EJ)

Dessa dokument laddas **automatiskt** av Phase 4-verktyg och visas **aldrig** för användaren.

| Fil | Storlek | Laddas av | Syfte |
|-----|---------|-----------|-------|
| `phase4a_question_detection.md` | 15 KB | `phase4a_questions` | Frågedetektering, mönsterigenkänning |
| `phase4b_rubric_validation.md` | 20 KB | `phase4b_rubric` | Rubrikvalidering, aspektmatchning |
| `phase4c_student_report.md` | 3 KB | `phase4c_report` | Studentrapport, kompletteringsanalys |
| `phase4d_answer_boundaries.md` | 5 KB | `phase4d_boundaries` | Svarsgränser, Inspera-mönster |

**Totalt CORE:** 43 KB (laddas aldrig manuellt)

---

### ASSESSMENT Documents (Progressiv laddning - Phase 6)

Dessa dokument väljs och laddas **progressivt** av användaren innan bedömning.

| Fil | Storlek | Rekommendation | Syfte |
|-----|---------|----------------|-------|
| `bedomningsmetod_generell_v2.md` | 29 KB | **Rekommenderas starkt** | Analytisk bedömning (Anders Jönsson) |
| `instruktioner_ai_bedomning_v2.md` | 22 KB | **Rekommenderas starkt** | AI-roll, dialog, verktyg |
| `fallback-summary.md` | 1 KB | Valfri | Kvalitetssymboler (✓✓✓, ✓✓, ✓, ⚠, ✗) |

**Totalt ASSESSMENT:** 52 KB (användare väljer vilka)

---

### INSIGHTS Documents (Progressiv laddning - Phase 7)

Dessa dokument laddas om användaren vill dokumentera insikter under/efter bedömning.

| Fil | Storlek | Rekommendation | Syfte |
|-----|---------|----------------|-------|
| `teacher_insights_guide.md` | 7 KB | Valfri | Insiktskategorier, mönsterdokumentation |

**Totalt INSIGHTS:** 7 KB

**Användning:**
- Under Phase 6: Om läraren vill spara insikter löpande
- Efter Phase 6: För att sammanfatta mönster och rekommendationer
- `phase7_insights` verktyget använder denna guide

---

### REPORTING Documents (FUTURE - Phase 8/9)

Planerade dokument för framtida faser:

| Fil | Fas | Status | Syfte |
|-----|-----|--------|-------|
| `phase8_summary_report.md` | Phase 8 | 📋 PLANNED | Sammanfattningsrapport per fråga |
| `phase8_student_feedback.md` | Phase 8 | 📋 PLANNED | Individuell elevåterkoppling |
| `phase9_export_formats.md` | Phase 9 | 📋 PLANNED | Exportformat (CSV, Inspera, LMS) |
| `phase9_statistics.md` | Phase 9 | 📋 PLANNED | Statistisk analys, betygsgränser |

**Totalt REPORTING:** ~30-50 KB (estimerat)

---

### Sammanfattning - Alla dokument

**Current inventory (8 files, 102 KB):**

| Typ | Antal | Storlek | Laddning |
|-----|-------|---------|----------|
| CORE | 4 | 43 KB | Automatiskt (användare ser ej) |
| ASSESSMENT | 3 | 52 KB | Progressivt (användare väljer) |
| INSIGHTS | 1 | 7 KB | Progressivt (valfritt) |
| REPORTING | 0 | 0 KB | FUTURE |
| **TOTALT** | **8** | **102 KB** | |

---

### Phase 6 Loading Order (Progressive)

**Tillgängliga dokument för progressiv laddning:**

| Index | Typ | Fil | Storlek | Rekommendation |
|-------|-----|-----|---------|----------------|
| 0 | ASSESSMENT | `bedomningsmetod_generell_v2.md` | 29 KB | **Rekommenderas starkt** |
| 1 | ASSESSMENT | `instruktioner_ai_bedomning_v2.md` | 22 KB | **Rekommenderas starkt** |
| 2 | ASSESSMENT | `fallback-summary.md` | 1 KB | Valfri |
| 3 | INSIGHTS | `teacher_insights_guide.md` | 7 KB | Valfri (för Phase 7) |

**OBS:** CORE-dokument (phase4a-4d) laddas **automatiskt** av verktyg och visas ALDRIG här.

---

### Workflow: Fråga INNAN laddning

```
Teacher: "Starta bedömning Q1"

Claude Desktop:
1. phase6_start(q_file_path, rubric_path)
   → sessionInfo, rubricSection, firstStudent
   → methodology_documents: lista över tillgängliga dokument

2. FRÅGA LÄRAREN:
   ┌──────────────────────────────────────────────────────────────┐
   │ Vilka metodologi-dokument vill du ladda innan bedömningen?   │
   │                                                              │
   │ ASSESSMENT (Bedömningsmetodik):                              │
   │ ☑ [0] bedomningsmetod_generell_v2.md (29 KB) - Rekommenderas│
   │ ☑ [1] instruktioner_ai_bedomning_v2.md (22 KB) - Rekommenderas│
   │ ☐ [2] fallback-summary.md (1 KB) - Valfri                   │
   │                                                              │
   │ INSIGHTS (Phase 7):                                          │
   │ ☐ [3] teacher_insights_guide.md (7 KB) - Valfri             │
   │                                                              │
   │ [Ladda valda] [Ladda alla] [Hoppa över]                     │
   └──────────────────────────────────────────────────────────────┘

3. Teacher: "Ladda 0 och 1"

4. phase6_methodology(project_path, index=0)
   → bedomningsmetod_generell_v2.md (29 KB)
   → Claude/Teacher läser och internaliserar...
   → "Dokument 1/2 laddat."

5. phase6_methodology(project_path, index=1)
   → instruktioner_ai_bedomning_v2.md (22 KB)
   → Claude/Teacher läser och internaliserar...
   → "Dokument 2/2 laddat. Redo att bedöma!"

6. Fortsätt med bedömning...
```

**Varför fråga först:**
- Läraren får full kontroll
- Kan hoppa över dokument hen redan känner till
- Tydligt vilka dokument som finns tillgängliga
- Transparens om vad som laddas

---

### Phase 4 Documents (Loaded Automatically)

Phase 4-dokument laddas automatiskt av respektive verktyg:

| Verktyg | Laddar automatiskt |
|---------|-------------------|
| `phase4a_questions` | `phase4a_question_detection.md` |
| `phase4b_rubric` | `phase4b_rubric_validation.md` |
| `phase4c_report` | `phase4c_student_report.md` |
| `phase4d_boundaries` | `phase4d_answer_boundaries.md` |

Dessa behöver INTE laddas manuellt via `phase6_methodology`.

**sources.yaml structure (already implemented):**
```yaml
# /project_folder/sources.yaml
sources:
  methodology:
    original_path: /Users/.../Assessment_suite/methodology
    type: folder
    copied_to: methodology/           # LOCAL copy in project
    file_count: 8
    is_default: true                  # or false if custom
```

**Methodology files (default set):**
```
methodology/
├── bedomningsmetod_generell_v2.md      # General assessment methodology
├── instruktioner_ai_bedomning_v2.md    # AI-assisted assessment instructions
├── phase4a_question_detection.md       # Phase 4A methodology
├── phase4b_rubric_validation.md        # Phase 4B methodology
├── phase4c_student_report.md           # Phase 4C methodology
├── phase4d_answer_boundaries.md        # Phase 4D methodology
├── teacher_insights_guide.md           # Insights documentation
└── fallback-summary.md                 # Fallback if other docs fail
```

**Phase 6 then reads from project's methodology folder:**
```typescript
// phase6_start.ts
const sourcesPath = path.join(projectDir, 'sources.yaml');
const sources = yaml.parse(fs.readFileSync(sourcesPath, 'utf-8'));

// Use project-local methodology folder
const methodologyFolder = path.join(projectDir, sources.sources.methodology.copied_to);
// → /project_folder/methodology/
```

**Benefits:**
- Each project has its own methodology copy (can be customised)
- sources.yaml tracks origin (default vs custom)
- Phase 6 always reads from project folder, not global default

---

### Part 0.5: Assessment File Copy with Traceability

**Context:** När bedömning startar måste originalfilen bevaras och en ny fil skapas för spårbarhet.

**Workflow:**
```
phase6_start:

1. FRÅGA om bedömare:
   "Vem utför bedömningen? (namn eller alias)"
   → Input: "alex" / "AJ" / "Claude+Alex"

2. SKAPA KOPIA av Q-filen:
   Original:  Q1_alla_elever.md
   Kopia:     Q1_alla_elever_2025-12-31_alex.md

3. ALLA BEDÖMNINGAR skrivs till kopian, INTE originalet

4. UPPDATERA sources.yaml eller assessment_log.yaml:
   ```yaml
   assessments:
     Q1:
       original_file: Q1_alla_elever.md
       assessment_file: Q1_alla_elever_2025-12-31_alex.md
       assessor: alex
       started: 2025-12-31T10:15:00
       status: in_progress
   ```
```

**Filnamnsmönster:**
```
{question_id}_alla_elever_{YYYY-MM-DD}_{assessor}.md
```

**Exempel:**
| Original | Assessment Copy |
|----------|-----------------|
| `Q1_alla_elever.md` | `Q1_alla_elever_2025-12-31_alex.md` |
| `Q2_alla_elever.md` | `Q2_alla_elever_2025-12-31_AJ.md` |
| `Q3_alla_elever.md` | `Q3_alla_elever_2025-12-31_claude_alex.md` |

**Fördelar:**
- **Spårbarhet:** Vem bedömde när
- **Originalskydd:** Q-filen bevaras orörd
- **Flera bedömare:** Olika filer per bedömare (inter-rater reliability)
- **Versioner:** Kan köra om bedömning utan att förlora tidigare

**Implementation i phase6_start:**
```typescript
interface Phase6StartParams {
  q_file_path: string;
  rubric_path: string;
  assessor?: string;      // NEW: Bedömarens namn/alias
  create_copy?: boolean;  // NEW: Default true
}

// Om assessor inte anges, fråga
// Om create_copy=true (default), skapa kopia och arbeta med den
```

---

### Part 1: Fix Rubric Section Extraction

**Problem:** `exam_config.yaml` lacks `section_title`, so RubricParser can't find sections.

**Solution A:** Update Phase 4B to extract and save `section_title`:
```yaml
# exam_config.yaml (after fix)
questions:
  - id: Q1
    section_title: "Question 1: GWP Reference Values"  # NEW
    rubric_id: Q1
    points: 3
    rubric_data:
      identifier: L2A_REMEMBER_02
      ...
```

**Solution B:** Improve RubricParser fallback to match `# Question N:` format (single #).

**Decision:** Implement BOTH for robustness.

---

### Part 2: Read Project Methodology from sources.yaml

**Current:** `phase6_start` ignores `sources.yaml` and loads from default location.

**Fix:**
```typescript
// phase6_start.ts
const projectDir = path.dirname(q_file_path).replace('/03_answers_by_question', '');
const sourcesPath = path.join(projectDir, 'sources.yaml');

if (fs.existsSync(sourcesPath)) {
  const sources = yaml.parse(fs.readFileSync(sourcesPath, 'utf-8'));
  if (sources.sources?.methodology?.copied_to) {
    methodology_path = path.join(projectDir, sources.sources.methodology.copied_to);
  }
}
```

---

### Part 3: New Tool `phase6_methodology`

**Interface:**
```typescript
interface Phase6MethodologyParams {
  project_path: string;     // Path to project folder
  document_index?: number;  // 0-based index (default: 0)
  document_name?: string;   // Alternative: specific document by name
}

interface Phase6MethodologyResult {
  document: {
    name: string;           // "bedomningsmetod_generell_v2.md"
    path: string;           // Full path
    content: string;        // Document content
    size_bytes: number;
  };
  progress: {
    current_index: number;  // 0
    total_documents: number; // 8
    remaining: string[];    // ["instruktioner_ai...", ...]
  };
  next_action: string;      // "Call phase6_methodology with index=1 to continue"
}
```

**Updated phase6_start return:**
```typescript
interface AssessmentStartResult {
  sessionInfo: SessionInfo;
  rubricSection: string;           // Now correctly populated
  methodology: string;             // REMOVED or minimal
  methodology_documents: string[]; // NEW: List of available docs
  firstStudent: Student | null;
  validationWarnings: string[];
  resumed: boolean;
}
```

---

## Workflow After Implementation

```
Claude Desktop:

1. phase6_start(q_file_path, rubric_path)
   → sessionInfo: { file: "Q1_alla_elever.md", question: "Fråga 1", maxPoints: 3 }
   → rubricSection: "# Question 1: GWP Reference Values\n\n**Points:** 3p\n\n..."
   → methodology_documents: ["bedomningsmetod_generell_v2.md", "instruktioner_ai_bedomning_v2.md", ...]
   → firstStudent: { id: "TestElev10", answer: "...", wordCount: 59 }
   → "Load methodology documents with phase6_methodology before assessing"

2. Teacher/Claude: "Ladda första metodologi-dokumentet"

3. phase6_methodology(project_path, index=0)
   → document: { name: "bedomningsmetod_generell_v2.md", content: "..." }
   → progress: { current_index: 0, total_documents: 8, remaining: [...] }
   → Teacher/Claude processes and internalizes...

4. phase6_methodology(project_path, index=1)
   → document: { name: "instruktioner_ai_bedomning_v2.md", content: "..." }
   → Teacher/Claude processes...

5. Ready to assess Q1!
```

---

## Files to Modify

### Phase 1 Changes (pre-assessment-mcp)
| File | Change | Priority |
|------|--------|----------|
| `packages/pre-assessment-mcp/src/tools/phase1_setup.py` | Ask for methodology source, copy to project | P0 |

### Phase 4 Changes (assessment-mcp)
| File | Change | Priority |
|------|--------|----------|
| `packages/assessment-mcp/src/tools/phase4b_rubric.ts` | Extract and save `section_title` | P1 |
| `packages/assessment-mcp/src/core/rubric_parser.js` | Better fallback for `# Question N:` | P1 |

### Phase 6 Changes (assessment-mcp)
| File | Change | Priority |
|------|--------|----------|
| `packages/assessment-mcp/src/tools/phase6_start.ts` | Read sources.yaml, return `methodology_documents`, **file copy with assessor** | P2 |
| `packages/assessment-mcp/src/tools/phase6_methodology.ts` | **NEW** - Progressive loading | P2 |
| `packages/assessment-mcp/src/tools/index.ts` | Export new tool | P2 |
| `packages/assessment-mcp/src/server.ts` | Register new tool | P2 |

### New Parameters for phase6_start
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `assessor` | string | (ask) | Bedömarens namn/alias |
| `create_copy` | boolean | true | Skapa kopia av Q-fil |

---

## Consequences

### Positive

* Teachers and Claude Desktop can process methodology at their own pace
* Each project uses its own methodology folder (customization possible)
* Rubric sections are reliably extracted for each question
* Clear workflow with explicit tool calls
* Easier debugging (can see exactly which document is being loaded)

### Negative

* More tool calls required (minor overhead)
* Existing workflows need to call `phase6_methodology` before assessing
* Breaking change: `methodology` field in phase6_start return changes

### Mitigation

* Document new workflow clearly
* phase6_start returns `methodology_documents` list with next steps
* Fallback to default methodology if sources.yaml missing

---

## Validation

### Phase 1 (Rubric Fix)
```bash
# Re-run Phase 4B
phase4b_rubric(exam_config_path, rubric_path, mode="batch")

# Verify section_title saved
grep "section_title" exam_config.yaml
# Expected: section_title: "Question 1: GWP Reference Values"

# Test phase6_start
phase6_start(q_file_path, rubric_path)
# Expected: rubricSection contains actual rubric text, NOT "[not found]"
```

### Phase 2 (Progressive Loading)
```bash
# Start assessment
phase6_start(q_file_path, rubric_path)
# Expected: methodology_documents: ["bedomningsmetod...", ...]

# Load first document
phase6_methodology(project_path, index=0)
# Expected: Full content of bedomningsmetod_generell_v2.md

# Load second document
phase6_methodology(project_path, index=1)
# Expected: Full content of instruktioner_ai_bedomning_v2.md
```

---

## Related Decisions

* [ADR-001: Hybrid Python-TypeScript Architecture](ADR-001-hybrid-python-typescript-architecture.md)
* [ADR-002: Tool Naming Standardization](ADR-002-tool-naming-standardization.md)

---

**Status:** Proposed
**Last Updated:** 2025-12-31
**Next Review:** After implementation
