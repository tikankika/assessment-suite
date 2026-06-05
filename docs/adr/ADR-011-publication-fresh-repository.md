# ADR-011: Publication via Fresh Repository

**Status:** Accepted
**Date:** 2026-05-23
**Deciders:** Niklas Karlsson, Claude
**Technical Story:** Decide how to publish Assessment Suite given that the original repository had a public window and carried pseudonymous identifiers throughout its history.

---

## Context and Problem Statement

Assessment Suite is currently private but **was public at some point** — it is indexed on a third-party catalogue (LobeHub), which only crawls public GitHub repositories. Pseudonymous Inspera candidate IDs and internal course codes have been present **since the first commit (2025-12-30)** — there was never a "clean period" in the history.

The question is **how to publish**: clean the existing repository and its history, or start a fresh repository with new history.

---

## Decision Drivers

* **Zero unknown PII** in the published artefact.
* **Exposure severity is low** (assessed by the author): identifiers are pseudonymous, contain no real names, concern adult/upper-secondary students, are not identifiable without LMS database access, and are not special-category data — GDPR Art. 4, not Art. 9.
* **Break the old indexing slug** so the public entry point is a clean one.
* **Effort and clarity** — the result must be useful and maintainable.

---

## Considered Options

### Option 1: Keep the existing repository, scrub history

**Description:** Run `git filter-repo` against known identifiers across all 831 commits, force-push, and publish the existing repo.

**Pros:**
- ✅ Preserves the 831-commit history and contributor attribution
- ✅ Less rebuild effort

**Cons:**
- ❌ Only **known** patterns are scrubbed; unknown PII never searched for remains across 831 commits
- ❌ Direct evidence of unknown-unknowns: a history scrub on 2026-05-20 was followed by the discovery of four commits carrying a private contributor email nobody knew were there
- ❌ The third-party cache (LobeHub) persists on the old slug even after a scrub
- ⚠️ *Note:* the known-PII case **was** handled — history was scrubbed and force-pushed 2026-05-20 and verified clean per-ref on 2026-05-23 (main and origin/main carry 0 of the known identifiers; they survive only in a local, never-pushed backup tag). So the residual risk is specifically unknown-unknowns plus the external cache, not known PII.

### Option 2: Fresh repository, new name, allowlist-copy (**CHOSEN**)

**Description:** Create a new repository `assessment-suite` (kebab-case). Copy **only an explicitly listed set of folders/files** (an allowlist) from a verified-clean working tree into a fresh `git init`. New history; no carry-over of the 831 commits.

**Pros:**
- ✅ **Zero unknown PII by definition** — only explicitly listed, verified-clean files are copied
- ✅ The new slug breaks the old external indexing entry point
- ✅ A clean, comprehensible public starting point

**Cons:**
- ❌ Loses commit history and attribution — mitigated by a `CONTRIBUTORS` file
- ❌ Rebuild effort (licence swap, ADR placement, verification gate)
- ❌ Does **not** undo prior external exposure — the LobeHub cache requires a separate **takedown request** (a rename is cosmetic for the cache); see "Out of scope" below

---

## Decision

Publish via a **fresh repository `assessment-suite`**, populated by allowlist-copy from a verified-clean HEAD, with new git history. The previous repository is kept **private** for now; its final disposition (archive vs delete) is deferred.

---

## Consequences

**Positive:**
- Strongest available PII guarantee for the published artefact.
- Clean, intentional public surface.

**Negative / trade-offs:**
- History and attribution are lost from the public repo (`CONTRIBUTORS` mitigates).
- The old repository, its backup tags, and the external cache still exist — handled separately, not by this decision.

**Honesty note:** The original rationale leaned partly on "the history is dirty." That weakened when a per-ref verification (correcting an earlier `git log --all` error that had counted backup-tag commits) showed main/origin were already clean. The decision therefore stands on the **narrower** grounds of unknown-unknowns, a clean slate, and breaking the slug — not on known dirty history.

**Allowlist (the public/private cut), recorded for the build:**
- **Include:** the five user-facing `docs/` guides, `docs/adr/`, `packages/` (code, minus `node_modules`/`dist`/`.venv`), `examples/` (fabricated data), `methodology/` (cleaned, must pass the verification scan), `scripts/`, top-level community files, `.github/`.
- **Exclude (never public, v1):** `docs/rfcs/`, `docs/legal/`, `docs/decisions/`, `docs/explorations/`, `CLAUDE.md`, and `.claude/` (rules, commands, agents, hooks), `.mcp.json`.

**Verification gate before push (run on the fresh repo):** clean `CHANGELOG` of internal-process narration; run the test suite, `/security-review`, the `doc-reviewer` agent, and a secrets scan; re-run the hygiene scan. Push to GitHub is the single irreversible step and requires explicit human confirmation.

---

## Out of Scope

- **External exposure (LobeHub, prior clones/caches):** handled by a separate takedown request and the external-archive checks (Wayback, Software Heritage, forks — all verified clean as of 2026-05-20). A fresh repo does not retroactively remove what a public window may have exposed.
- **Old repository disposition** (archive vs delete): deferred.

---

## Related

- [ADR-010: Licence — PolyForm Noncommercial 1.0.0](./ADR-010-licence-polyform-noncommercial.md) — swapped during this build
- [ADR-009: External Inspera Bridge](./ADR-009-external-inspera-bridge.md) — the PII-minimisation posture this decision continues
