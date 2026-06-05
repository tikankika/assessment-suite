# MCP Server Specification: Pre-Assessment_MPC

**Status:** Draft  
**Created:** 2025-12-25  
**Language:** Python  
**MCP SDK:** Python MCP SDK (Anthropic Official)

---

## Overview

This document specifies the MCP (Model Context Protocol) server for the Pre-Assessment_MPC project. The server provides **4 tools** that guide teachers through exam analysis and Q-file generation in Claude Desktop.

### Purpose

Enable intelligent human-AI collaboration for exam assessment setup:

| Old Approach (CLI) | New Approach (MCP) |
|--------------------|--------------------|
| Manual command typing | Natural conversation |
| Terminal switching | Everything in Claude Desktop |
| Fragile regex patterns | Claude's document understanding |
| Silent failures | Teacher confirmation at each step |
| 1,773 lines `cmd_init.py` | ~100-200 lines per tool |

### Design Principles

1. **Teacher confirms everything** - AI proposes, teacher decides
2. **Natural conversation** - No commands to memorize
3. **Structured state** - project_state.json tracks progress
4. **Progressive enhancement** - Minimum → Enhanced → Full
5. **Code reuse** - Wrap CLI commands, import Python modules
6. **Audit trail** - All actions logged

---

## Architecture Overview

```
Pre-Assessment_MPC/
├── src/
│   └── pre_assessment_mcp/
│       ├── server.py                 # MCP server entry point
│       │
│       ├── tools/
│       │   ├── __init__.py
│       │   ├── setup_project.py      # Phase 1: Setup
│       │   ├── convert_to_markdown.py # Phase 2: Convert
│       │   ├── analyze_and_enrich.py  # Phase 3: Analyze (3 types)
│       │   └── extract_answers.py     # Phase 4: Extract
│       │
│       ├── utils/
│       │   ├── __init__.py
│       │   ├── cli_wrapper.py        # Subprocess for assess CLI
│       │   ├── config_generator.py   # exam_config.yaml generation
│       │   ├── state_manager.py      # project_state.json management
│       │   └── file_ops.py           # File operations
│       │
│       └── validators/
│           ├── __init__.py
│           ├── path_validator.py     # Security validation
│           └── config_validator.py   # YAML validation
│
├── tests/
│   ├── test_setup_project.py
│   ├── test_convert.py
│   ├── test_analyze_and_enrich.py
│   └── test_extract.py
│
└── docs/
    ├── MCP_SERVER_SPEC.md           # This file
    └── WORKFLOW-COMPREHENSIVE.md    # User-facing workflow
```

---

## State Management

### project_state.json Structure

All tools read from and write to a shared state object stored in the project root:

```json
{
  "version": "1.0",
  "project_name": "assessment_<course-code>_<subject>_<year>",
  "created": "2025-12-25T10:00:00Z",
  "last_updated": "2025-12-25T11:45:00Z",
  
  "current_phase": 4,
  
  "phases": {
    "1_setup": {
      "status": "complete",
      "timestamp": "2025-12-25T10:00:00Z",
      "files_created": 22,
      "folders_created": 4
    },
    "2_convert": {
      "status": "complete",
      "timestamp": "2025-12-25T10:15:00Z",
      "files_converted": 21,
      "errors": []
    },
    "3_analyze": {
      "status": "complete",
      "timestamp": "2025-12-25T11:30:00Z",
      "analysis_types": ["structure", "syllabus", "content"],
      "config_generated": true
    },
    "4_extract": {
      "status": "complete",
      "timestamp": "2025-12-25T11:45:00Z",
      "q_files_created": 9,
      "answers_extracted": 158,
      "empty_answers": 4
    }
  },
  
  "sources": {
    "exam_questions": "/Users/.../exam.pdf",
    "rubric": "/Users/.../rubric.pdf",
    "syllabus": "https://skolverket.se/...",
    "student_answers": "/Users/.../Inspera_Export/",
    "course_content": "/Users/.../Course_Materials/"
  },
  
  "paths": {
    "project_root": "/Users/.../assessment_<course-code>_<subject>_<year>/",
    "sources_yaml": "sources.yaml",
    "project_state": "project_state.json",
    "exam_config": "exam_config.yaml"
  }
}
```

### State Persistence

- **Location:** `{project_root}/project_state.json`
- **Updated:** After each tool completes
- **Purpose:** 
  - Enable resuming workflow if interrupted
  - Audit trail of actions
  - Progress tracking

---

## Tool Specifications

### Tool 1: setup_project

**Purpose:** Interactive project setup - collect source files, create folder structure

**MCP Tool Signature:**
```python
@server.call_tool()
async def setup_project(
    exam_path: Optional[str] = None,
    rubric_path: Optional[str] = None,
    syllabus_source: Optional[str] = None,  # URL or file path
    student_answers_path: Optional[str] = None,
    course_content_path: Optional[str] = None,  # Optional
    output_base_path: Optional[str] = None,
    project_name: Optional[str] = None
) -> ToolResult
```

**Behaviour:**

1. **If paths provided:** Validate they exist
2. **If paths missing:** Return prompt asking for them
3. **Scan directories:** Count files in each location
4. **Download syllabus:** If URL provided, fetch and save
5. **Create structure:** Build folders (01_original/, 02_markdown/, etc.)
6. **Copy files:** Copy sources to 01_original/
7. **Generate configs:** Create sources.yaml and project_state.json
8. **Return summary:** Show what was created

**Example Interaction:**

```
User: "Set up a new exam assessment for <course-code>"

Claude: [Calls setup_project with no params]
        [Tool returns: needs more info]
        
        "I'll help you set up the project. I need:
        1. Exam questions file path
        2. Rubric file path
        3. Syllabus (URL or file)
        4. Student PDFs folder
        5. Course content folder (optional)
        6. Where to create project
        7. Project name"

User: [Provides paths]

Claude: [Calls setup_project with all params]
        [Tool executes setup]
        
        "✓ Created project structure
         ✓ Copied 21 files
         ✓ Downloaded syllabus from Skolverket
         Ready for Phase 2?"
```

**Output Format:**
```typescript
{
  success: boolean,
  project_path: string,
  files_created: number,
  folders_created: number,
  sources_saved: {
    exam_questions: string,
    rubric: string,
    syllabus: string,
    student_answers: { count: number, path: string },
    course_content: { count: number, path: string }
  },
  message: string,
  next_step: "convert_to_markdown"
}
```

**Error Handling:**
- Invalid paths → Ask teacher to provide correct path
- Permission denied → Suggest checking folder permissions
- Network error (syllabus) → Retry or use local file

---

### Tool 2: convert_to_markdown

**Purpose:** Convert all PDFs to markdown (wraps `assess convert` CLI)

**MCP Tool Signature:**
```python
@server.call_tool()
async def convert_to_markdown(
    project_path: str
) -> ToolResult
```

**Behaviour:**

1. **Read project_state.json:** Get project paths
2. **Call `assess convert`:** Subprocess wrapper
   ```bash
   assess convert 01_original/ --output 02_markdown/ --recursive
   ```
3. **Parse output:** Extract conversion statistics
4. **Update state:** Mark Phase 2 complete
5. **Return results:** Show files converted

**Example Interaction:**

```
User: "Convert the PDFs to markdown"

Claude: [Calls convert_to_markdown]
        
        "Converting PDFs...
         
         ✓ exam_questions.pdf → .md
         ✓ rubric.pdf → .md
         ✓ 18 student PDFs → .md
         
         All files ready for analysis."
```

**Output Format:**
```typescript
{
  success: boolean,
  files_converted: number,
  failed: string[],  // List of files that failed
  output_dir: string,
  conversion_time: number,  // seconds
  message: string,
  next_step: "analyze_and_enrich"
}
```

**Implementation:**
```python
# pre_assessment_mcp/tools/convert_to_markdown.py
import subprocess
from pathlib import Path

def convert_to_markdown_tool(project_path: str):
    """Wrap assess convert CLI command."""
    
    input_dir = Path(project_path) / "01_original"
    output_dir = Path(project_path) / "02_markdown"
    
    result = subprocess.run([
        "assess", "convert",
        str(input_dir),
        "--output", str(output_dir),
        "--recursive"
    ], capture_output=True, text=True)
    
    # Parse stdout for statistics
    stats = parse_conversion_output(result.stdout)
    
    # Update project_state.json
    update_project_state(
        project_path,
        phase=2,
        status="complete",
        files_converted=stats["total"]
    )
    
    return ToolResult(
        success=result.returncode == 0,
        content=format_results(stats)
    )
```

---

### Tool 3: analyze_and_enrich

**Purpose:** Intelligent analysis with teacher confirmation - ONE tool, THREE types

**MCP Tool Signature:**
```python
@server.call_tool()
async def analyze_and_enrich(
    project_path: str,
    analysis_type: Literal["structure", "syllabus", "content"]
) -> ToolResult
```

**Three Analysis Types:**

#### Type 1: "structure" (Required)

**What it does:**
- **Part A:** Question structure detection
- **Part B:** Rubric structure parsing
- **Part C:** Extraction format detection
- **Output:** exam_config.yaml (base version)

**Implementation:**
```python
# Reuses existing Assessment-workflow modules!
from assessment_framework.core.rubric_parser import RubricParser
from assessment_framework.core.patterns import QuestionDetector
from assessment_framework.core.extractors import detect_answer_markers

def analyze_structure(project_path: Path):
    """Part A: Questions, Part B: Rubric, Part C: Extraction."""
    
    # Part A: Detect questions
    exam_md = project_path / "02_markdown/exam_questions.md"
    detector = QuestionDetector()
    questions = detector.detect_questions(exam_md)
    
    # Part B: Parse rubric
    rubric_md = project_path / "02_markdown/rubric.md"
    parser = RubricParser()
    rubric = parser.parse_rubric(rubric_md)
    
    # Part C: Detect extraction patterns
    sample_students = list_sample_files(project_path / "02_markdown/student_answers/")
    markers = detect_answer_markers(sample_students)
    
    # Generate exam_config.yaml
    config = generate_config(questions, rubric, markers)
    
    return {
        "questions": questions,
        "rubric": rubric,
        "extraction_format": markers,
        "config_preview": config,
        "needs_confirmation": True
    }
```

**Example Interaction:**

```
User: "Analyze the exam structure"

Claude: [Calls analyze_and_enrich(type="structure")]
        
        "Part A: Found 9 questions
         | Original   | Proposed | Points |
         | FRÅGA 1    | Q001     | 3p     |
         | FRÅGA 3    | Q002     | 4p     |
         ...
         
         Confirm mapping?"

User: "Yes"

Claude: "Part B: Rubric analysis
         - Q001 → E1 (3 aspects)
         - Q002 → E2 (4 aspects)
         ...
         
         Confirm?"

User: "Yes"

Claude: "Part C: Extraction format
         Before: 'Skriv ditt svar här...'
         After: 'Words:'
         
         Confirm?"

User: "Yes"

Claude: "✓ exam_config.yaml created
         Ready for optional enhancements?"
```

#### Type 2: "syllabus" (Optional)

**What it does:**
- Reads syllabus from sources.yaml
- Maps learning objectives to questions
- Extracts key concepts
- Adds syllabus_mapping section to exam_config.yaml

**Implementation:**
```python
def analyze_syllabus(project_path: Path):
    """Map syllabus to questions using Claude's understanding."""
    
    # Load existing config
    config = load_exam_config(project_path / "exam_config.yaml")
    
    # Read syllabus
    syllabus_md = project_path / "01_original/syllabus.md"
    syllabus_text = syllabus_md.read_text()
    
    # For each question, use Claude to find relevant sections
    # (This happens in the MCP server using Claude's capabilities)
    mappings = {}
    for question in config["questions"]["list"]:
        mapping = map_question_to_syllabus(question, syllabus_text)
        mappings[question] = mapping
    
    # Add to config
    config["syllabus_mapping"] = mappings
    save_exam_config(project_path / "exam_config.yaml", config)
    
    return {
        "mappings": mappings,
        "needs_confirmation": True
    }
```

**Example Interaction:**

```
User: "Map to the syllabus"

Claude: [Calls analyze_and_enrich(type="syllabus")]

        "Q003 maps to:
         - '<syllabus learning goal A>'
         - '<syllabus learning goal B>'
         Concepts: <concept 1>, <concept 2>, <concept 3>

         Confirm?"
```

#### Type 3: "content" (Optional)

**What it does:**
- Reads course content from sources.yaml path
- Asks teacher which files to analyse (3-5 recommended)
- Extracts concepts from selected materials
- Maps concepts to rubric aspects
- Adds content_mapping section to exam_config.yaml

**Implementation:**
```python
def analyze_content(project_path: Path, selected_files: List[str]):
    """Map course materials to questions."""
    
    config = load_exam_config(project_path / "exam_config.yaml")
    
    # Read sources.yaml to get course_content path
    sources = load_sources_yaml(project_path / "sources.yaml")
    content_path = Path(sources["course_content"]["original_path"])
    
    # For each selected file, extract concepts
    # (This uses Claude's document understanding)
    mappings = {}
    for question in config["questions"]["list"]:
        concepts = extract_concepts_for_question(
            question, 
            selected_files, 
            content_path
        )
        mappings[question] = concepts
    
    # Add to config
    config["content_mapping"] = mappings
    save_exam_config(project_path / "exam_config.yaml", config)
    
    return {
        "mappings": mappings,
        "needs_confirmation": True
    }
```

**Output Format (all types):**
```typescript
{
  success: boolean,
  analysis_type: "structure" | "syllabus" | "content",
  results: {
    // Type-specific results
  },
  config_updated: boolean,
  needs_confirmation: boolean,
  message: string,
  next_step: string  // "analyze_and_enrich" again or "extract_answers"
}
```

---

### Tool 4: extract_answers

**Purpose:** Extract student answers using verified config (wraps `assess extract` CLI)

**MCP Tool Signature:**
```python
@server.call_tool()
async def extract_answers(
    project_path: str
) -> ToolResult
```

**Behaviour:**

1. **Read exam_config.yaml:** Load verified configuration
2. **Call `assess extract`:** Subprocess wrapper
   ```bash
   assess extract --config exam_config.yaml -o 03_answers_by_question/
   ```
3. **Parse output:** Extract statistics
4. **Update state:** Mark Phase 4 complete
5. **Return results:** Show Q-files created

**Example Interaction:**

```
User: "Extract the answers"

Claude: [Calls extract_answers]
        
        "Extracting answers...
         
         Q001: 17/18 ✓ (1 empty)
         Q002: 18/18 ✓
         Q003: 17/18 ✓ (1 empty)
         ...
         
         ✓ 9 Q-files created
         ✓ 158/162 answers (97.5%)
         
         Ready for grading with Assessment_MPC!"
```

**Output Format:**
```typescript
{
  success: boolean,
  q_files_created: number,
  total_answers: number,
  successful_extractions: number,
  empty_answers: Array<{question: string, student: string}>,
  output_dir: string,
  message: string,
  next_step: "Assessment_MPC grading workflow"
}
```

**Implementation:**
```python
# pre_assessment_mcp/tools/extract_answers.py
import subprocess
from pathlib import Path

def extract_answers_tool(project_path: str):
    """Wrap assess extract CLI command."""
    
    config_path = Path(project_path) / "exam_config.yaml"
    output_dir = Path(project_path) / "03_answers_by_question"
    
    result = subprocess.run([
        "assess", "extract",
        "--config", str(config_path),
        "--output", str(output_dir),
        "--verbose"
    ], capture_output=True, text=True)
    
    # Parse stdout for statistics
    stats = parse_extraction_output(result.stdout)
    
    # Update project_state.json
    update_project_state(
        project_path,
        phase=4,
        status="complete",
        q_files_created=stats["q_files"],
        answers_extracted=stats["successful"]
    )
    
    return ToolResult(
        success=result.returncode == 0,
        content=format_results(stats)
    )
```

---

## Error Handling

### Error Types

```python
class ErrorType(Enum):
    FILE_NOT_FOUND = "file_not_found"
    PERMISSION_DENIED = "permission_denied"
    INVALID_FORMAT = "invalid_format"
    NETWORK_ERROR = "network_error"
    CONVERSION_FAILED = "conversion_failed"
    EXTRACTION_FAILED = "extraction_failed"
    INVALID_CONFIG = "invalid_config"
    USER_CANCELLED = "user_cancelled"
```

### Error Response Format

```typescript
{
  success: false,
  error: {
    type: ErrorType,
    message: string,
    details: string,
    recoverable: boolean,
    suggested_action: string,
    phase: number
  }
}
```

### Recovery Strategies

| Error | Recovery |
|-------|----------|
| File not found | Prompt teacher for correct path |
| Permission denied | Suggest checking folder permissions |
| Network error (syllabus download) | Retry or offer local file option |
| Conversion failed | Show specific PDF that failed, offer skip |
| Extraction failed | Show missing markers, ask for manual specification |
| Invalid config | Show validation errors, ask for correction |

### Example Error Handling:

```python
try:
    result = subprocess.run(["assess", "convert", ...], check=True)
except subprocess.CalledProcessError as e:
    return ToolResult(
        success=False,
        error={
            "type": "conversion_failed",
            "message": "PDF conversion failed for 2 files",
            "details": parse_stderr(e.stderr),
            "recoverable": True,
            "suggested_action": "Continue with successful conversions or provide alternative files"
        }
    )
```

---

## Logging & Audit Trail

### Log Format

Each tool action is logged to `{project_root}/workflow_log.jsonl`:

```json
{
  "timestamp": "2025-12-25T10:15:30Z",
  "phase": 2,
  "tool": "convert_to_markdown",
  "action": "pdf_conversion",
  "input": {
    "project_path": "/Users/.../assessment_<course-code>_<subject>_<year>/"
  },
  "output": {
    "files_converted": 21,
    "success": true
  },
  "duration_seconds": 45.2
}
```

```json
{
  "timestamp": "2025-12-25T11:16:45Z",
  "phase": 3,
  "tool": "analyze_and_enrich",
  "action": "structure_analysis_confirmation",
  "input": {
    "analysis_type": "structure"
  },
  "teacher_confirmed": true,
  "confirmation_timestamp": "2025-12-25T11:16:45Z"
}
```

### Log Purposes

1. **Audit trail** - What was done, when, by whom
2. **Debugging** - Troubleshoot failed workflows
3. **Analytics** - Understand common issues
4. **GDPR** - Track data processing (future)

---

## Integration with Assessment-workflow CLI

### Direct Module Imports (Phase 3)

```python
# Phase 3: analyze_and_enrich type="structure"
# REUSES existing Python code - no reimplementation!

from assessment_framework.core.rubric_parser import RubricParser
from assessment_framework.core.patterns import QuestionDetector
from assessment_framework.core.extractors import detect_answer_markers

# Use directly
parser = RubricParser()
rubric = parser.parse_rubric(rubric_path)
```

**Modules reused:**
- `rubric_parser.py` - Rubric structure parsing
- `patterns.py` - Question pattern detection
- `extractors.py` - Extraction marker detection

**Benefit:** 60% of Phase 3 code already exists!

### Subprocess Wrapping (Phases 2 & 4)

```python
# Phase 2: convert_to_markdown
# Phase 4: extract_answers

import subprocess

result = subprocess.run([
    "assess", "convert",  # or "extract"
    *args
], capture_output=True, text=True)
```

**Commands wrapped:**
- `assess convert` - PDF → Markdown
- `assess extract` - Markdown → Q-files

**Benefit:** Leverage stable, tested CLI functionality

---

## Testing Strategy

### Unit Tests

Each tool should have tests for:

```python
# tests/test_setup_project.py
def test_setup_project_creates_folders()
def test_setup_project_copies_files()
def test_setup_project_generates_yaml()
def test_setup_project_handles_missing_paths()
def test_setup_project_handles_invalid_paths()

# tests/test_convert.py
def test_convert_wraps_cli_correctly()
def test_convert_parses_output()
def test_convert_handles_failures()

# tests/test_analyze_and_enrich.py
def test_analyze_structure_detects_questions()
def test_analyze_structure_parses_rubric()
def test_analyze_syllabus_maps_objectives()
def test_analyze_content_extracts_concepts()

# tests/test_extract.py
def test_extract_wraps_cli_correctly()
def test_extract_handles_empty_answers()
def test_extract_parses_statistics()
```

### Integration Tests

Full workflow tests:

```python
def test_complete_4_phase_workflow():
    """Test entire workflow from setup to extraction."""
    # Phase 1
    result = setup_project(...)
    assert result.success
    
    # Phase 2
    result = convert_to_markdown(...)
    assert result.success
    
    # Phase 3
    result = analyze_and_enrich(type="structure", ...)
    assert result.success
    
    # Phase 4
    result = extract_answers(...)
    assert result.success
    assert len(result.q_files_created) == 9
```

### Test Data

Located in `tests/fixtures/`:

```
tests/fixtures/
├── sample_exam.md
├── sample_rubric.md
├── sample_syllabus.md
├── sample_students/
│   ├── 10001.md
│   └── 10002.md
└── expected_outputs/
    ├── exam_config.yaml
    └── Q001_sample.md
```

**Fabricated exam data for testing:**
- The canonical worked example in `examples/` (fabricated subject, fabricated identifiers)
- Different rubric formats (aspects, mixed, unstructured)

---

## Security & Validation

### Path Validation

```python
# pre_assessment_mcp/validators/path_validator.py

def validate_path(path: str) -> bool:
    """Ensure path is safe and accessible."""
    p = Path(path).resolve()
    
    # Check exists
    if not p.exists():
        raise FileNotFoundError(f"Path not found: {path}")
    
    # Check permissions
    if not os.access(p, os.R_OK):
        raise PermissionError(f"Cannot read: {path}")
    
    # Prevent path traversal
    if ".." in str(p):
        raise ValueError("Path traversal not allowed")
    
    return True
```

### Config Validation

```python
# pre_assessment_mcp/validators/config_validator.py

def validate_exam_config(config: dict) -> bool:
    """Validate exam_config.yaml structure."""
    required_fields = [
        "exam",
        "questions",
        "rubric",
        "extraction"
    ]
    
    for field in required_fields:
        if field not in config:
            raise ValueError(f"Missing required field: {field}")
    
    # Validate question structure
    assert isinstance(config["questions"]["list"], list)
    assert config["questions"]["total"] == len(config["questions"]["list"])
    
    return True
```

---

## Progressive Enhancement

### Minimum Viable Workflow

```
Phase 1: setup_project
    ↓
Phase 2: convert_to_markdown
    ↓
Phase 3: analyze_and_enrich(type="structure")  # Required
    ↓
Phase 4: extract_answers
```

**Output:** Q-files ready for grading

### Enhanced Workflow

```
... (same as above) ...
    ↓
Phase 3: analyze_and_enrich(type="syllabus")  # Optional
    ↓
Phase 4: extract_answers
```

**Output:** Q-files + syllabus alignment

### Full Workflow

```
... (same as above) ...
    ↓
Phase 3: analyze_and_enrich(type="content")  # Optional
    ↓
Phase 4: extract_answers
```

**Output:** Q-files + syllabus + course content alignment

**Teacher chooses enhancement level based on needs.**

---

## MCP Server Configuration

### Claude Desktop Config

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pre-assessment": {
      "command": "/path/to/venv/bin/python",
      "args": [
        "-m",
        "pre_assessment_mcp.server"
      ],
      "env": {
        "PYTHONPATH": "/path/to/Pre-Assessment_MPC/src"
      }
    }
  }
}
```

### Server Entry Point

```python
# src/pre_assessment_mcp/server.py

from mcp.server import Server
from mcp.server.stdio import stdio_server

from .tools.setup_project import setup_project_tool
from .tools.convert_to_markdown import convert_to_markdown_tool
from .tools.analyze_and_enrich import analyze_and_enrich_tool
from .tools.extract_answers import extract_answers_tool

app = Server("pre-assessment")

@app.call_tool()
async def setup_project(**kwargs):
    return setup_project_tool(**kwargs)

@app.call_tool()
async def convert_to_markdown(**kwargs):
    return convert_to_markdown_tool(**kwargs)

@app.call_tool()
async def analyze_and_enrich(**kwargs):
    return analyze_and_enrich_tool(**kwargs)

@app.call_tool()
async def extract_answers(**kwargs):
    return extract_answers_tool(**kwargs)

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

---

## Performance Considerations

### Tool Execution Times

Estimated times (18 students, 9 questions):

| Tool | Duration | Bottleneck |
|------|----------|------------|
| setup_project | ~5s | File copying |
| convert_to_markdown | ~30-60s | PDF parsing |
| analyze_and_enrich (structure) | ~10-15s | Claude analysis |
| analyze_and_enrich (syllabus) | ~20-30s | Claude analysis + mapping |
| analyze_and_enrich (content) | ~60-90s | Reading course files |
| extract_answers | ~10-15s | Text extraction |

**Total minimum workflow:** ~60-90 seconds  
**Total full workflow:** ~150-200 seconds

### Optimization Strategies

1. **Parallel conversion** - Convert PDFs in parallel (future)
2. **Caching** - Cache Claude analysis results (future)
3. **Incremental analysis** - Don't re-analyse unchanged files (future)

---

## Related Documents

- [WORKFLOW-COMPREHENSIVE.md](../WORKFLOW-COMPREHENSIVE.md) - Complete workflow with examples
- [README.md](../README.md) - Project overview
- [ROADMAP.md](../ROADMAP.md) - Implementation timeline

---

## Future Enhancements

### Planned Features

1. **GDPR Compliance** (v0.2.0)
   - Consent recording
   - Data retention policies
   - Audit trail export

2. **Parallel Processing** (v0.3.0)
   - Concurrent PDF conversion
   - Batch analysis

3. **Resume Capability** (v0.4.0)
   - Detect interrupted workflows
   - Offer to resume from last checkpoint

4. **Validation Warnings** (v0.5.0)
   - Detect common rubric issues
   - Suggest improvements

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2025-12-25 | v1.0 | Initial specification for 4-phase MCP workflow |

---

## Document Status

**Version:** 1.0  
**Completeness:** ~95%  
**Ready for:** Implementation  
**Next update:** After Phase 1 tool implementation
