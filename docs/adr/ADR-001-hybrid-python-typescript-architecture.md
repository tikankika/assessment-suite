# ADR-001: Hybrid Python/TypeScript Architecture

**Status:** Accepted  
**Date:** 2025-12-26  
**Deciders:** Niklas Karlsson, Claude  
**Technical Story:** Assessment Suite MCP Server Design

---

## Context and Problem Statement

Assessment Suite processes Swedish educational exams through an 8-phase workflow, from document processing to AI-augmented assessment. The system consists of two MCP (Model Context Protocol) servers that integrate with Claude Desktop:

- **Pre-Assessment_MCP** (Python): Originally designed for file processing  
- **Assessment_MCP** (TypeScript): Originally designed for assessment workflow

**Critical Decision Point:** How should we distribute Phases 4-5 between the two MCP servers?

**Phase 4 (analyze_exam):**
- Analyse exam structure (questions, rubric, format)
- Heavy text parsing and regex operations
- Generate exam_config.yaml

**Phase 5 (create_qfiles):**
- Extract student answers from markdown
- Create Q-files (one file per question with all students)
- Complex text manipulation

Both phases involve intensive text parsing, but we have existing Python code for Phase 5 (cmd_extract.py, ~1500 lines) from the Assessment-workflow CLI project.

---

## Decision Drivers

### Performance Requirements
- Text parsing performance matters (processing 30+ student files)
- V8 engine (TypeScript/Node.js) is 3.3x faster at regex operations than Python
- Phase 4 is pure text parsing (no existing code to reuse)

### Development Resources
- Limited development time available
- Existing Python extraction code (cmd_extract.py, extractors.py, patterns.py) totaling ~1500 lines
- Rewriting in TypeScript would require ~30 hours vs ~3 hours to adapt Python code

### Maintainability
- Prefer single language per logical unit where possible
- Both MCP servers are already in different languages (Python/TypeScript)
- Claude Desktop supports multiple MCP servers in same session

### User Experience
- Users don't see the language switching (Claude handles it transparently)
- Seamless workflow more important than architectural purity

---

## Considered Options

### Option 1: All Python (Pragmatic Approach)

**Distribution:**
- Pre-Assessment_MCP: Phases 1-5
- Assessment_MCP: Phases 6-8

**Implementation:**
- Phase 4: Extract logic from cmd_init.py (~1400 lines), wrap in MCP tool (~20h)
- Phase 5: Adapt cmd_extract.py (~3h)
- Total: ~23 hours development

**Pros:**
- ✅ Reuse massive existing codebase (cmd_init.py + cmd_extract.py)
- ✅ Lower development time (23h vs 50h+)
- ✅ All pre-processing in one MCP server
- ✅ Clear separation: Python = prep, TypeScript = assessment

**Cons:**
- ❌ Python 3.3x slower at text parsing
- ❌ Goes against technical performance analysis
- ❌ Duplicates Q-file format knowledge in two languages

---

### Option 2: All TypeScript (Technical Purity)

**Distribution:**
- Pre-Assessment_MCP: Phases 1-3 only
- Assessment_MCP: Phases 4-8

**Implementation:**
- Phase 4: Write new analyse logic (~25h)
- Phase 5: Rewrite extraction logic (~30h)
- Total: ~55 hours development

**Pros:**
- ✅ TypeScript 3.3x faster text parsing
- ✅ All Q-file logic centralized in Assessment_MCP
- ✅ Type safety prevents Q-file format errors
- ✅ Cleaner architecture (Assessment owns Q-files)

**Cons:**
- ❌ Discard 1500+ lines of working Python code
- ❌ 32 hours additional development time
- ❌ Need to rewrite and test extraction patterns
- ❌ Pre-Assessment becomes "just file processor"

---

### Option 3: Hybrid (CHOSEN - Best of Both Worlds)

**Distribution:**
- Pre-Assessment_MCP: Phases 1-3, 5
- Assessment_MCP: Phases 4, 6-8

**Implementation:**
- Phase 4: TypeScript (new code, ~25h) - optimal for text parsing
- Phase 5: Python (adapt existing, ~3h) - reuse proven extraction code
- Total: ~28 hours development

**Pros:**
- ✅ TypeScript performance where it matters most (Phase 4 parsing)
- ✅ Reuse proven extraction code (Phase 5)
- ✅ Save ~27 hours vs all-TypeScript approach
- ✅ Both MCP servers available simultaneously in Claude Desktop
- ✅ Users experience seamless workflow (Claude handles tool selection)

**Cons:**
- ❌ Mixed languages in workflow (phases alternate)
- ❌ Need to maintain both Python and TypeScript codebases
- ❌ Slightly more complex mental model for developers
- ❌ Q-file format knowledge exists in both languages

**Why Hybrid Works:**
- Claude Desktop allows multiple MCP servers in same chat session
- Claude automatically selects appropriate tool based on context
- User sees seamless experience: "process my exam" → all phases execute
- Handoff points are clean (markdown files → Q-files)

---

## Decision Outcome

**Chosen Option:** **Option 3 - Hybrid Architecture**

### Rationale

**Pragmatism over Purity:**
While all-TypeScript would be architecturally "cleaner," the hybrid approach delivers superior ROI:

1. **Performance Optimization:** Phase 4 (analyze_exam) is the most regex-intensive phase. TypeScript's V8 engine provides 3.3x speedup exactly where needed.

2. **Code Reuse:** Phase 5 (create_qfiles) extraction logic is mature, tested, and working. The cmd_extract.py codebase has been refined through real-world usage with Swedish Inspera exams.

3. **Development Efficiency:** 28h total vs 55h for all-TypeScript represents 27 hours saved (nearly 3 full workdays).

4. **Risk Mitigation:** Reusing proven extraction code reduces bugs and testing time.

### Implementation Strategy

**Phase 4: analyze_exam (TypeScript - NEW)**
```typescript
// Assessment_MCP/src/tools/analyze-exam.ts
async function analyzeExam(examPath: string, rubricPath: string) {
  // Parse exam markdown (V8 regex performance)
  // Parse rubric structure
  // Detect answer format patterns
  // Generate exam_config.yaml
}
```

**Phase 5: create_qfiles (Python - ADAPTED)**
```python
# Pre-Assessment_MPC/src/tools/create_qfiles.py
async def create_qfiles(project_path: str):
    # Reuse cmd_extract.py logic
    # Update filename format
    # Create Q-files with ASSESSMENT-STATUS frontmatter
```

---

## Consequences

### Positive Consequences

**Performance:**
- Phase 4 gets optimal text parsing speed (3.3x faster than Python)
- Phase 5 extraction is "good enough" (Python adequate for this task)

**Development:**
- 27 hours saved development time
- Proven extraction code reduces bugs
- Faster time to market

**Maintainability:**
- Each phase has clear ownership
- Existing Python extraction code continues to be maintained
- TypeScript Phase 4 benefits from type safety

**User Experience:**
- Seamless workflow (user doesn't see language switches)
- Both MCP servers work together automatically
- No manual switching required

### Negative Consequences

**Complexity:**
- Developers need to understand both Python and TypeScript
- Q-file format defined in two places (Python models + TypeScript interfaces)
- Phase distribution requires explanation (hence this ADR!)

**Maintenance:**
- Changes to Q-file format need updates in both languages
- Two dependency management systems (pip + npm)
- Two testing frameworks

### Mitigation Strategies

**Documentation:**
- This ADR explains the "why" to future developers
- WORKFLOW-INTEGRATION.md shows the complete pipeline
- Clear handoff points documented

**Q-file Format Consistency:**
- Define canonical Q-file format in WORKFLOW-INTEGRATION.md
- Python writes Q-files (Phase 5)
- TypeScript reads/writes Q-files (Phases 6-8)
- Regular validation between implementations

**Testing:**
- Integration tests verify Q-file format compatibility
- Test Phase 4 → Phase 5 handoff
- Test Phase 5 → Phase 6 handoff

---

## Validation

### Performance Benchmarks (Estimated)

**Phase 4: Text parsing 1 exam + 30 students**
- TypeScript: ~1.5 seconds
- Python: ~5.0 seconds
- **Speedup: 3.3x** ✅

**Phase 5: Extract answers from 30 students**
- Python: ~2.0 seconds (existing code)
- TypeScript: ~0.6 seconds (if rewritten)
- **Time savings from reuse: 30 hours** ✅

**Overall pipeline:**
- Hybrid: ~3.5 seconds total
- All-Python: ~7.0 seconds total
- All-TypeScript: ~2.1 seconds total (but +27h dev time)

**Conclusion:** Hybrid provides 2x speedup over all-Python while saving 27h vs all-TypeScript.

---

## Related Decisions

- **ADR-002:** Phase 4 TypeScript Implementation Strategy
- **ADR-003:** Phase 5 Python Adaptation Strategy
- **Technical Analysis:** See `/docs/technical/PYTHON-VS-TYPESCRIPT.md`

---

## Notes

**Key Insight:** This decision prioritises **pragmatic engineering** over **architectural purity**.

In an ideal world with unlimited resources, an all-TypeScript solution would be preferable for consistency. However, in the real world with:
- Limited development time
- Existing working code
- Proven extraction patterns
- Clear performance requirements

The hybrid approach delivers the best outcome: fast where it matters, reusing what works, shipping sooner.

**Future Consideration:** If Phase 5 extraction becomes a bottleneck, we can revisit rewriting in TypeScript. Current analysis suggests this is unlikely given that extraction is I/O-bound (reading files) not CPU-bound (parsing text).

---

## References

- [WORKFLOW-INTEGRATION.md](../WORKFLOW-INTEGRATION.md) - Complete 8-phase pipeline
- [MCP Specification](https://spec.modelcontextprotocol.io/) - Model Context Protocol

---

**Status:** Accepted  
**Last Updated:** 2025-12-26  
**Next Review:** After Phase 4-5 implementation (estimate: 2026-01)
