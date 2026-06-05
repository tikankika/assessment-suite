# Assessment Suite: Teacher Collaboration Guide

> **This is not software you operate. It's an AI colleague you collaborate with.**

---

## What This Is (And What It Isn't)

| Traditional Software | Assessment Suite |
|---------------------|------------------|
| Fixed step-by-step workflow | Adaptive dialogue-driven process |
| Same process every time | Adjusts to your context and needs |
| You follow instructions | You guide the conversation |
| Deterministic output | Contextual recommendations |

**Assessment Suite** is a set of AI-powered tools that assist with analytical assessment. The AI (Claude) has access to:
- Your exam questions and rubrics
- Student answers organised by question
- Pedagogical methodology for fair, consistent assessment
- Tools for writing assessments, generating reports, and analysing patterns

**You remain in control.** Claude proposes, you decide. Claude assesses, you confirm. Claude suggests skipping steps when appropriate - you choose whether to follow that advice.

---

## How to Start a Session

### 1. Describe Your Context

Begin by telling Claude what you're working with:

```
I have a formative quiz with 11 short-answer questions, 9 students.
The goal is quick feedback, not detailed grading.
```

or

```
I need to assess a summative exam - 4 essay questions, 28 students.
Each question has multiple aspects in the rubric.
```

**Why this matters:** Claude will adjust its approach. A formative mini-quiz doesn't need the full Phase 9-12 deep analysis. A high-stakes summative exam might.

### 2. Point to Your Files

Provide paths to your assessment project:

```
Project: /path/to/COURSE_Assessment_2026/
Rubric: rubric.md
```

Claude will use MCP tools to read and understand your setup.

### 3. State Your Goal

Be explicit about what you want to accomplish:

- "Assess all students on Question 6"
- "Generate student reports for the whole exam"
- "Show me which questions the class struggled with"
- "I need to re-assess student 10001 on Q9 - I made an error"

---

## The Phases: Capabilities, Not Mandatory Steps

The assessment workflow has numbered phases, but **they are not a rigid sequence**. Think of them as capabilities you can invoke based on your needs.

### Quick Reference

| Phase | Purpose | When to Use |
|-------|---------|-------------|
| **4** | Setup - detect questions, validate rubric, find students | Once per new exam |
| **5** | Extract answers into Q-files (one file per question) | Once per new exam |
| **6** | Assess students (the core work) | Always |
| **7** | Generate student reports | When you need individual feedback |
| **8** | Quantitative analysis (statistics) | For data-driven insights |
| **9-12** | Deep qualitative analysis per student | Summative exams, borderline cases |
| **13** | Class-level summary for teacher | Formative feedback, course improvement |

### Typical Paths

**Formative Quiz (quick feedback):**
```
Phase 4-5 (setup) → Phase 6 (assess) → Phase 13 (class overview)
Skip Phase 9-12 - overkill for low-stakes assessment
```

**Summative Exam (full analysis):**
```
Phase 4-5 → Phase 6 → Phase 7 (reports) → Phase 8 (stats)
→ Phase 9-12 (selected students) → Phase 13
```

**Re-assessment of one student:**
```
Phase 6 only (with overwrite=true)
Or use assessment_delete to remove and redo
```

---

## Working With Claude: Key Principles

### 1. Claude Proposes, You Decide

Claude will often make suggestions:

> *"For a formative mini-quiz on 11 short questions, the full Phase 9-12 methodology feels like overkill. Want to skip to Phase 13 (class overview) instead?"*

This isn't the system failing to follow procedure. It's the AI applying pedagogical judgment. You can:
- **Accept:** "Yes, let's do that"
- **Decline:** "No, I want full analysis for student 10001"
- **Modify:** "Skip 9-12 for most, but do deep analysis on the three lowest-scoring students"

### 2. The Methodology Guides, Not Dictates

Claude has access to methodology documents that describe best practices for assessment. But methodology is applied contextually:

- **Small formative quiz:** Light-touch assessment, focus on class patterns
- **High-stakes exam:** Rigorous per-aspect analysis, explicit justification
- **Borderline student:** Extra scrutiny, comparison with similar cases

### 3. Interrupt and Redirect Anytime

You're not locked into a workflow. At any point:

- "Wait, go back to student 10002"
- "Actually, show me the rubric for Q6 again"
- "I disagree with that assessment - here's why..."
- "Skip ahead to the class summary"

### 4. Your Judgment Is Final

Claude provides analysis and recommendations. For actual grading decisions, especially:
- Borderline pass/fail cases
- Unusual student responses
- Ambiguous rubric interpretations

**You make the call.** Claude will flag uncertainty and present options, but the teacher confirms.

---

## Example: Adaptive Decision-Making

Here's a real interaction showing how Claude adapts:

**Teacher:** "What do you think about student 10003?"

**Claude:**
> *Honestly - for a formative mini-quiz on 11 short questions, the full Phase 9-12 methodology feels overkill.*
>
> *My analysis of 10003: The student shows an interesting pattern. When they answer, the answers are often correct and concise (Q001, Q003, Q010). But 5 of 11 questions are completely unanswered.*
>
> *This suggests either: missed classes / didn't study those topics, or time pressure / gave up.*
>
> *For this formative quiz, you probably just need:*
> - *Points per student (done)*
> - *Class overview - which questions were hard for many? (Phase 13)*
> - *Brief feedback per student (already in "Next step")*
>
> *Want to skip Phase 9-12 and go straight to Phase 13?*

**Teacher:** "Yes, let's do that"

**Claude:** Proceeds directly to class-level analysis.

---

## Practical Tips

### Starting Fresh
```
"New assessment session. Project at /path/to/exam/.
Show me project status."
```

### Resuming Work
```
"Continue assessment. Where did we leave off with Q006?"
```

### Fixing Mistakes
```
"Delete the assessment for student 10001 on Q009 - I need to redo it."
"Re-assess 10001 with overwrite=true"
```

### Getting Overview
```
"Show me assessment progress for all Q-files"
"Which students are not yet assessed on Q003?"
```

### Asking for Judgment
```
"What's your honest opinion on this response?"
"Is this a borderline case?"
"Compare this to student 10002's answer"
```

---

## What Claude Needs From You

For effective collaboration, Claude needs:

1. **Clear context** - What kind of assessment? What's the goal?
2. **Explicit decisions** - When Claude asks for confirmation, respond clearly
3. **Corrections** - If Claude misunderstands something, say so
4. **Your expertise** - You know your students, your course, your standards

---

## Common Questions

**Q: Does Claude read my methodology automatically?**

A: No. At the start of Phase 6, Claude loads methodology documents and should display them to you. If you want Claude to reference specific methodology mid-session, ask explicitly or call `phase6_methodology`.

**Q: Can I assess students in any order?**

A: Yes. Use `phase6_read_next` for the next unassessed student, or specify a student ID directly.

**Q: What if Claude's assessment seems wrong?**

A: Discuss it. Say "I disagree because..." and Claude will reconsider. You can also override directly: "Give this 2/3 points, not 1/3."

**Q: Can I use this for grading or just feedback?**

A: Both. Phase 6 produces assessments. Phase 9-12 supports grading decisions. Phase 13 gives class-level insights for teaching. Use what you need.

---

## Philosophy

Assessment Suite embodies a specific philosophy:

1. **AI augments, not replaces, teacher judgment**
2. **Transparency** - Claude shows reasoning, not just conclusions
3. **Flexibility** - Adapt to context rather than forcing rigid workflows
4. **Teacher control** - You drive the process, Claude assists

The goal is to make high-quality analytical assessment *feasible* for teachers who otherwise wouldn't have time for it - not to automate judgment away.

---

*For technical documentation, see the methodology files in `/methodology/`.*
