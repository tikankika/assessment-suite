# ADR-010: Licence — PolyForm Noncommercial 1.0.0

**Status:** Accepted
**Date:** 2026-05-23
**Deciders:** Niklas Karlsson, Claude
**Technical Story:** Choose the licence under which Assessment Suite is published, honouring a noncommercial intent while using a legal vehicle appropriate for software.

---

## Context and Problem Statement

Assessment Suite is being prepared for public release. It is **software** — two Model Context Protocol servers (TypeScript + Python) — not a creative or content work. The author's intent is that teachers and researchers may use and adapt it freely, while commercial use is restricted.

Until now the repository carried **CC BY-NC-SA 4.0**. That choice was made for cross-project consistency with a sibling project (QuestionForge), not because it was the right fit for code. The decision to revisit is: **which licence honours the noncommercial intent in a vehicle designed for software?**

---

## Decision Drivers

* **Noncommercial intent must hold.** Free for teachers and researchers; commercial use restricted.
* **The artefact is software.** The licence needs software-relevant provisions (patent grant, clarity on source distribution) that content licences lack.
* **Clarity for three audiences:** teachers (use), researchers (use + adapt), commercial actors (restricted).
* **Honesty about status.** A noncommercial licence is *source-available*, not OSI-approved "open source" — the README must not overclaim.
* **A future commercial path** should remain open without relicensing the whole project.

---

## Considered Options

### Option 1: CC BY-NC-SA 4.0 (the previous choice)

**Pros:**
- ✅ Widely recognised badge
- ✅ ShareAlike enforces reciprocal sharing of adaptations

**Cons:**
- ❌ Creative Commons **explicitly recommends against** using CC licences for software — they are designed for content
- ❌ No patent grant and no source-code-specific provisions
- ❌ "NonCommercial" is defined for content contexts; its application to software dependencies and SaaS is ambiguous
- ❌ ShareAlike interacts awkwardly with code that pulls in differently-licensed dependencies

### Option 2: MIT / Apache-2.0 (permissive)

**Pros:**
- ✅ Universally recognised, OSI-approved, software-native (Apache includes a patent grant)

**Cons:**
- ❌ Permits unrestricted commercial use — does **not** honour the noncommercial intent

### Option 3: GPL-3.0 / AGPL-3.0 (copyleft)

**Pros:**
- ✅ Strong copyleft; software-native

**Cons:**
- ❌ Still permits commercial use — does not honour the noncommercial intent

### Option 4: PolyForm Noncommercial 1.0.0 (**CHOSEN**)

**Description:** A modern licence drafted by lawyers specifically for **noncommercial software**. Grants broad use, modification and distribution for any noncommercial purpose; reserves commercial use.

**Pros:**
- ✅ Purpose-built for noncommercial *software* — the correct vehicle for this artefact
- ✅ Clear, current definition of "noncommercial"
- ✅ Pairs with **PolyForm Commercial 1.0.0** if a paid commercial licence is later offered — no project-wide relicensing needed
- ✅ Honours the author's intent without the content-licence mismatch

**Cons:**
- ❌ Less universally recognised than CC or MIT
- ❌ Not OSI-approved "open source" (this is inherent to *any* noncommercial licence, not specific to PolyForm) — must be described honestly as "source-available, noncommercial"
- ❌ No ShareAlike-style reciprocal-share requirement (acceptable here; reciprocity was not a hard driver)

---

## Decision

Adopt **PolyForm Noncommercial 1.0.0** for Assessment Suite's public release.

---

## Consequences

**Positive:**
- The licence is the appropriate legal vehicle for noncommercial software.
- The three audiences (teachers, researchers, commercial) have a clear answer.
- A future commercial offering has a ready, compatible path (PolyForm Commercial).

**Negative / trade-offs:**
- Lower badge-recognition than CC/MIT; the README should briefly explain the choice.
- The project is **source-available, not OSI open source** — the README and any directory listing must say so plainly, to avoid misrepresenting it.

**Migration steps (executed during the fresh-repo build):**
1. Replace `LICENSE` with the PolyForm Noncommercial 1.0.0 full text.
2. Update the README licence badge (currently CC BY-NC-SA) and licence section.
3. Update `license` fields in `package.json` and `pyproject.toml`.
4. Update `CITATION.cff` if it references the licence.
5. Grep the tree for residual `CC BY-NC-SA` references.

**Scope note:** This ADR covers **Assessment Suite only**. Whether PolyForm becomes a standard across the author's other repositories (QuestionForge, inspera-bridge, Teacher MCP) is a separate, n=1-premature question and is **deliberately not decided here**.

---

## Related

- [ADR-011: Publication via Fresh Repository](./ADR-011-publication-fresh-repository.md) — the build where this licence swap is executed
- [ADR-009: External Inspera Bridge](./ADR-009-external-inspera-bridge.md) — established the project's security/PII posture
