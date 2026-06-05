# Architecture Decision Records (ADR)

This directory contains Architecture Decision Records for the Assessment Suite project.

---

## What is an ADR?

An Architecture Decision Record (ADR) captures an important architectural decision made along with its context and consequences. ADRs help future developers understand why the system is designed the way it is.

**Format:** We use the [MADR](https://adr.github.io/madr/) (Markdown Architectural Decision Records) format.

---

## Index of ADRs

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-001](./ADR-001-hybrid-python-typescript-architecture.md) | Hybrid Python/TypeScript Architecture | Accepted | 2025-12-26 |

---

## ADR Lifecycle

**Status Values:**
- **Proposed:** Under discussion
- **Accepted:** Decision made and being implemented
- **Deprecated:** No longer relevant
- **Superseded:** Replaced by a newer ADR

---

## Creating a New ADR

1. Copy `template.md` to `ADR-XXX-short-title.md`
2. Fill in all sections
3. Submit for review
4. Update this README index

---

## Guidelines

### When to Create an ADR

Create an ADR when making decisions about:
- System architecture (e.g., hybrid Python/TypeScript)
- Technology choices (e.g., MCP protocol)
- Phase distribution between components
- Performance vs maintainability tradeoffs
- Breaking changes to interfaces

### When NOT to Create an ADR

Don't create ADRs for:
- Implementation details (use code comments)
- Obvious decisions (e.g., "use git for version control")
- Temporary workarounds
- Bug fixes

### Writing Good ADRs

**Good ADR:**
- Explains context clearly
- Lists all considered options with pros/cons
- States decision and rationale
- Documents consequences (good and bad)
- Includes validation criteria

**Bad ADR:**
- Just states the decision without context
- Doesn't explain alternatives
- Ignores negative consequences
- No future review criteria

---

## Related Documentation

- [WORKFLOW-INTEGRATION.md](../WORKFLOW-INTEGRATION.md) - Complete pipeline
- [Main README](../../README.md) - Project overview

---

## Questions?

For questions about ADRs in this project, see:
- [ADR best practices](https://adr.github.io/)
- [MADR format](https://adr.github.io/madr/)
