"""MCP server for Assessment Data workflow.

This is the ONLY file that imports from MCP SDK (per Q1 decision).
Tool functions return plain dicts - decorator auto-wraps them.
"""

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from .tools.phase1_setup import setup_project_tool
from .tools.phase1_explore import explore_directory_tool
from .tools.phase2_convert import convert_to_markdown_tool
from .tools.phase5_qfiles import phase5_create_qfiles_tool
from .tools.phase7_generate_reports import phase7_generate_reports_tool
from .tools.phase8_quantitative import phase8_quantitative_tool
from .tools.core_inspect_file import inspect_file_tool
from .tools.phase3_prepare import phase3_prepare_tool
from .tools.phase3_annotate import phase3_annotate_tool
from .tools.phase3_file_edit import phase3_file_edit_tool
from .tools.core_list_files import list_files_tool
from .validators.path_validator import validate_workspace_access
from .validators.workspace_preflight import validate_workspace_arg

import argparse
import asyncio
import sys


# Known argument names that contain file/directory paths (RFC-035)
PATH_ARG_NAMES = [
    'project_path', 'directory_path', 'file_path',
    'exam_path', 'rubric_path', 'student_answers_path',
    'course_content_path', 'methodology_folder',
    'output_base_path', 'input_dir', 'output_dir',
    'config_path',
]

# Parse --workspace CLI argument (RFC-035)
_parser = argparse.ArgumentParser(description='Assessment Data MCP Server')
_parser.add_argument('--workspace', required=True,
                     help='Workspace directory — all tools restricted to this path')
_args = _parser.parse_args()
WORKSPACE = _args.workspace

# RFC-035 §9: Pre-flight check on the workspace value before connecting.
_preflight = validate_workspace_arg(WORKSPACE)
if not _preflight['ok']:
    print(f"ERROR: {_preflight['error']}", file=sys.stderr)
    sys.exit(1)
if _preflight.get('warning'):
    print(f"WARNING: {_preflight['warning']}", file=sys.stderr)

# Create server instance
app = Server("assessment-data")


@app.list_tools()
async def list_tools() -> list[Tool]:
    """List available tools."""
    return [
        Tool(
            name="scan_source_directory",
            description="""Scan directory to identify exam, rubric, and student answer files.

FIRST STEP for new projects. After this returns, call initialize_project.

All paths must be within the configured workspace directory.
DO NOT use bash, view, ls, or Filesystem MCP - use THIS tool instead.""",
            inputSchema={
                "type": "object",
                "properties": {
                    "directory_path": {
                        "type": "string",
                        "description": "Path to directory to explore"
                    }
                },
                "required": ["directory_path"]
            }
        ),
        Tool(
            name="initialize_project",
            description="""Create project structure with folders and files.

SECOND STEP - Call AFTER scan_source_directory.
Then call convert_documents to process PDFs.

Creates folders, copies files, generates project_state.json.
Required even if markdown files already exist.""",
            inputSchema={
                "type": "object",
                "properties": {
                    "exam_path": {
                        "type": "string",
                        "description": "Path to exam file (.pdf, .docx, .txt, .md)"
                    },
                    "rubric_path": {
                        "type": "string",
                        "description": "Path to rubric file (.pdf, .md)"
                    },
                    "syllabus_source": {
                        "type": "string",
                        "description": "URL or path to syllabus file"
                    },
                    "student_answers_path": {
                        "type": "string",
                        "description": "Directory with student answer files (any format)"
                    },
                    "course_content_path": {
                        "type": "string",
                        "description": "(Optional) Directory with course materials"
                    },
                    "methodology_folder": {
                        "type": "string",
                        "description": "(Optional) Path to methodology docs folder. Copies .md files to project/methodology/. Default: methodology/ (monorepo root)"
                    },
                    "output_base_path": {
                        "type": "string",
                        "description": "Base directory for project"
                    },
                    "project_name": {
                        "type": "string",
                        "description": "Project folder name"
                    }
                },
                "required": ["exam_path", "rubric_path", "syllabus_source", "student_answers_path", "output_base_path", "project_name"]
            }
        ),
        Tool(
            name="convert_documents",
            description="""Convert PDF files to readable markdown text, or copy PDFs as-is.

THIRD STEP - Call AFTER initialize_project.

This is the ONLY way to convert PDFs. Do NOT use bash, pymupdf4llm, or Python scripts.
Converts ALL PDFs in input_dir to markdown files in output_dir.
Non-PDF files (.md, .txt) are copied as-is.

For lab reports: set skip_pdf=true to copy PDFs without converting (Claude reads PDFs directly).""",
            inputSchema={
                "type": "object",
                "properties": {
                    "input_dir": {
                        "type": "string",
                        "description": "Directory containing files to process (e.g., 01_original/)"
                    },
                    "output_dir": {
                        "type": "string",
                        "description": "Output directory for all files - PDFs converted to markdown, other files copied (e.g., 02_markdown/)"
                    },
                    "quiet": {
                        "type": "boolean",
                        "description": "Suppress progress output (default: false)"
                    },
                    "skip_pdf": {
                        "type": "boolean",
                        "description": "Copy PDFs as-is without converting to markdown (default: false). Use for lab reports where Claude reads PDFs directly."
                    }
                },
                "required": ["input_dir", "output_dir"]
            }
        ),
        Tool(
            name="extract_student_answers",
            description="""Extract student answers into Q-files (one file per question).

This is the ONLY way to create Q-files. Do NOT use bash, Python scripts, or manual extraction.

Prefers Phase 3 annotated files from 03_material/ (marker-based extraction).
Falls back to boundary matching from 02_markdown/ if no markers found.
Output: Q1_alla_elever.md, Q2_alla_elever.md, etc.""",
            inputSchema={
                "type": "object",
                "properties": {
                    "project_path": {
                        "type": "string",
                        "description": "Path to project root directory (preferred — derives config_path and output_dir automatically)"
                    },
                    "config_path": {
                        "type": "string",
                        "description": "Path to exam_config.yaml (optional if project_path given)"
                    },
                    "output_dir": {
                        "type": "string",
                        "description": "Output directory for Q-files (optional if project_path given)"
                    },
                    "force": {
                        "type": "boolean",
                        "description": "Force overwrite even if Q-files contain existing assessments (default: false)"
                    }
                },
                "required": []
            }
        ),
        Tool(
            name="generate_reports",
            description="""Generate student reports from assessed Q-files.

Modes: preview → analyze → generate (with confirmed=True).
Use mode="analyze" when free-text assessments aren't parsing correctly.
Input: 06_analytic_assessment/Q*.md → Output: 07_analytic_student/""",
            inputSchema={
                "type": "object",
                "properties": {
                    "project_path": {
                        "type": "string",
                        "description": "Path to project root directory"
                    },
                    "mode": {
                        "type": "string",
                        "enum": ["preview", "generate", "analyze"],
                        "description": "preview = summary, generate = create files, analyze = detect patterns (default: preview)"
                    },
                    "confirmed": {
                        "type": "boolean",
                        "description": "Required for generate mode - teacher has reviewed preview (default: false)"
                    },
                    "save_patterns": {
                        "type": "boolean",
                        "description": "For analyze mode: save detected patterns to exam_config.yaml (default: false)"
                    },
                    "confirmed_by": {
                        "type": "string",
                        "description": "For analyze mode with save_patterns: teacher name for audit trail"
                    },
                    "output_dir": {
                        "type": "string",
                        "description": "Output directory for reports (default: 07_analytic_student) RFC-018"
                    },
                    "force": {
                        "type": "boolean",
                        "description": "If true, overwrite existing reports (default: false)"
                    },
                    "quiet": {
                        "type": "boolean",
                        "description": "Suppress progress output (default: false)"
                    }
                },
                "required": ["project_path"]
            }
        ),
        Tool(
            name="quantitative_summary",
            description="""Generate quantitative JSON summaries from student reports.

Call AFTER generate_reports. Creates points/percentages per student.
Input: 07_analytic_student/ → Output: 08_quantitative/*.json""",
            inputSchema={
                "type": "object",
                "properties": {
                    "project_path": {
                        "type": "string",
                        "description": "Path to project root directory"
                    },
                    "student_id": {
                        "type": "string",
                        "description": "Process specific student only (default: all students)"
                    },
                    "input_dir": {
                        "type": "string",
                        "description": "Input directory for student reports (default: 07_analytic_student)"
                    },
                    "output_dir": {
                        "type": "string",
                        "description": "Output directory for JSON files (default: 08_quantitative)"
                    },
                    "dry_run": {
                        "type": "boolean",
                        "description": "If true, validate without writing files (default: false)"
                    },
                    "quiet": {
                        "type": "boolean",
                        "description": "Suppress progress output (default: false)"
                    }
                },
                "required": ["project_path"]
            }
        ),
        Tool(
            name="phase3_prepare",
            description="""Prepare student files for Phase 3 annotation (RFC-034).

Copies student markdown files from 02_markdown/student_answers/ to 03_material/student_answers/,
adds <!-- student: {id} --> header and permanent line indices (0001, 0002...) to each file.

Call AFTER Phase 2C/2D. Then run phase3_annotate to auto-insert markers.""",
            inputSchema={
                "type": "object",
                "properties": {
                    "project_path": {
                        "type": "string",
                        "description": "Path to project root directory"
                    },
                    "force": {
                        "type": "boolean",
                        "description": "Overwrite existing files in 03_material/ (default: false)"
                    },
                    "force_overwrite_annotations": {
                        "type": "boolean",
                        "description": "Allow force to overwrite files with existing Phase 3 annotations (default: false)"
                    }
                },
                "required": ["project_path"]
            }
        ),
        Tool(
            name="phase3_annotate",
            description="""Auto-annotate student files with Phase 3 markers (RFC-034).

Reads prepared files from 03_material/student_answers/, strips line indices,
runs auto-annotation using answer_boundaries from exam_config.yaml, re-indexes,
and writes back in-place.

Call AFTER phase3_prepare. Then run phase3_validate to verify.""",
            inputSchema={
                "type": "object",
                "properties": {
                    "project_path": {
                        "type": "string",
                        "description": "Path to project root directory"
                    },
                    "student_id": {
                        "type": "string",
                        "description": "Process a single student (e.g. 'stu1'), or all if omitted"
                    },
                    "force": {
                        "type": "boolean",
                        "description": "Overwrite existing markers (default: false — skip annotated files)"
                    }
                },
                "required": ["project_path"]
            }
        ),
        Tool(
            name="phase3_file_edit",
            description="""Edit Phase 3 student files: insert/remove annotation markers (RFC-034).

Use AFTER inspect_file to read the student file and understand its structure.
Insert Phase 3 markers at exact line-index positions. Line indices (0001, 0002...)
are PERMANENT — inserts/removes never change them.

Workflow: inspect_file → [understand structure] → phase3_file_edit → phase3_validate

Actions:
  insert_before_line: Insert text before the line with given index
  insert_after_line:  Insert text after the line with given index
  remove_marker:      Remove a line containing exact marker text
  insert_at_end:      Append text at end of file (for unanswered last questions)""",
            inputSchema={
                "type": "object",
                "properties": {
                    "project_path": {
                        "type": "string",
                        "description": "Path to project root directory"
                    },
                    "student_id": {
                        "type": "string",
                        "description": "Student ID (e.g. 'stu1') — targets 03_material/student_answers/{id}.md"
                    },
                    "edits": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "action": {
                                    "type": "string",
                                    "enum": ["insert_before_line", "insert_after_line", "remove_marker", "insert_at_end"],
                                    "description": "Edit action type"
                                },
                                "line_index": {
                                    "type": "string",
                                    "description": "Permanent line index (e.g. '0017'). Required for insert_before/after_line."
                                },
                                "text": {
                                    "type": "string",
                                    "description": "Text to insert. Required for insert actions."
                                },
                                "marker": {
                                    "type": "string",
                                    "description": "Exact marker text to remove. Required for remove_marker."
                                }
                            },
                            "required": ["action"]
                        },
                        "description": "List of edit operations to apply"
                    }
                },
                "required": ["project_path", "student_id", "edits"]
            }
        ),
        Tool(
            name="inspect_file",
            description="""DEBUG: Read file contents. Not for new projects - use scan_source_directory instead.""",
            inputSchema={
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Absolute path to file"
                    },
                    "encoding": {
                        "type": "string",
                        "description": "File encoding (default: utf-8)"
                    },
                    "max_lines": {
                        "type": "integer",
                        "description": "Maximum lines to return (default: 1000)"
                    },
                    "offset": {
                        "type": "integer",
                        "description": "Start from line N (default: 0)"
                    }
                },
                "required": ["file_path"]
            }
        ),
        Tool(
            name="list_files",
            description="""DEBUG: List directory contents. Not for new projects - use scan_source_directory instead.""",
            inputSchema={
                "type": "object",
                "properties": {
                    "directory_path": {
                        "type": "string",
                        "description": "Absolute path to directory"
                    },
                    "pattern": {
                        "type": "string",
                        "description": "Glob pattern filter (default: *)"
                    },
                    "recursive": {
                        "type": "boolean",
                        "description": "Include subdirectories (default: false)"
                    },
                    "include_stats": {
                        "type": "boolean",
                        "description": "Include file size and modified time (default: false)"
                    }
                },
                "required": ["directory_path"]
            }
        )
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """Handle tool calls."""
    import json

    # Strip server prefix if present (Claude Desktop may add "assessment-data:" prefix)
    if ":" in name:
        name = name.split(":")[-1]

    # RFC-035: Enforce workspace boundary for all path arguments
    for arg_name in PATH_ARG_NAMES:
        value = arguments.get(arg_name)
        if isinstance(value, str):
            is_valid, error_msg = validate_workspace_access(
                value, WORKSPACE, tool=name, arg_name=arg_name,
            )
            if not is_valid:
                raise ValueError(error_msg)

    if name == "scan_source_directory":
        result = await explore_directory_tool(**arguments)
        return [TextContent(
            type="text",
            text=json.dumps(result, indent=2)
        )]
    elif name == "initialize_project":
        result = await setup_project_tool(**arguments)
        return [TextContent(
            type="text",
            text=json.dumps(result, indent=2)
        )]
    elif name == "convert_documents":
        result = await convert_to_markdown_tool(**arguments)
        return [TextContent(
            type="text",
            text=json.dumps(result, indent=2)
        )]
    elif name == "extract_student_answers":
        result = await phase5_create_qfiles_tool(**arguments)
        return [TextContent(
            type="text",
            text=json.dumps(result, indent=2)
        )]
    elif name == "generate_reports":
        result = await phase7_generate_reports_tool(**arguments)
        return [TextContent(
            type="text",
            text=json.dumps(result, indent=2)
        )]
    elif name == "quantitative_summary":
        result = await phase8_quantitative_tool(**arguments)
        return [TextContent(
            type="text",
            text=json.dumps(result, indent=2)
        )]
    elif name == "phase3_prepare":
        result = await phase3_prepare_tool(**arguments)
        return [TextContent(
            type="text",
            text=json.dumps(result, indent=2)
        )]
    elif name == "phase3_annotate":
        result = await phase3_annotate_tool(**arguments)
        return [TextContent(
            type="text",
            text=json.dumps(result, indent=2)
        )]
    elif name == "phase3_file_edit":
        result = await phase3_file_edit_tool(**arguments)
        return [TextContent(
            type="text",
            text=json.dumps(result, indent=2)
        )]
    elif name == "inspect_file":
        result = await inspect_file_tool(**arguments)
        return [TextContent(
            type="text",
            text=json.dumps(result, indent=2)
        )]
    elif name == "list_files":
        result = await list_files_tool(**arguments)
        return [TextContent(
            type="text",
            text=json.dumps(result, indent=2)
        )]
    else:
        raise ValueError(f"Unknown tool: {name}")


async def main():
    """Run MCP server via stdio."""
    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            app.create_initialization_options()
        )


if __name__ == "__main__":
    asyncio.run(main())
