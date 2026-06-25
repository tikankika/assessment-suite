# ADR-009: External Inspera Bridge — Out-of-process Integration

**Status:** Accepted
**Date:** 2026-05-17
**Deciders:** Niklas Karlsson, Claude
**Technical Story:** Bring Inspera into the assessment loop (pull submissions, push marks) without exposing API credentials or candidate PII to MCP servers or Claude.

---

## Context and Problem Statement

Assessment Suite has, until now, been file-driven: PDFs and markdown arrive on disk (manually downloaded from the LMS), the MCP servers process them, the teacher reviews, and marks are typed back into the LMS by hand. With newly issued API credentials from the LMS vendor, we can close the loop programmatically — pull candidate submissions and push marks — but doing so creates two new failure modes that the current architecture has no defence against:

1. **Credential leakage.** If API keys live inside the MCP servers or are read by Claude tool handlers, *any* tool-handler bug or prompt-injection that exfiltrates input/output also exfiltrates the credentials. The blast radius is "every assessment ever processed".
2. **Re-identification surface.** If a mapping between LMS candidate IDs and real names is held anywhere the MCP servers can read, the same prompt-injection risk applies to PII.

The decision is **where the LMS-facing code lives** and **what isolates it** from the rest of the suite.

---

## Decision Drivers

* **Hard security invariant:** API credentials must never reach Claude Code, Claude Desktop, or any MCP server process. They live in exactly one process.
* **Hard data invariant:** No re-identification key exists outside the LMS itself. The bridge stores no mapping from LMS candidate ID to identity.
* **MVP appetite:** Small (5 working days). Architecture must not force us to rewrite either existing MCP server.
* **Public-API ceiling:** The LMS's public API supports numeric marks but not per-question Page Notes or per-candidate Explanation content. The bridge must accommodate qualitative output that *cannot* be POSTed today, in a format ready to switch on when the API catches up.
* **Audit clarity:** A clear separation lets the LMS vendor see exactly what we send and receive when we later request expanded API coverage.

---

## Considered Options

### Option 1: Embed bridge in `assessment-mcp` (TypeScript)

**Description:** Add new MCP tools (`inspera_pull`, `inspera_push`) to the existing TypeScript MCP server. Credentials read at process startup from environment or a config file.

**Pros:**
- ✅ One repo, one install path
- ✅ Tool surface is uniform from Claude's perspective

**Cons:**
- ❌ Credentials are in the same process address space as code Claude can invoke via tool calls
- ❌ A buggy or compromised tool handler exfiltrates everything (credentials + cached PII)
- ❌ MCP server restarts when LMS contract changes — couples release cadences
- ❌ Tightly couples Claude availability to LMS availability (token refresh failures cascade into MCP errors)

---

### Option 2: Embed bridge in `assessment-data-mcp` (Python)

**Description:** Same as Option 1 but in the Python MCP server, where most data-pipeline code already lives.

**Pros:**
- ✅ Reuses existing Python tooling and anonymisation code
- ✅ Slightly better isolation than Option 1 (separate process from TypeScript MCP)

**Cons:**
- ❌ Same credential-in-tool-handler exposure as Option 1
- ❌ Mixes inbound import logic with outbound LMS calls — two failure modes, one process
- ❌ Doesn't satisfy the hard credential invariant

---

### Option 3: External bridge, separate repo, filesystem hand-off (**CHOSEN**)

**Description:** A standalone Python CLI (`inspera-bridge`) lives in its **own repository**, outside `Assessment_suite`. It is the sole holder of LMS credentials (stored in macOS Keychain). It communicates with the rest of the suite *only* through files in a shared folder (Nextcloud). MCP servers and Claude never see credentials, tokens, raw HTTP calls, or PII — they only see filtered files the bridge has already written.

```
┌──────────────────────────────────────────────────────────────┐
│  LMS (cloud)                                                 │
└────────────┬──────────────────────────────▲──────────────────┘
             │  HTTPS (Bearer token)        │  POST marks
             ▼                              │
┌──────────────────────────────────────────────────────────────┐
│  inspera-bridge  (separate repo, separate process)           │
│  • Sole holder of API credentials (macOS Keychain)           │
│  • Filters PII at receipt (no re-identification map)         │
│  • Writes to Nextcloud inbox/outbox                          │
└────────────┬──────────────────────────────▲──────────────────┘
             │  candidate-id + filtered    │  marks.json
             ▼  submission                  │  (+ qualitative
                                            │   feedback as
                                            │   structured JSON
                                            │   ready for future
                                            │   API endpoints)
┌──────────────────────────────────────────────────────────────┐
│  Nextcloud-mounted folder (Assessment_suite_exchange/)       │
│  inbox/<testId>/<candidateId>/...                            │
│  outbox/<testId>/<candidateId>/...                           │
└────────────┬──────────────────────────────▲──────────────────┘
             │                              │
             ▼                              │
┌──────────────────────────────────────────────────────────────┐
│  Assessment_suite MCP servers + Claude Desktop               │
│  • Read inbox/, write outbox/ — no LMS knowledge             │
│  • No credentials, no tokens, no HTTP to LMS                 │
└──────────────────────────────────────────────────────────────┘
```

**Pros:**
- ✅ Satisfies hard credential invariant — credentials live in one process Claude cannot invoke
- ✅ Satisfies hard data invariant — bridge filters PII at receipt, holds no mapping
- ✅ Filesystem hand-off means even a fully compromised MCP server cannot exfiltrate credentials
- ✅ Bridge release cadence independent of MCP servers
- ✅ Qualitative-output JSON files can be re-routed to LMS API the day the endpoints land — no MCP changes
- ✅ Audit story for the LMS vendor is clean: one process, one log, one set of calls

**Cons:**
- ❌ Two repos to maintain instead of one
- ❌ Filesystem hand-off is asynchronous — operator must trigger `pull`/`push` explicitly (acceptable for MVP)
- ❌ Bridge needs its own packaging, install instructions, and tests

---

## Decision Outcome

**Chosen Option:** **Option 3 — External bridge in separate repo, filesystem hand-off**

### Rationale

The credential invariant is non-negotiable for an integration with an upstream system that holds the entire school's exam data. Options 1 and 2 both violate it because credentials sit in the same address space as code Claude can drive via tool calls. The cost of Option 3 (extra repo, manual trigger) is a small price for an isolation boundary that no single bug or prompt-injection can cross.

The CLI shape (manual `pull`/`push` commands rather than a daemon) is chosen for the MVP because: it minimises always-on attack surface, it makes the operator the trigger of every LMS interaction, and it defers webhook infrastructure (which would require publicly reachable HTTPS) to a later version.

### Implementation Strategy

**Bridge repo:** New repository (location and name to be confirmed by the operator). Python project with:
- `inspera_bridge/auth.py` — token exchange and refresh, Keychain reads
- `inspera_bridge/pull.py` — order export, poll, download, filter PII at receipt, write to inbox
- `inspera_bridge/push.py` — read outbox marks, POST via marks API
- `inspera_bridge/cli.py` — `inspera-bridge pull <testId>` / `push <testId>`
- `inspera_bridge/anonymise.py` — re-use of existing project anonymisation code (planned, see MVP spec)

**Assessment_suite changes:** None to MCP server code in V1. The suite gains a documented filesystem contract for inbox/outbox folder layout; the MCP servers continue to operate on files unchanged.

**Exchange folder layout:**
```
inbox/<testId>/
  test_metadata.json
  grading_scheme.pdf
  assessment.pdf
  candidates/<candidateId>/submission.json
outbox/<testId>/
  candidates/<candidateId>/
    marks.json           ← POSTed to LMS by bridge push
    page_notes.json      ← held; will POST when LMS API supports it
    explanation.json     ← held; will POST when LMS API supports it
```

The qualitative-output JSON files are written in V1 in the schema we expect the LMS to accept later (modelled on `ExplanationModel.content` and per-question structures). Until the LMS publishes those endpoints, the bridge logs that they are "queued, not delivered". This gives us a concrete artefact to show the LMS vendor when requesting endpoint expansion.

---

## Consequences

### Positive Consequences

**Security:**
- API credentials cannot leak through any MCP tool handler — they are not in those processes
- No re-identification map exists outside the LMS itself
- Bridge has no inbound network surface in V1 (no webhook listener)
- Operator (human) triggers every LMS interaction, eliminating runaway-job risk

**Architecture:**
- LMS contract changes are isolated to the bridge repo
- MCP servers stay focused on assessment logic, not integration plumbing
- Qualitative output is preserved in a structured form ready for future API support

**Process:**
- Bridge can be developed, tested, and released independently of the MCP servers
- The LMS vendor can audit our usage by looking at one well-bounded codebase

### Negative Consequences

**Operational:**
- Two repositories, two install paths, two test suites
- Operator must remember to run `pull` and `push` explicitly
- Filesystem hand-off introduces a small latency between LMS state and local state

**Functional gap (until LMS extends API):**
- Page Notes and Explanation content cannot be POSTed today — they are written to disk but not yet delivered upstream
- The operator must, in V1, treat qualitative output as a queue waiting for delivery (not for manual UI entry — that route is explicitly rejected by the operator preference)

### Mitigation Strategies

**For the two-repo overhead:**
- Bridge repo includes its own CHANGELOG and README
- A pointer from this ADR to the bridge repo (added once the repo is created)
- Shared exchange folder schema is documented in this ADR and re-stated in the bridge repo

**For the qualitative-output gap:**
- The structured `page_notes.json` / `explanation.json` files are designed so that adding LMS POST is a one-function change in the bridge — not a re-architecture
- A scheduled task for the operator: open a support case with the LMS vendor *after* the MVP runs end-to-end at least once, with the bridge's actual output as evidence of need

**For the credential model:**
- This MVP knowingly uses a personal LMS account rather than a dedicated Integration user (operator decision, accepted for V1 only). Before the bridge is used for live cohorts at scale, a dedicated Integration user must be provisioned by the LMS administrator. Tracked in the MVP spec, not as a code TODO.

---

## Validation

**The decision is validated when:**
1. The bridge can complete a full pull → push cycle for one real test event without any LMS credential appearing in any MCP server log, Claude transcript, or file outside the bridge process.
2. The exchange folder contains no field that an LMS administrator could not also derive from the LMS itself (i.e. no aggregation or enrichment that creates new identifying signal).
3. The qualitative-output JSON files validate against the schema we will propose to the LMS vendor — no rework needed when endpoints land.
4. An LMS-vendor reviewer of the bridge repo can answer "what does this tool do with our API?" by reading one Python package.

**Re-evaluation triggers:**
- If the LMS publishes Page Notes / Explanation content endpoints, revisit the manual-trigger model and consider whether the bridge should auto-deliver qualitative output on `push`.
- If multiple operators need to share the bridge, revisit the local-only deployment (likely move to a containerised, possibly server-hosted bridge with secrets in a vault rather than Keychain).
- If we need sub-minute latency between LMS event and local state, revisit the polling-only stance and add webhook support.

---

## Related Decisions

- [ADR-001: Hybrid Python/TypeScript Architecture](./ADR-001-hybrid-python-typescript-architecture.md) — establishes the multi-process pattern this ADR extends.
- Bridge-repo ADR-001 (to be written when the bridge repo is created) — will cover the bridge's own internal architecture (filter pipeline, Keychain integration, retry policy).

---

## Notes

**Key insight:** Architectural security isn't a function of how careful the code is. It's a function of *which processes hold which secrets*. By putting the LMS credentials in a process Claude cannot invoke and cannot read from, the entire class of "tool handler exfiltrates a secret" bugs becomes impossible — not unlikely, impossible. That is the kind of guarantee worth a second repository.

**On Docker:** Containerisation was considered for the bridge. Rejected for V1 because macOS Keychain is not accessible from inside Docker containers — using Docker would *worsen* secrets handling rather than improve it. Re-evaluate if/when the bridge moves to a Linux host.

**On webhooks vs polling:** The LMS supports webhooks (HMAC-SHA1 verified). They are explicitly out of scope for V1 because they require a publicly reachable HTTPS endpoint — a new attack surface — and polling is sufficient for an operator-triggered tool.

**On assessment source — QTI first, PDF as fallback:** When a test was authored in the operator's question-authoring tool (a sibling project that exports Inspera-compatible QTI packages), the bridge prefers a copy of the QTI artefact already present on disk over re-fetching the assessment from the LMS. QTI gives the downstream grader structured question IDs, max scores, and item types; the LMS's `PdfOfAssessment` is a flat rendering that loses that structure. The bridge falls back to `PdfOfAssessment` only when the test was not built via the authoring tool. This is a quality-of-input decision, not a security decision — but the fewer LMS API calls per pull, the smaller the API-surface attack window.

**On free-text anonymisation — component reuse, not import:** The bridge's free-text PII-scrubbing module reuses the *component choices* of a separate operator-owned anonymisation project for Swedish educational text (spaCy `sv_core_news_lg` plus an SCB Swedish-name gazetteer). The bridge does **not** import that project's Python code; it copies the gazetteer file and re-implements the scrubber locally with three V1-specific differences: no caller-supplied name list (would constitute a re-identification key — forbidden by the dataminimisation rule), no interactive review (the bridge is non-interactive), and no numbered pseudonyms (`[PERSON_1]`, `[PERSON_2]`, … would constitute a per-document re-identification map — also forbidden). The result is roughly 150 lines of Python that inherits proven NER and gazetteer choices without inheriting an unsuitable CLI form-factor.

---

## References

- LMS public API: vendor's Swagger specification (internal reference only)
- LMS Webhooks documentation (vendor)
- LMS API policy & code examples (vendor)
- Data-protection and internal-docs boundary: see [SECURITY.md](../../SECURITY.md)

---

**Status:** Accepted
**Last Updated:** 2026-05-17
**Next Review:** After MVP end-to-end run on one real test event
