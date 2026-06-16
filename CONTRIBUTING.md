# Contributing to Assessment Suite

Thank you for considering contributing to Assessment Suite!

## Ways to Contribute

- 🐛 **Report bugs** - [Open an issue](https://github.com/tikankika/assessment-suite/issues/new)
- 💡 **Suggest features** - [Start a discussion](https://github.com/tikankika/assessment-suite/discussions)
- 📖 **Improve documentation** - Submit a PR
- 💻 **Submit code** - Fix bugs or add features

---

## Development Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- Claude Desktop
- Git

### Quick Setup

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

## Code Style

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

### For Code Changes
- Update relevant docstrings
- Add/update tests
- Update CHANGELOG.md

### For New Features
- Add to README.md
- Create ADR for architectural decisions
- Create RFC for major changes

See design process documentation for examples.

---

## Pull Request Process

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

## License

By contributing, you agree your contributions will be licensed under the
[PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0),
consistent with the project's licence.
