# Reflection Tools

Cross-phase meta-analysis and pedagogical reflection tools.

## Overview

These tools support reflection and meta-analysis across all phases of the assessment pipeline. They are **not** specific to any single phase but can be used wherever pedagogical insights, uncertainty reviews, or aspect analysis are needed.

## Components

### AspectAnalyzer
Analyses per-aspect statistics from assessed Q-files.

**Use cases:**
- Phase 6: During assessment to identify difficult aspects
- Phase 7: For comprehensive aspect analysis reports
- Phase 8: For LMS export with per-aspect breakdowns

**Methodology:** `methodology/cross_phase/descriptive_statistics_method.md`

```typescript
import { AspectAnalyzer } from '../reflection/aspect_analyzer';

const analyzer = new AspectAnalyzer();
const stats = await analyzer.analyzeQFile('Q1_alla_elever.md');

// Returns: AspectStatistics with success rates, distributions, flagged aspects
```

---

### InsightsWriter
Captures and saves pedagogical observations and teaching insights.

**Use cases:**
- Phase 3: Document syllabus alignment observations (future)
- Phase 6: Save patterns discovered during assessment
- Phase 7: Compile comprehensive teaching insights
- Phase 8: Include in export reports (future)

**Methodology:** `methodology/cross_phase/meta_reflection_method.md`

```typescript
import { InsightsWriter } from '../reflection/insights_writer';

const writer = new InsightsWriter(projectPath);
await writer.savePattern({
  type: 'pattern',
  content: 'Several students share a common misconception in this aspect',
  priority: 'high',
  question_id: 'Q001'
});
```

---

### UncertaintyReviewer
Creates structured review documents for borderline assessments.

**Use cases:**
- Phase 6: Flag uncertain assessments during workflow
- Phase 7: Generate comprehensive uncertainty reviews
- Bedömningsansvarig: Review and approve borderline cases

**Methodology:** `methodology/cross_phase/quality_assurance_method.md`

```typescript
import { UncertaintyReviewer } from '../reflection/uncertainty_reviewer';

const reviewer = new UncertaintyReviewer();
await reviewer.createReview({
  q_file_path: 'Q1_alla_elever.md',
  uncertain_students: [
    {
      student_id: 'student_A',
      reason: 'Aspect 6b interpretation unclear',
      current_grade: 3,
      borderline_between: [3, 4]
    }
  ],
  output_folder: '05_uncertainty_review/'
});
```

---

## Design Principles

### Cross-Phase Usage
Reflection tools are designed to be used by multiple phases, not just Phase 7.

### Stateless Analysis
These tools perform read-only analysis and do not modify assessment state.

### Role Separation
Different tools serve different roles:
- **Teachers** use `InsightsWriter` during assessment
- **Bedömningsansvarig** use `UncertaintyReviewer` for quality control
- **Analysts** use `AspectAnalyzer` for statistics

---

## Moved from `/src/core/`

These files were moved from `/src/core/` to `/src/reflection/` in RFC-014 (2026-01-14) to better reflect their cross-phase nature.

**Previous locations:**
- `core/aspect_analyzer.ts` → `reflection/aspect_analyzer.ts`
- `core/insights_writer.ts` → `reflection/insights_writer.ts`
- `core/reflect_uncertainty.ts` → `reflection/uncertainty_reviewer.ts` (renamed)

**Rationale:** These are not "core assessment" tools but meta-tools used across phases.

---

## Related Documentation

- **Methodology:** `methodology/cross_phase/README.md` — overview of the three cross-phase reflection tools and their per-tool methodology files (`meta_reflection_method.md`, `quality_assurance_method.md`, `descriptive_statistics_method.md`)
- **WORKFLOW-INTEGRATION.md:** description of how reflection tools fit into the assessment workflow

Note: RFC-004 (Teacher Insights), RFC-009 (Assessment Uncertainty), and RFC-010 (Aspect Analysis) referenced in earlier code comments were never written. The canonical specification for each tool is the corresponding methodology document in `methodology/cross_phase/`.

---

**Last Updated:** 2026-01-14  
**Status:** Active Development (v1.0.0)
