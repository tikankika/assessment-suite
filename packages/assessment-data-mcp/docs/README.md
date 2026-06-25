# Pre-Assessment_MCP Documentation

**For system-wide documentation, see:**  
→ [Assessment Suite Documentation](../../docs/)

---

## This Directory Contains

**Python MCP-specific documentation:**

### Implementation Details
- Phase-specific guides for Python MCP server development

### Specifications
- [MCP_SERVER_SPEC.md](./MCP_SERVER_SPEC.md) - Python MCP server implementation
- Tool signatures, parameters, and return formats

### Architecture Decisions

### Design & RFCs
- [design/](./design/) - Python-specific design documents

### Troubleshooting

### Archive

---

## Quick Links to System Documentation

**Workflow:**
- [Complete 8-Phase Workflow](../../docs/WORKFLOW-INTEGRATION.md)
- [System Architecture](../../docs/decisions/ADR-001-hybrid-python-typescript-architecture.md)

**Python Phases:**
- Phase 1: explore_directory (auto-discover files)
- Phase 2: setup_project (create structure)
- Phase 3: convert_to_markdown (PDF → text)
- Phase 5: create_qfiles (extract answers)

**Integration:**
- Markdown files → TypeScript Phase 4
- YAML config → Python Phase 5

---

## Documentation Principles

**When to document here vs /docs/:**
- **Here:** Python-specific implementation, tools, troubleshooting
- **System docs:** Workflow, architecture, integration between MCPs


---

**Last Updated:** 2025-12-28
