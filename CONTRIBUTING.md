# Contributing to Assessment Suite

Thank you for considering contributing to Assessment Suite!

## Critical rules — data protection

Assessment Suite processes real student exam answers. This is a public repository —
never let real personal data into the repo, in code, tests, comments, documentation,
examples or commit messages. Git history is permanent.

- **Never commit real personal data:** names (students, colleagues, teachers),
  school or institution names, identifying places, personal-identity numbers, file
  paths containing a username (`/Users/...`), secrets (API keys, tokens, `.env`),
  and real student answers or assessment outputs.
- **Use fabricated or anonymised data in every example and test.** The bundled
  project under `examples/` is fully fabricated — use it as the model, and see
  [EXAMPLES_POLICY.md](EXAMPLES_POLICY.md).
- **Watch quasi-identifiers:** a class plus a date plus a subject can identify a
  student even with no name attached.
- **Already committed something real?** Deleting the file is not enough — it stays
  in the git history forever. Stop, scrub the history, rotate any exposed secret,
  and escalate before the next push.

## Ways to contribute

- 🐛 **Report bugs** - [Open an issue](https://github.com/tikankika/assessment-suite/issues/new)
- 💡 **Suggest features** - [Start a discussion](https://github.com/tikankika/assessment-suite/discussions)
- 📖 **Improve documentation** - Submit a PR
- 💻 **Submit code** - Fix bugs or add features

---

## Development setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- Claude Desktop
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

**Full guide:** [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)

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
npm run build  # Must compile without errors
```

**Note:** TypeScript test coverage is limited. Focus on manual testing with Claude Desktop.

---

## Documentation

### For code changes
- Update relevant docstrings
- Add/update tests
- Update CHANGELOG.md

### For new features
- Add to README.md
- Create ADR for architectural decisions
- Create RFC for major changes

See design process documentation for examples.

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

- 📚 Check [WORKFLOW-INTEGRATION.md](docs/WORKFLOW-INTEGRATION.md)
- 🏗️ Review [ADRs](docs/adr/) for design rationale
- 💬 Ask in [discussions](https://github.com/tikankika/assessment-suite/discussions)

---

## Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

---

## Licence

By contributing, you agree that your contributions will be licensed under PolyForm Noncommercial 1.0.0 (see [LICENSE](LICENSE)).
