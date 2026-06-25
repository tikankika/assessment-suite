# Getting Started: Your First AI-Assisted Assessment

**Time to complete:** 30 minutes setup + 2 hours for first assessment (15 students)  
**For:** Teachers new to AI-augmented analytical assessment

---

## What You'll Learn

By the end of this guide, you will:

- ✅ Understand **analytical assessment** and how AI assists (not replaces) teacher judgment
- ✅ Set up Assessment Suite on your computer
- ✅ Complete your first AI-assisted assessment from exam upload to final feedback
- ✅ Know when to trust AI suggestions vs when to verify carefully
- ✅ Use **methodology documents** to guide assessment decisions

**Target audience:** Educators assessing essay responses, problem-solving, or any evaluation requiring professional judgment (not automated scoring).

---

## What is Analytical Assessment?

**Analytical assessment** evaluates student work criterion-by-criterion rather than holistically.

**Example:**
Instead of: *"This essay is a B"*  
You assess: 
- Criterion 1 (Argumentation): Strong ✓✓✓
- Criterion 2 (Evidence use): Adequate ✓✓
- Criterion 3 (Structure): Weak ✓

**Why analytical assessment?**
- More transparent to students
- More reliable across teachers
- Provides specific feedback for improvement
- **Perfect for AI assistance** - criteria are explicit

**Assessment Suite helps with:** Organizing this criterion-by-criterion analysis systematically while preserving your professional judgment.

---

## The Teacher-AI Collaboration Workflow

### Your Role (Professional Judgment)
- ✅ Verify all AI proposals before accepting
- ✅ Make final evaluative decisions
- ✅ Interpret rubric criteria based on course context
- ✅ Decide on borderline cases
- ✅ Write personalized feedback

### AI's Role (Structured Support)
- 📊 Analyse exam structure (questions, criteria, point values)
- 📝 Organise student responses by question
- 💬 Provide criterion-by-criterion analysis drafts
- 🔍 Flag inconsistencies or uncertain cases
- ✍️ Draft feedback suggestions (you refine)

**Critical principle:** AI provides scaffolding; you make all evaluative decisions.

---

## Assessment Methodology

Assessment Suite is grounded in **analytical assessment research** and follows a structured methodology developed through pedagogical practice.

### Methodology Documents

**Location:** the `methodology/` folder, organised in three layers — `pedagogical/` (assessment principles and per-phase methodology), `technical/` (phase mechanics), and `cross_phase/` (methodology spanning phases).

**Start here:** [`pedagogical/00_foundation.md`](../methodology/pedagogical/00_foundation.md) — the non-negotiable principles and the validity-argument structure of the pipeline.

**Status:** the theoretical grounding is under active development.

**Language:** English (British), with Swedish retained where it reflects the tool's actual output or quotes Swedish source material.

### How Methodology Guides Your Work

1. **During Setup (Phase 4):** Methodology guides question detection and rubric interpretation
2. **During Assessment (Phase 6):** Claude can reference methodology for uncertain cases
3. **During Feedback (Phase 9-12):** Methodology provides formative feedback principles

### Using Methodology with Claude

**Example dialogue:**
```
You: "I'm uncertain if this partial answer deserves 2/3 or 3/3 points."

Claude: *reads methodology/pedagogical/00_foundation.md*
"According to the methodology (§3.2 - Generous Interpretation), 
if the answer is correct in substance but imperfectly formulated, 
it should be approved. Does this student demonstrate understanding 
despite the incomplete explanation?"

You: "Yes, the core concept is clear. I'll award full points."
```

**Teacher tip:** Ask Claude to "consult the methodology" when you encounter assessment dilemmas.

---

## Quick Setup

### Prerequisites Checklist

Before starting, ensure you have:

- [ ] **Claude Desktop** installed ([download](https://claude.ai/download))
- [ ] **Python 3.10+** and **Node.js 18+** ([details in Appendix A](#appendix-a-detailed-installation))
- [ ] **Your assessment materials ready:**
  - Exam questions (PDF or markdown)
  - Rubric with evaluation criteria
  - Student responses (PDFs)

**For detailed installation:** See [Appendix A: Detailed Installation](#appendix-a-detailed-installation)

### Installation (3 Steps)

**Step 1: Download Assessment Suite**
```bash
git clone https://github.com/tikankika/assessment-suite.git
cd assessment-suite
```

**Step 2: Install Packages**
```bash
# Python package
cd packages/assessment-data-mcp
pip install -e .

# TypeScript package
cd ../assessment-mcp
npm install && npm run build
```

**Step 3: Create Workspace and Configure Claude Desktop**

Assessment Suite uses **workspace lockdown** — the MCP servers refuse to start without a `--workspace` argument and can only read or write inside that one directory. Create the workspace first:

```bash
mkdir -p ~/assessment_workspace
```

Then add this to Claude Desktop config file:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "assessment": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/assessment-suite/packages/assessment-mcp/dist/server.js",
        "--workspace",
        "/ABSOLUTE/PATH/assessment_workspace"
      ]
    },
    "assessment-data": {
      "command": "/ABSOLUTE/PATH/assessment-suite/packages/assessment-data-mcp/.venv/bin/python3",
      "args": [
        "-m", "assessment_data_mcp.server",
        "--workspace",
        "/ABSOLUTE/PATH/assessment_workspace"
      ],
      "cwd": "/ABSOLUTE/PATH/assessment-suite/packages/assessment-data-mcp"
    }
  }
}
```

**Replace `/ABSOLUTE/PATH/`** with your actual paths (one for the cloned `assessment-suite` repo, one for the workspace folder you just created).

> **Use the venv's Python, not bare `python3`.** The Python server's `command`
> must point at `packages/assessment-data-mcp/.venv/bin/python3` (the venv you
> created in [SETUP_GUIDE](SETUP_GUIDE.md)), not the system `python3` — on macOS
> the system Python is often 3.9, which is too old and the server will fail to
> start.

**Restart Claude Desktop** (quit completely, then reopen)

### Verify Installation

Open Claude Desktop and ask:
```
What MCP tools do you have available for assessment?
```

**Expected:** Claude lists tools like `scan_source_directory`, `phase4a_question_detection`, `assessment_start`, etc.

✅ **Success!** You're ready to assess.

❌ **Problems?** See [Appendix B: Troubleshooting](#appendix-b-troubleshooting)

---

## Your First Assessment: Step-by-Step Walkthrough

### Scenario

You're assessing **15 biotechnology students** on a **3-question exam**.

**You have:**
- `exam_biotech_HT25.pdf` - Exam questions
- `rubric_biotech.md` - Evaluation criteria
- `student_answers/` - Folder with 15 PDFs (one per student)

**You'll get:**
- Criterion-level assessment for each student
- Formative feedback suggestions
- Quality assurance for consistency

**Time:** ~2 hours (vs 6-8 hours manual assessment)

---

### Phase 1-2: Prepare Files (5 minutes)

**What happens:** Claude discovers your files and converts PDFs to markdown for analysis.

**In Claude Desktop:**
```
Explore and set up an assessment project:
- Directory: /Users/you/biotech_exam/
- Project name: biotech_HT25
- Output: ~/Desktop/assessments/
```

**Result:** Project structure created at `~/Desktop/assessments/biotech_HT25/`

**What you verify:** 
- ✅ All 15 student files detected?
- ✅ Exam and rubric identified correctly?

---

### Phase 4: Analyse Exam Structure (15 minutes)

**What happens:** Claude analyses your exam to identify questions, criteria, and point values.

#### Phase 4A: Question Detection

**Claude proposes:**
```
Detected 3 questions:
Q1: Restriction enzymes (5 points)
Q2: DNA replication (8 points)  
Q3: PCR method (7 points)
```

**Your task:** Verify this matches your exam. Correct if needed.

**Pedagogical note:** Accurate question detection ensures students' answers are organised correctly.

#### Phase 4B: Rubric Validation

**Claude proposes:**
```
Question 1 maps to rubric section "QUESTION 1: Restriction enzymes"
Criteria:
- 1a: Naming (2 points) - "Correct identification of enzyme name"
- 1b: Function (3 points) - "Explanation of cutting mechanism"
```

**Your task:** Does this mapping match your rubric intent?

**Why this matters:** Rubric mapping determines how assessments are structured. AI suggests; you decide if interpretation is pedagogically sound.

#### Phase 4C-D: Completion & Boundaries

**What happens:** Claude checks which students answered which questions and identifies where each answer begins/ends.

**Your task:** Review the student completion report. Flag any detection errors.

---

### Phase 5: Extract Student Answers (2 minutes)

**What happens:** Claude creates Q-files - one file per question containing all students' answers.

**Result:** 
- `Q1_alla_elever.md` - All 15 students' answers to Question 1
- `Q2_alla_elever.md` - Question 2
- `Q3_alla_elever.md` - Question 3

**Why separate files?** Allows you to assess all students on Q1, then Q2, then Q3 - more consistent than jumping between students.

---

### Phase 6: Assess Students (90 minutes for 15 students)

**The core assessment phase.** This is where AI-teacher dialogue happens.

#### Start Assessment

**In Claude Desktop:**
```
Start assessment for Question 1 (biotech_HT25)
```

**Claude loads:**
- ✅ Question 1 text
- ✅ Rubric criteria for Q1
- ✅ Assessment methodology
- ✅ First student's answer

#### Assessment Dialogue (per student)

**1. Claude presents student answer**
```
Student: 100001

ANSWER:
"[Fictional example] The student's response to Q1 — full text 
shown verbatim. Length: ~50 words across 2–3 sentences."

[Full answer shown - never truncated]
```

**2. Claude provides criterion-level analysis**
```
PROPOSAL (Criterion-by-criterion):

Criterion 1a (Naming, 2p):
- Student correctly identifies the core concept
- Quality: ✓✓✓ (Full quality)
- Points: 2/2

Criterion 1b (Function, 3p):
- Explains the mechanism at the required level of detail
- References the appropriate technical term
- Connects the term to its observable consequence
- Quality: ✓✓✓ (Full quality)
- Points: 3/3

TOTAL: 5/5 points
```

**3. You verify or adjust**
```
You: "I agree. The student shows complete understanding. Approve."
```

**OR:**
```
You: "Wait — the student says 'sticky ends' but doesn't explain WHY 
they're sticky. I'd give 2/3 on criterion 1b."

Claude: "Understood. Reducing criterion 1b to 2/3 points (✓✓).
Should I note 'Explain why ends are sticky' in feedback?"

You: "Yes, good suggestion."
```

**4. Claude saves assessment**

**Assessment written to the Q-file** (the tool writes a Swedish `### BEDÖMNING:` — "assessment" — header):
```markdown
### STUDENT: 100001
STATUS: ASSESSED

BEDÖMNING:
Criterion 1a (2p): ✓✓✓ - Correct identification (2/2)
Criterion 1b (3p): ✓✓ - Good but incomplete explanation (2/3)

TOTAL: 4/5

NEXT STEP (Feedback):
Explain WHY sticky ends form - what about the staggered cut creates complementarity?
```

#### Using Methodology During Assessment

**Scenario:** You're uncertain about a borderline answer.

**Ask Claude:**
```
"Consult the methodology - how should I assess partial answers?"
```

**Claude reads `methodology/pedagogical/00_foundation.md`:**
```
"According to §3.2 (Generous Interpretation):
'If the answer is correct in substance but imperfectly formulated, 
it should be approved. Focus on content rather than form.'

Does this student demonstrate understanding despite the wording?"
```

**You decide:** Based on methodology + professional judgment.

#### Assessment Patterns

**After assessing 3-5 students, Claude may identify patterns:**
```
"I notice students frequently confuse 'restriction site' with 'sticky end'.
Should I add this to common misconceptions for class discussion?"
```

**Your response:** Use this for formative teaching insights.

---

### Phase 7-8: Generate Reports (5 minutes)

**What happens:** Claude compiles individual student reports and statistical summaries.

**Result:**
- Individual reports per student (criterion breakdown, points, feedback)
- Class statistics (mean, distribution per criterion)
- Flagged students (unusually low/high performance)

**Use for:** 
- Recording grades in LMS
- Identifying struggling students
- Curriculum reflection (which criteria were difficult?)

---

### Phase 9-12: Formative Feedback (Optional, 30 min)

**Advanced feature:** AI-assisted generation of personalized formative feedback.

**Process:**
1. **Phase 9:** Claude analyses each student's pattern across all questions
2. **Phase 10:** Maps to course learning objectives
3. **Phase 11:** Proposes grading decision with rationale
4. **Phase 12:** Drafts formative feedback (you refine)

**Pedagogical foundation:** based on Lundahl's formative-assessment model and its three questions — Where is the learner now? Where is the learner going? How does the learner get there?

**Teacher control:** You approve/modify all feedback before sending to students.

---

## Next Steps

### After Your First Assessment

**Reflect:**
- How did AI assistance change your assessment process?
- Were assessments more consistent than manual?
- Did criterion-level analysis reveal insights?

**Explore:**
- [WORKFLOW-INTEGRATION.md](WORKFLOW-INTEGRATION.md) - Complete pipeline overview
- [Methodology documents](../methodology/) - Deep dive into assessment principles
- [ADRs](decisions/) - Design decisions and rationale

### For Regular Use

**Best practices:**
1. **Always verify AI proposals** - especially rubric mapping
2. **Consult methodology** for uncertain cases
3. **Use patterns for teaching** - not just grading
4. **Iterate rubrics** based on assessment insights

### Join the Community

**Contribute:**
- Share assessment experiences
- Report bugs or unclear methodology
- Suggest improvements to dialogue flow

**Questions?** [GitHub Discussions](https://github.com/tikankika/assessment-suite/discussions)

---

## Summary

**You've learned:**
- ✅ What analytical assessment is and why AI helps
- ✅ The teacher-AI collaboration model
- ✅ How methodology guides decisions
- ✅ Complete assessment workflow (Phases 1-12)
- ✅ When to trust AI vs verify carefully

**Key takeaway:** Assessment Suite provides structured support, but **you make all evaluative decisions**. AI is a scaffold, not a replacement.

**Time saved:** 60-80% reduction in repetitive analytical work, while maintaining or improving assessment quality.

---

# Appendices

## Appendix A: Detailed Installation

### System Requirements

**Minimum:**
- Python 3.10 or higher
- Node.js 18 or higher
- 4GB RAM
- 2GB disk space

**Recommended:**
- Python 3.11+
- Node.js 20+
- 8GB RAM
- SSD storage

### Step 1: Install Prerequisites

#### Python 3.10+

**macOS (with Homebrew):**
```bash
brew install python@3.11
python3 --version  # Verify
```

**Windows:**
Download from [python.org](https://www.python.org/downloads/)

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install python3.11 python3.11-venv
```

#### Node.js 18+

**macOS (with Homebrew):**
```bash
brew install node@20
node --version  # Verify
```

**Windows:**
Download from [nodejs.org](https://nodejs.org/)

**Linux:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs
```

### Step 2: Clone Repository

```bash
git clone https://github.com/tikankika/assessment-suite.git
cd assessment-suite
```

### Step 3: Install Python Package

```bash
cd packages/assessment-data-mcp

# Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install package
pip install -e .

# Verify installation
python3 -c "import assessment_data_mcp; print('✓ Python MCP installed')"
```

**Expected output:** `✓ Python MCP installed`

### Step 4: Install TypeScript Package

```bash
cd ../assessment-mcp

# Install dependencies
npm install

# Build TypeScript to JavaScript
npm run build

# Verify build
ls dist/server.js  # Should exist
```

**Expected:** `dist/server.js` file created

### Step 5: Configure Claude Desktop

#### Find Config File

**macOS:**
```bash
open ~/Library/Application\ Support/Claude/
# Edit claude_desktop_config.json
```

**Windows:**
```bash
explorer %APPDATA%\Claude
# Edit claude_desktop_config.json
```

#### Add Configuration

**Find your absolute path:**
```bash
pwd  # In assessment-suite directory
# Example: /Users/yourname/Projects/assessment-suite
```

**Create the workspace folder first** (see [Quick Setup](#quick-setup) above for context):

```bash
mkdir -p ~/assessment_workspace
```

**Edit claude_desktop_config.json:**
```json
{
  "mcpServers": {
    "assessment": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/TO/assessment-suite/packages/assessment-mcp/dist/server.js",
        "--workspace",
        "/ABSOLUTE/PATH/TO/assessment_workspace"
      ]
    },
    "assessment-data": {
      "command": "/ABSOLUTE/PATH/assessment-suite/packages/assessment-data-mcp/.venv/bin/python3",
      "args": [
        "-m", "assessment_data_mcp.server",
        "--workspace",
        "/ABSOLUTE/PATH/TO/assessment_workspace"
      ],
      "cwd": "/ABSOLUTE/PATH/TO/assessment-suite/packages/assessment-data-mcp"
    }
  }
}
```

**Critical:** Use YOUR actual absolute paths, not the placeholders. Both servers must point at the same workspace.

### Step 6: Restart Claude Desktop

1. **Quit completely** (File → Quit, not just close window)
2. Wait 5 seconds
3. Reopen Claude Desktop

### Step 7: Verify Installation

In Claude Desktop chat:
```
List all MCP tools you have for assessment
```

**Expected response includes:**
- Python: `scan_source_directory`, `initialize_project`, `convert_documents`
- Phase 4: `phase4a_question_detection`, `phase4b_rubric_validation`, `phase4c_completion_report`
- Phase 6: `assessment_start`, `assessment_read_next`, `assessment_write`
- And more (~35 TypeScript + 9 Python tools)

✅ **If you see 20+ assessment tools: Success!**

---

## Appendix B: Troubleshooting

### Tools Not Showing in Claude Desktop

**Symptom:** Claude says "I don't have access to assessment tools"

**Solutions:**

1. **Check config syntax**
   ```bash
   # Validate JSON
   python3 -m json.tool claude_desktop_config.json
   ```
   Should show no errors.

2. **Verify absolute paths**
   ```bash
   ls /YOUR/PATH/assessment-suite/packages/assessment-mcp/dist/server.js
   # Should show file exists
   ```

3. **Check Claude Desktop logs**
   **macOS:**
   ```bash
   tail -f ~/Library/Logs/Claude/mcp*.log
   ```
   Look for errors about missing files or modules.

4. **Restart Claude Desktop properly**
   - Quit (⌘Q on Mac, Alt+F4 on Windows)
   - Wait 10 seconds
   - Reopen

### "Module not found" Errors

**Symptom:** Python import errors in logs

**Solution:**
```bash
cd packages/assessment-data-mcp
pip install -e .
# Verify
pip list | grep assessment
```

### Build Errors (TypeScript)

**Symptom:** `npm run build` fails

**Solution:**
```bash
cd packages/assessment-mcp
rm -rf node_modules dist package-lock.json
npm install
npm run build
```

### Permission Errors

**Symptom:** "Permission denied" when running commands

**macOS/Linux:**
```bash
chmod +x packages/assessment-mcp/dist/server.js
```

**Windows:** Run terminal as Administrator

### PDF Conversion Fails

**Symptom:** Phase 2 can't convert PDFs

**Check:**
```bash
python3 -c "import pdfplumber; print('✓ pdfplumber OK')"
```

If error:
```bash
pip install pdfplumber
```

---

## Appendix C: Configuration Reference

### Claude Desktop Config Structure

**Full configuration example:**

The `--workspace` argument is required (workspace lockdown — see [SECURITY.md](../SECURITY.md)). Replace `/path/to/` with your actual paths.

```json
{
  "mcpServers": {
    "assessment": {
      "command": "node",
      "args": [
        "/path/to/assessment-suite/packages/assessment-mcp/dist/server.js",
        "--workspace",
        "/path/to/assessment_workspace"
      ],
      "env": {
        "NODE_ENV": "production"
      }
    },
    "assessment-data": {
      "command": "/ABSOLUTE/PATH/assessment-suite/packages/assessment-data-mcp/.venv/bin/python3",
      "args": [
        "-m", "assessment_data_mcp.server",
        "--workspace",
        "/path/to/assessment_workspace"
      ],
      "cwd": "/path/to/assessment-suite/packages/assessment-data-mcp",
      "env": {
        "PYTHONPATH": "/path/to/assessment-suite/packages/assessment-data-mcp"
      }
    }
  }
}
```

### Environment Variables (Optional)

**For debugging:**
```json
"env": {
  "DEBUG": "true",
  "LOG_LEVEL": "debug"
}
```

---

## Appendix D: Assessment Methodology Documents

### Available Documents

Located in the `methodology/` folder, organised in three layers:

- **`pedagogical/`** — the assessment principles and per-phase methodology. Start with
  [`pedagogical/00_foundation.md`](../methodology/pedagogical/00_foundation.md), which defines
  the non-negotiable principles (observation vs interpretation, generous interpretation,
  aspect-level scoring, calibration) and the validity-argument structure of the pipeline.
- **`technical/`** — the mechanics of each phase (question detection, answer boundaries,
  student annotation, rubric validation, format detection).
- **`cross_phase/`** — methodology that spans phases (meta-reflection, descriptive statistics,
  quality assurance).

**Status:** the theoretical grounding is under active development — the methodology documents
are explicit about where it is still being built.

**Language:** English (British), with Swedish retained where it reflects the tool's actual
output or quotes Swedish source material.

### How to Use Methodology

**During assessment:**
```
Ask Claude: "Read the methodology for question detection. Does my rubric mapping follow best practices?"
```

**For learning:**
Read `methodology/pedagogical/00_foundation.md` to understand the pedagogical principles guiding AI behaviour.

**For contributing:**
If you identify methodology gaps or improvements, contribute via GitHub discussions.

---

## Appendix E: Command Reference

### Quick Commands

**Check installation:**
```bash
# Python package
cd packages/assessment-data-mcp
python3 -c "import assessment_data_mcp; print('OK')"

# TypeScript package
cd packages/assessment-mcp
npm run build && echo "OK"
```

**Update packages:**
```bash
# Pull latest changes
git pull origin main

# Rebuild
cd packages/assessment-data-mcp && pip install -e .
cd ../assessment-mcp && npm install && npm run build
```

**Verify installation:**
```bash
# Python tests
cd packages/assessment-data-mcp
pytest tests/ -v

# TypeScript build
cd packages/assessment-mcp
npm run build  # Must compile without errors
```

---

**Installation support:** ~30 minutes  
**First assessment:** ~2 hours  
**Ongoing use:** ~60-80% time savings

**Questions?** [GitHub Issues](https://github.com/tikankika/assessment-suite/issues)

Happy assessing! 🎓
