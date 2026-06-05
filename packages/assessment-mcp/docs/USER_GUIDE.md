# Assessment_MPC User Guide

A step-by-step guide for teachers using Assessment_MPC with Claude Desktop.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Complete Workflow](#complete-workflow)
4. [Tool Reference](#tool-reference)
5. [File Formats](#file-formats)
6. [Tips & Best Practices](#tips--best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required

1. **Claude Desktop** with MCP support
2. **Node.js 18+** installed
3. **Assessment_MPC** installed and configured

### Files You Need

1. **Q-file** - Student answers in markdown format (e.g., `Q6_alla_elever.md`)
2. **Rubric** - Assessment criteria (e.g., `Bedomningsanvisningar.md`)

### Claude Desktop Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "assessment": {
      "command": "node",
      "args": ["/path/to/Assessment_MPC/dist/server.js"]
    }
  }
}
```

Restart Claude Desktop after adding the configuration.

---

## Quick Start

### 1. Start Assessment Session

In Claude Desktop, say:

```
Start assessment of /Users/.../Q6_alla_elever.md
with rubric /Users/.../Bedomningsanvisningar.md
```

Claude will use `assessment_start` and show:
- Number of students found
- First student's answer
- Rubric context

### 2. Assess Each Student

For each student, Claude proposes an assessment based on the rubric. Review and confirm:

```
Teacher: Write the assessment
```

Claude uses `assessment_write` to save.

### 3. Continue Until Done

Claude automatically shows the next student. Repeat until all students are assessed.

### 4. Generate Summary

When complete, an `Assessment_Status_Summary.md` file is automatically generated with statistics.

---

## Complete Workflow

### Phase 1: Preparation

**Before starting:**
- Ensure Q-file has all student answers
- Ensure rubric is complete with point values
- Know the maximum points for each aspect

### Phase 2: Assessment Session

```
┌─────────────────────────────────────────────────────────┐
│  1. assessment_start                                     │
│     → Loads files, counts students, shows first student │
│                                                          │
│  2. assessment_read_next (automatic after each write)   │
│     → Shows next unassessed student with rubric context │
│                                                          │
│  3. Teacher reviews + Claude proposes assessment        │
│     → Discuss quality, compare to rubric                │
│                                                          │
│  4. assessment_write / assessment_write_free            │
│     → Save assessment to file                            │
│                                                          │
│  5. Repeat 2-4 until all students done                  │
│                                                          │
│  6. assessment_status                                    │
│     → Shows progress, statistics                         │
└─────────────────────────────────────────────────────────┘
```

### Phase 3: Review & Insights

After completing all students:

1. **Check summary** - `Assessment_Status_Summary.md` has all scores
2. **Save insights** - Use `insights_save` for pedagogical observations
3. **Review patterns** - Check `Teacher_Insights.md` for captured patterns

---

## Tool Reference

### Core Tools

#### `assessment_start`

**Purpose:** Initialize assessment session

**Parameters:**
- `q_file_path` - Path to Q-file with student answers
- `rubric_path` - Path to rubric/bedömningsanvisningar

**Example:**
```
assessment_start({
  q_file_path: "/Users/.../Q6_alla_elever.md",
  rubric_path: "/Users/.../Bedomningsanvisningar.md"
})
```

**Returns:**
- Session info (students found, file paths)
- Assessment methodology
- First student's answer

---

#### `assessment_read_next`

**Purpose:** Get next unassessed student

**Parameters:**
- `q_file_path` - Path to Q-file

**Returns:**
- Student ID, word count
- Student's answer text
- Rubric context (optional)

---

#### `assessment_write`

**Purpose:** Write structured assessment

**Parameters:**
- `q_file_path` - Path to Q-file
- `student_id` - Student identifier
- `aspects` - Array of aspect assessments
- `total_points` - Total points
- `max_points` - Maximum possible points
- `feedback` - Next step recommendation

**Example:**
```json
{
  "aspects": [
    {"name": "6a", "symbol": "✓✓✓", "points": 2.0, "comment": "Both gases correct"},
    {"name": "6b", "symbol": "✓", "points": 0.5, "comment": "Mentions diffusion"},
    {"name": "6c", "symbol": "✗", "points": 0, "comment": "Missing"}
  ],
  "total_points": 2.5,
  "max_points": 5,
  "feedback": "Review diffusion explanation"
}
```

---

#### `assessment_write_free`

**Purpose:** Write free-form assessment text

**Parameters:**
- `q_file_path` - Path to Q-file
- `student_id` - Student identifier
- `assessment_text` - Free-form assessment

**Use when:**
- Assessment doesn't fit structured format
- Essay questions with detailed feedback
- Non-standard question types

---

#### `assessment_status`

**Purpose:** Show current progress

**Returns:**
- Total students
- Assessed count
- Remaining count
- Points statistics (mean, min, max)
- Per-aspect summaries

---

#### `assessment_get`

**Purpose:** Read a specific student's assessment

**Parameters:**
- `q_file_path` - Path to Q-file
- `student_id` - Student identifier

**Use when:**
- Reviewing previous assessment
- Comparing students
- Quality checking

---

### Support Tools

#### `rubric_read`

**Purpose:** Read rubric file directly

**Parameters:**
- `rubric_path` - Path to rubric file

---

#### `rubric_update`

**Purpose:** Update rubric during session

**Parameters:**
- `rubric_path` - Path to rubric file
- `updates` - Changes to make

**Use when:**
- Clarifying criteria based on student answers
- Adding examples
- Adjusting point distributions

---

#### `insights_save`

**Purpose:** Save pedagogical observation

**Parameters:**
- `output_dir` - Directory for Teacher_Insights.md
- `insight` - Observation text
- `category` - One of: `pattern`, `pedagogical`, `critical`, `summary`
- `question_id` - Question identifier (optional)

**Categories:**
- `pattern` - Common mistakes or misconceptions
- `pedagogical` - Teaching implications
- `critical` - Issues requiring attention
- `summary` - End-of-question overview

---

#### `init`

**Purpose:** Get MPC usage instructions

**Returns:**
- Critical rules for Claude Desktop
- Available tools list
- Best practices

---

## File Formats

### Q-file (Input)

```markdown
---
ASSESSMENT-STATUS:
  total_students: 16
  assessed_students: 0
  pending_students: 16
---

## Elev <id> (47 ord)

[Student's answer text...]

---

## Elev <id> (0 ord)

[Ingen svar]

---
```

### Assessed Q-file (Output)

```markdown
## Elev <id> (47 ord)

[Student's answer text...]

### ANALYTIC ASSESSMENT:
**6a (Gases):** ✓✓✓ **2.0p** - Both O₂ and CO₂ correct
**6b (Diffusion):** ✓ **0.5p** - Mentions diffusion, no gradient explanation
**6c (Concentration):** ✗ **0p** - Missing

**TOTAL: 2.5/5p**
**→ Next step:** Review concentration gradient concept

---
```

### Quality Symbols

| Symbol | Meaning | Typical Use |
|--------|---------|-------------|
| ✓✓✓ | Excellent | Full marks, complete answer |
| ✓✓ | Good | Minor omissions |
| ✓ | Acceptable | Partial credit |
| ⚠ | Problematic | Significant issues |
| ✗ | Incorrect/Missing | No credit |
| - | Not applicable | Skipped aspect |

---

## Tips & Best Practices

### During Assessment

1. **Consistent criteria** - Use rubric consistently across all students
2. **Document patterns** - Use `insights_save` when you spot common mistakes
3. **Take breaks** - Fatigue affects consistency
4. **Review borderline cases** - Use `assessment_get` to compare similar answers

### After Assessment

1. **Check statistics** - Review `Assessment_Status_Summary.md`
2. **Identify teaching gaps** - Check `Teacher_Insights.md`
3. **Update rubric** - Use `rubric_update` to clarify criteria for next time

### Session Continuity

- Assessment progress is saved in the Q-file (YAML frontmatter)
- You can stop and resume later - Claude Desktop reads the saved state
- `assessment_status` shows where you left off

---

## Troubleshooting

### Common Issues

#### "File not found"

**Cause:** Wrong path or file doesn't exist
**Solution:** Use full absolute path (e.g., `/path/to/project)

#### "Student not found"

**Cause:** Student ID mismatch
**Solution:** Use exact ID from Q-file header (e.g., `100001` or `TestElev10`)

#### "Assessment already exists"

**Cause:** Student already has ANALYTIC ASSESSMENT section
**Solution:** Use `assessment_get` to view existing, or manually edit file

#### Claude says "I can't access that file"

**Cause:** Claude Desktop sandbox limitation
**Solution:** MPC can access files, but Claude can't use bash. Just ask Claude to use the MPC tools directly.

### Session Recovery

If Claude Desktop restarts mid-session:

1. Call `assessment_status` to see progress
2. Call `assessment_read_next` to continue from where you left off
3. The YAML frontmatter tracks which students are done

---

## See Also

- [README.md](../README.md) - Project overview
