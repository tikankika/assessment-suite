# ADR Index - Assessment_suite

## Architecture Decision Records

This index tracks all ADRs across the Assessment_suite monorepo.

---

## Active ADRs

| ID | Title | Status | Date | Location |
|----|-------|--------|------|----------|
| ADR-001 | Hybrid Python-TypeScript Architecture | ✅ Active | 2025-12-27 | [docs/adr/ADR-001-hybrid-python-typescript-architecture.md](./ADR-001-hybrid-python-typescript-architecture.md) |
| ADR-002 | Tool Naming Standardization | ✅ Active | 2025-12-27 | [docs/adr/ADR-002-tool-naming-standardization.md](./ADR-002-tool-naming-standardization.md) |
| ADR-003 | Progressive Methodology Loading | ✅ Active | 2025-12-27 | [docs/adr/ADR-003-progressive-methodology-loading.md](./ADR-003-progressive-methodology-loading.md) |
| ADR-005 | Phase 6 Workflow Enforcement | ✅ Active | 2025-12-28 | [docs/adr/ADR-005-phase6-workflow-enforcement.md](./ADR-005-phase6-workflow-enforcement.md) |
| ADR-006 | Phase Renumbering | ✅ Active | 2026-02-28 | [docs/adr/ADR-006-phase-renumbering.md](./ADR-006-phase-renumbering.md) |
| ADR-007 | Folder-Phase Alignment & Constants | ✅ Active | 2026-03-01 | [docs/adr/ADR-007-folder-phase-alignment.md](./ADR-007-folder-phase-alignment.md) |
| ADR-009 | External Inspera Bridge — Out-of-process Integration | ✅ Active | 2026-05-17 | [docs/adr/ADR-009-external-inspera-bridge.md](./ADR-009-external-inspera-bridge.md) |
| ADR-010 | Licence — PolyForm Noncommercial 1.0.0 | ✅ Active | 2026-05-23 | [docs/adr/ADR-010-licence-polyform-noncommercial.md](./ADR-010-licence-polyform-noncommercial.md) |
| ADR-011 | Publication via Fresh Repository | ✅ Active | 2026-05-23 | [docs/adr/ADR-011-publication-fresh-repository.md](./ADR-011-publication-fresh-repository.md) |
| ADR-012 | Versioning Policy and 1.0.0 Readiness Criteria | ✅ Active | 2026-06-05 | [docs/adr/ADR-012-versioning-and-1.0-readiness.md](./ADR-012-versioning-and-1.0-readiness.md) |

---

## Archived ADRs

| ID | Title | Status | Reason | Location |
|----|-------|--------|--------|----------|
| ADR-004 | Aspect Reconciliation | 📦 Archived | Superseded by implementation changes | [docs/adr/_archived_ADR-004-aspect-reconciliation.md](./_archived_ADR-004-aspect-reconciliation.md) |

---

## Superseded ADRs (Pre-Assessment Package)

These ADRs from the original pre-assessment-mcp package have been superseded by newer decisions:

| ID | Original Title | Status | Superseded By | Superseded Date |
|----|----------------|--------|---------------|-----------------|
| Pre-ADR-001 | Python Not TypeScript | ⚠️ SUPERSEDED | ADR-001 (Hybrid Architecture) | 2025-12-27 |
| Pre-ADR-002 | 4-Phase Workflow | ⚠️ SUPERSEDED | WORKFLOW-INTEGRATION.md | 2025-12-27 |
| Pre-ADR-003 | Single Analyse Tool | ⚠️ SUPERSEDED | Phase 4A/4B/4C Progressive Validation | 2025-12-27 |

---

## Quick Reference

### Decision Categories

- **Architecture**: ADR-001 (Hybrid language choice)
- **Tool Design**: ADR-002 (Naming), ADR-003 (Methodology loading)
- **Workflow**: ADR-005 (Phase 6 enforcement), ADR-006 (Phase renumbering)
- **Infrastructure**: ADR-007 (Folder constants centralization)
- **Integration**: ADR-009 (External Inspera Bridge)
- **Release / Legal**: ADR-010 (Licence — PolyForm Noncommercial), ADR-011 (Publication via Fresh Repository), ADR-012 (Versioning policy & 1.0.0 readiness)

### Key Principles from ADRs

1. **Pragmatism over Purity** (ADR-001): Choose the right tool for the job
2. **Progressive Validation** (ADR-003): Single → Pattern → Batch
3. **Methodology-Driven** (ADR-003): AI reads methodology files before action
4. **Teacher Control** (ADR-005): Teacher confirms every assessment

---

*Last Updated: 2026-06-05*
