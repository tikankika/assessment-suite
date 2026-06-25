# API Reference - Assessment MCP

**Version:** 0.8.0
**Updated:** 2026-01-25
**Total Tools:** 37

---

## Overview

Assessment MCP provides MCP tools for supporting analytical assessment workflows in Claude Desktop.

**Naming Convention (ADR-002):**
- Phase-specific tools: `phase{N}_{action}` or `phase{N}_{substep}_{action}`
- Cross-phase tools: `{domain}_{action}` (no prefix)

---

## Tool Summary

### Phase 4 - Pre-Assessment Analysis (5 tools)

| Tool | Description |
|------|-------------|
| `phase4a_questions` | Detect questions in exam file, create exam_config.yaml |
| `phase4b_rubric` | Validate rubric against detected questions |
| `phase4c_report` | Generate per-student completion report |
| `phase4d_boundaries` | Detect answer boundary markers |
| `phase4e_students` | Discover and register student IDs |

### Phase 6 - Assessment (8 tools)

| Tool | Description |
|------|-------------|
| `phase6_start` | Initialize assessment session for a Q-file |
| `phase6_methodology` | Load methodology file for assessment guidance |
| `phase6_rubric` | Load rubric data for current question |
| `phase6_read_next` | Read next unassessed student |
| `phase6_write` | Write structured assessment (aspects with symbols) |
| `phase6_write_free` | Write free-text assessment |
| `phase6_status` | Show assessment progress |
| `phase6_get` | Get specific student's assessment |

### Phase 9-13 - Student Feedback Pipeline (15 tools)

| Phase | Tools | Purpose |
|-------|-------|---------|
| **9** | `phase9_start`, `phase9_continue`, `phase9_complete` | Qualitative generalization |
| **10** | `phase10_start`, `phase10_continue`, `phase10_complete` | ILO/Criteria mapping |
| **11** | `phase11_start`, `phase11_continue`, `phase11_complete` | Grade decision |
| **12** | `phase12_start`, `phase12_continue`, `phase12_complete` | Feedback generation |
| **13** | `phase13_start`, `phase13_continue`, `phase13_complete` | Class-level teacher summary |

### Meta-Reflection (3 tools)

| Tool | Description |
|------|-------------|
| `reflect_insights` | Save pedagogical observations |
| `reflect_uncertainty` | Create quality review documents |
| `reflect_aspect_analysis` | Generate per-aspect statistics |

### Cross-Phase & System (6 tools)

| Tool | Description |
|------|-------------|
| `rubric_read` | Read rubric file content |
| `rubric_edit` | Edit rubric aspects with audit trail |
| `json_write` | Write JSON data to filesystem |
| `init` | Initialize/reset MCP server state |
| `project_status` | Get comprehensive project status |
| `project_repair` | Fix path portability issues |

---

## Phase 4: Pre-Assessment Analysis

### `phase4a_questions`

Detect questions in exam markdown file and create exam_config.yaml.

**Input:**
```typescript
{
  exam_path: string;       // Path to exam markdown file
  mode: 'load' | 'save';   // load: analyze, save: write config
  questions?: Question[];  // For save mode: validated questions
}
```

### `phase4b_rubric`

Validate rubric against detected questions.

**Input:**
```typescript
{
  project_path: string;
  mode: 'single' | 'preview' | 'batch';
  single_mode?: boolean;     // Stop after each match (default: true)
  question_index?: number;   // For single mode: which question
  save_results?: boolean;    // Trigger save mode
  validated_questions?: [];  // For save mode
}
```

### `phase4c_report`

Generate per-student completion overview.

**Input:**
```typescript
{
  project_path: string;
  mode: 'load' | 'save';
  report_content?: string;  // For save mode
}
```

### `phase4d_boundaries`

Detect answer boundary markers per question.

**Input:**
```typescript
{
  project_path: string;
  mode: 'load' | 'preview' | 'batch' | 'save';
  answer_boundaries?: object;  // For save mode
}
```

### `phase4e_students`

Discover and register student information.

**Input:**
```typescript
{
  project_path: string;
  mode: 'discover' | 'save';
  from_qfiles?: boolean;  // Extract from Q-files instead of student files
  students?: {            // For save mode
    count: number;
    id_format: string;
    id_pattern: string;
    ids: string[];
  };
}
```

---

## Phase 6: Assessment Tools

### `phase6_start`

Initialize assessment session for a Q-file.

**Input:**
```typescript
{
  q_file_path: string;    // Path to Q-file
  rubric_path?: string;   // Path to rubric file
  exam_config_path?: string;
}
```

**Output:**
```typescript
{
  success: boolean;
  total_students: number;
  first_student: {
    id: string;
    word_count: number;
    answer: string;
  };
  status: AssessmentStatus;
}
```

### `phase6_read_next`

Read the next unassessed student.

**Input:**
```typescript
{
  q_file_path: string;
}
```

### `phase6_write`

Write structured assessment with aspect symbols.

**Input:**
```typescript
{
  q_file_path: string;
  student_id: string;
  assessment: {
    aspects: Array<{
      name: string;      // e.g., "6a (Riktningar)"
      symbol: string;    // ✓✓✓, ✓✓, ✓, ⚠, ✗, -
      points: number;
      comment: string;
    }>;
    total_points: number;
    max_points: number;
    next_step: string;   // Forward-looking feedback
    comment?: string;
  };
  overwrite?: boolean;
}
```

### `phase6_write_free`

Write free-text assessment (no structured aspects).

**Input:**
```typescript
{
  q_file_path: string;
  student_id: string;
  bedömning_text: string;
  overwrite?: boolean;
}
```

### `phase6_status`

Show current assessment progress.

**Input:**
```typescript
{
  q_file_path: string;
}
```

### `phase6_get`

Get a specific student's assessment.

**Input:**
```typescript
{
  q_file_path: string;
  student_id: string;
}
```

---

## Phase 9-13: Student Feedback Pipeline

All Phase 9-13 tools follow a dialogue pattern with three tools each:

### Pattern: `phase{N}_start`

Start a new session for a student.

**Input:**
```typescript
{
  project_path: string;
  student_id: string;  // Not required for phase13
}
```

**Output:**
```typescript
{
  session_id: string;
  status: 'started';
  first_prompt: string;
  context: object;
}
```

### Pattern: `phase{N}_continue`

Continue the dialogue with teacher response.

**Input:**
```typescript
{
  session_id: string;
  teacher_response: string;
}
```

**Output:**
```typescript
{
  status: 'continue' | 'ready_to_complete';
  next_prompt?: string;
  current_step: string;
}
```

### Pattern: `phase{N}_complete`

Complete session and save document.

**Input:**
```typescript
{
  session_id: string;
}
```

**Output:**
```typescript
{
  success: boolean;
  saved_path: string;
  summary: string;
}
```

### Phase-Specific Details

| Phase | Purpose | Output Folder | Dialogue Steps |
|-------|---------|---------------|----------------|
| **9** | Qualitative generalization | `09_qualitative/` | Area analysis → Patterns → Generalization |
| **10** | ILO/Criteria mapping | `10_extrapolation/` | Per-ILO mapping → Critical interpretations → Summary |
| **11** | Grade decision | `11_grading/` | Weighting → Decision → Verification |
| **12** | Feedback generation | `12_feedback/` | Where now? → Where going? → How to get there? (Lundahl) |
| **13** | Class-level summary | `13_teacher_summary/` | Misconceptions → Teaching gaps → Recommendations |

---

## Meta-Reflection Tools

### `reflect_insights`

Save teacher insights after completing assessment.

**Input:**
```typescript
{
  project_path: string;
  question_id: string;
  insights: {
    common_errors: string[];
    patterns: string[];
    recommendations: string[];
  };
}
```

### `reflect_uncertainty`

Create review document for uncertain assessments.

**Input:**
```typescript
{
  q_file_path: string;
  student_id: string;
  reason: string;
  detailed_analysis: string;
  options: {
    a: { points: number; rationale: string };
    b: { points: number; rationale: string };
  };
  comparison_students?: string[];
  aspect_of_concern?: string;
}
```

**Output:**
```typescript
{
  success: boolean;
  review_path: string;  // 05_uncertainty_review/...
  student_id: string;
  question_id: string;
}
```

### `reflect_aspect_analysis`

Generate per-aspect statistics from assessed Q-files.

**Input:**
```typescript
{
  q_file_path: string;
  output_format?: 'summary' | 'detailed' | 'json';
  include_students?: boolean;
  append_to_insights?: boolean;
}
```

**Output:**
```typescript
{
  success: boolean;
  question_id: string;
  assessed_students: number;
  flagged_aspects: string[];  // Aspects where >20% below 75%
}
```

---

## Cross-Phase Tools

### `rubric_read`

Read rubric file content.

**Input:**
```typescript
{
  rubric_path: string;
  question_id?: string;  // Optional: filter by question
}
```

### `rubric_edit`

Update rubric aspects with exam_config.yaml synchronization.

**Supported Rubric Formats:**

| Format | Question Header | Aspect Format |
|--------|-----------------|---------------|
| Swedish | `## FRÅGA E3:` | `### E3a:` or `**E3a:**` |
| English | `# Question 7:` | `**ASPECT 1: ...**` |

**Input:**
```typescript
{
  rubric_path: string;
  exam_config_path?: string;
  question_id: string;
  updates: {
    aspect_name: string;
    new_max_points?: number;
    new_criteria?: string;
  };
  reason: string;  // Required: audit trail
  sync_config?: boolean;
}
```

**Features:**
- Creates backup before modification (`.bak`)
- Adds changelog as HTML comment
- Syncs changes to exam_config.yaml
- Warns about students already assessed

### `json_write`

Write JSON data to filesystem.

**Input:**
```typescript
{
  file_path: string;
  data: object;
  pretty?: boolean;  // Default: true
}
```

---

## System Tools

### `init`

Initialize/reset MCP server state.

**Input:**
```typescript
{}
```

### `project_status`

Get comprehensive project status.

**Input:**
```typescript
{
  project_path: string;
}
```

**Returns:**
- Project overview (name, created, last updated)
- Phase completion status (1-13)
- Q-file list with assessment progress
- Active session info
- Recommendations for next steps

### `project_repair`

Fix path portability issues.

**Input:**
```typescript
{
  project_path: string;
  dry_run?: boolean;  // Preview without applying
}
```

**Fixes:**
- `project_state.json`: Converts absolute paths to relative
- `sources.yaml`: Removes unnecessary original_path

---

## Core Modules

| Module | Location | Purpose |
|--------|----------|---------|
| `rubric_parser.ts` | `src/shared/` | Parse rubric sections, extract aspects |
| `rubric_writer.ts` | `src/core/` | Update rubric file, add changelog |
| `student_reader.ts` | `src/core/` | Parse student sections from Q-files |
| `assessment_writer.ts` | `src/core/` | Write BEDÖMNING sections |
| `exam_config_reader.ts` | `src/shared/` | Read exam_config.yaml |
| `project_state_manager.ts` | `src/shared/` | Manage project_state.json |
| `insights_writer.ts` | `src/reflection/` | Write Teacher_Insights.md |
| `uncertainty_reviewer.ts` | `src/reflection/` | Generate uncertainty review docs |
| `aspect_analyzer.ts` | `src/reflection/` | Analyse per-aspect statistics |
| `phase9_orchestrator.ts` | `src/core/` | Phase 9 dialogue logic |
| `phase10_orchestrator.ts` | `src/core/` | Phase 10 dialogue logic |
| `phase11_orchestrator.ts` | `src/core/` | Phase 11 dialogue logic |
| `phase12_orchestrator.ts` | `src/core/` | Phase 12 dialogue logic |
| `phase13_orchestrator.ts` | `src/core/` | Phase 13 dialogue logic |

---

## Types

### AssessmentStatus

```typescript
interface AssessmentStatus {
  File: string;
  Question: string;
  "Max-points": number;
  "Total-students": number;
  "Last-assessed-student": string | null;
  "Last-assessed-index": number;
  Progress: string;
  Date: string;
}
```

### Student

```typescript
interface Student {
  id: string;
  index: number;
  word_count: number;
  answer: string;
  assessed: boolean;
}
```

---

## Error Handling

All tools return errors in this format:
```typescript
{
  error: string;
  tool: string;
}
```

---

## References

- [ADR-002: Tool Naming Standardization](../../../docs/decisions/ADR-002-tool-naming-standardization.md)
- [ADR-003: Progressive Methodology Loading](../../../docs/decisions/ADR-003-progressive-methodology-loading.md)

---

**Last updated:** 2026-01-25
