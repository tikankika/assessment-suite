# ADR-005: Phase 6 Workflow Enforcement and Session State

**Status:** Implemented
**Date:** 2026-01-01
**Author:** Niklas Karlsson
**Related:** Pilot course workflow analysis (2026-01-01), ADR-003 (Progressive Methodology Loading)

---

## Context

During a pilot course assessment session (2026-01-01), several workflow violations were observed:

1. **`phase6_methodology` was NEVER called** - Critical assessment instructions were skipped
2. **Rubric content not displayed to teacher** - `phase6_rubric` was called but output not shown
3. **`phase6_status` not called before starting** - Risk of re-assessing students
4. **Assessment file path not persisted** - User had to manually provide exact file paths

These issues led to inconsistent assessment workflow and user friction.

---

## Decision

Implement **workflow enforcement** with **session state management**:

### 1. Methodology Loading Enforcement

Block assessment start if methodology not loaded:

```typescript
// In phase6_start or phase6_read_next
if (!session.methodology_loaded) {
  return {
    error: "BLOCKED: Must call phase6_methodology first",
    action_required: "phase6_methodology",
    help: "Methodology documents contain critical assessment instructions"
  }
}
```

### 2. Rubric Display Requirement

Ensure rubric content is explicitly shown to teacher:

```typescript
// In phase6_rubric response
return {
  rubric_content: fullRubricText,
  display_instruction: "VISA HELA innehållet för läraren",
  confirm_prompt: "Har du läst och förstått bedömningsanvisningarna? (ja/nej)"
}
```

### 3. Status Check Recommendation

Prompt for status check before first assessment:

```typescript
// In phase6_start response (new session)
if (!resumed) {
  return {
    ...result,
    recommended_action: "Call phase6_status to verify 0/X before starting",
    status_check_recommended: true
  }
}
```

### 4. Session State Persistence

Store assessment file path in `project_state.json`:

```typescript
// In phase6_start after creating copy
await updateProjectState(projectPath, {
  phase6: {
    current_question: questionId,
    assessment_file: assessmentFilePath,
    original_file: q_file_path,
    started_at: new Date().toISOString(),
    assessor: assessor
  }
});

// In phase6_status - auto-discover if path not provided
if (!args.q_file_path) {
  const state = await readProjectState(projectPath);
  args.q_file_path = state.phase6?.assessment_file;
}
```

---

## Rationale

### Why Enforcement, Not Just Guidance?

| Approach | Pros | Cons |
|----------|------|------|
| Guidance only | Flexible, non-blocking | Easily ignored (as seen in pilot session) |
| Hard enforcement | Guarantees compliance | May frustrate experienced users |
| **Soft enforcement** | Warns but allows override | Best balance |

**Decision:** Implement **soft enforcement** - warn and recommend, block only for critical items (methodology).

### Why Session State in project_state.json?

- Already exists and used for phase tracking
- Survives tool call boundaries
- Can be read by any Phase 6 tool
- Enables auto-discovery of assessment files

---

## Technical Design

### Changes to project_state.json Schema

```typescript
interface ProjectState {
  // ... existing fields ...

  phase6?: {
    current_question: string;      // e.g., "Q003"
    assessment_file: string;       // Full path to current assessment file
    original_file: string;         // Original Q-file path
    started_at: string;            // ISO timestamp
    assessor: string;              // Assessor name
    methodology_loaded: boolean;   // Track if methodology was loaded
    rubric_displayed: boolean;     // Track if rubric was shown to teacher
  }
}
```

### Files Affected

| File | Change |
|------|--------|
| `src/core/project_state_manager.ts` | Add Phase 6 session state |
| `src/tools/phase6_start.ts` | Store session state, add soft enforcement |
| `src/tools/phase6_methodology.ts` | Mark methodology_loaded = true |
| `src/tools/phase6_rubric.ts` | Add display instruction, mark rubric_displayed |
| `src/tools/phase6_status.ts` | Auto-discover from session state |
| `src/tools/phase6_read_next.ts` | Check methodology_loaded before allowing read |

### Enforcement Flow

```
phase6_start
    │
    ├─► Check methodology_loaded?
    │       NO → Return warning + next_action = "phase6_methodology"
    │       YES → Continue
    │
    ├─► Store session state (assessment_file, question_id)
    │
    └─► Return firstStudent + status_check_recommended

phase6_methodology
    │
    └─► Set methodology_loaded = true in session state

phase6_rubric
    │
    ├─► Return FULL rubric content (not summary)
    ├─► Include display_instruction
    └─► Set rubric_displayed = true in session state

phase6_status (no path provided)
    │
    └─► Read assessment_file from session state
```

---

## Migration & Compatibility

### Backward Compatibility

- Existing projects without session state continue to work
- Enforcement is additive - doesn't break existing workflows
- Auto-discovery is a fallback, not a requirement

### Rollout Strategy

1. **Phase 1:** Add session state storage (passive)
2. **Phase 2:** Add soft warnings for missing methodology
3. **Phase 3:** Add auto-discovery for status tool
4. **Phase 4:** Enable blocking for critical violations (optional)

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| State file corruption | Low | Medium | Graceful fallback to explicit paths |
| User frustration from blocking | Medium | Low | Soft enforcement with override |
| Multiple concurrent sessions | Low | Medium | Question-specific session state |

---

## Success Criteria

1. `phase6_methodology` called before assessments in 100% of new sessions
2. Rubric content displayed to teacher before each question
3. Users no longer need to manually provide exact file paths
4. Session state persists across tool calls

---

## Implementation Estimate

| Task | Effort |
|------|--------|
| Session state schema + storage | 2h |
| phase6_start enforcement | 2h |
| phase6_methodology tracking | 1h |
| phase6_rubric display instruction | 1h |
| phase6_status auto-discovery | 2h |
| Tests | 3h |
| Documentation | 1h |
| **Total** | **12h** |

---

## Alternatives Considered

### Option A: Claude Prompt Engineering Only

Just update Claude's system prompt to enforce workflow.

**Rejected:** As the pilot session showed, Claude can still skip steps. Code enforcement is more reliable.

### Option B: Hard Blocking Only

Block all tools until requirements met.

**Rejected:** Too restrictive for power users who know what they're doing.

### Option C: No Enforcement

Keep current behaviour, just document the workflow.

**Rejected:** The pilot session showed documentation alone doesn't prevent issues.

---

## References

- Pilot course assessment session 2026-01-01 (source issues)
- ADR-003: Progressive Methodology Loading
- project_state.json schema

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-01 | Proposed ADR-005 | Address workflow violations from pilot course session |
| 2026-01-02 | Implemented ADR-005 | Session state + soft enforcement in 6 files |

