# Contributing to Assessment Suite

Thank you for considering contributing to Assessment Suite.

## Critical rules: data protection

Assessment Suite processes student exam answers. This is a public repository: never let real personal data into it, in code, tests, comments, documentation, examples or commit messages. Git history is permanent.

- **Never commit real personal data:** names (students, colleagues, teachers), school or institution names, identifying places, personal-identity numbers, file paths containing a username (`/Users/...`), secrets (API keys, tokens, `.env`), and real student answers or assessment outputs.
- **Use fabricated data in every example and test.** Anonymised real data is not accepted, because anonymisation can leak. The bundled example combines fabricated student answers with authentic questions, a rubric and a syllabus; see [EXAMPLES_POLICY.md](EXAMPLES_POLICY.md).
- **Watch quasi-identifiers:** a class plus a date plus a subject can identify a student even with no name attached.
- **Already committed something real?** Deleting the file is not enough; it stays in the git history. Stop, scrub the history, rotate any exposed secret, and escalate before the next push.

## Ways to contribute

- **Report bugs:** [open an issue](https://github.com/tikankika/assessment-suite/issues/new)
- **Suggest features:** [start a discussion](https://github.com/tikankika/assessment-suite/discussions)
- **Improve documentation:** submit a PR
- **Submit code:** fix bugs or add features

---

## Development setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- An AI application that supports MCP servers
- Git

### Quick setup

```bash
git clone https://github.com/tikankika/assessment-suite.git
cd assessment-suite

# Python package
cd packages/assessment-data-mcp
pip install -e ".[dev]"
pytest

# TypeScript package
cd ../assessment-mcp
npm install
npm run build
```

**Full guide:** [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md)

---

## Code style

### TypeScript
- Follow existing patterns in `assessment-mcp`
- Use TypeScript strict mode (configured in tsconfig.json)
- Keep code readable and well-commented

### Python
- Follow PEP 8
- Use Black formatter: `black .`
- Type hints required
- Run: `mypy src/` for type checking

### Commits
Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(phase6): Add uncertainty review tool
fix(pdf): Handle scanned documents
docs(adr): Add decision on tool naming
```

---

## Testing

### Python
```bash
cd packages/assessment-data-mcp
pytest tests/ -v
```

### TypeScript
```bash
cd packages/assessment-mcp
npm run build && npm test
```

Both suites run in CI. Manual testing through an AI application is still needed for the conversational workflow.

---

## Documentation

### For code changes
- Update relevant docstrings
- Add/update tests
- Update CHANGELOG.md

### For new features
- Add to README.md
- Create an ADR for architectural decisions

---

## Pull request process

1. **Fork** the repository
2. **Create branch** from `main`:
   - Feature: `feat/description`
   - Bugfix: `fix/description`
   - Docs: `docs/description`
3. **Make changes:**
   - Follow code style
   - Add tests
   - Update docs
4. **Test thoroughly**
5. **Submit PR:**
   - Clear title and description
   - Link related issues
   - Request review

---

## Questions?

- Check [WORKFLOW-INTEGRATION.md](docs/WORKFLOW-INTEGRATION.md)
- Review [ADRs](docs/decisions/) for design rationale
- Ask in [discussions](https://github.com/tikankika/assessment-suite/discussions)

---

## Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

---

## Licence

By contributing, you agree that your contributions will be licensed under PolyForm Noncommercial 1.0.0 (see [LICENSE](LICENSE)).
