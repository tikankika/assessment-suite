"""
phase5_create_qfiles.py - Create Q-files using answer_boundaries from exam_config.yaml

This MCP tool reads answer boundary markers from exam_config.yaml and extracts
student answers directly from markdown files using text-based marker detection.

Input:
  - exam_config.yaml with answer_boundaries (from Phase 4D)
  - Student markdown files in 02_markdown/student_answers/
Output: Q-files in 05_answers_by_question/ directory (RFC-018)

v3.0 (2025-12-30): Rewritten to use answer_boundaries markers instead of pre-computed line numbers
See: Phase 4D answer_boundaries for marker format
"""

from pathlib import Path
from typing import Dict, List, Any, Tuple, Optional
from collections import defaultdict
from datetime import date
import re
from ..validators import validate_path_security
from ..constants.folders import (
    PHASE2_MARKDOWN,
    PHASE3_MATERIAL,
    PHASE5_ANSWERS,
    PHASE6_ASSESSMENT,
)
import sys
import yaml
import logging
import shutil

from assessment_data_mcp.utils.state_manager import (
    update_project_state,
    log_workflow_action,
)
from assessment_data_mcp.utils.logging_config import (
    setup_project_logging,
    log_phase_start,
    log_phase_complete,
)

logger = logging.getLogger(__name__)


def log(msg: str) -> None:
    """Print to stderr to avoid corrupting MCP JSON-RPC stdout."""
    print(msg, file=sys.stderr)


LINE_INDEX_RE = re.compile(r'^\d{4,}\s')
PHASE3_MARKER_RE = re.compile(r'^<!--\s*phase3_q\d{3}[a-z]?_(start|end)\s*-->$')
NEXT_Q_START_RE = re.compile(r'<!--\s*phase3_q\d{3}_start\s*-->')
STUDENT_HEADER_RE = re.compile(r'^<!--\s*student:\s*.+\s*-->$')
ANSWER_METADATA_RE = re.compile(
    r'^(?:(?:Ord|Words):\s*\d+|Obesvarad\.|Ej besvarad\.|Besvarad\.|Unanswered\.|Answered\.)$'
)


def _strip_line_indices(text: str) -> str:
    """Remove line index prefixes and Phase 3 marker lines from text."""
    lines = text.split('\n')
    clean = []
    for line in lines:
        stripped = LINE_INDEX_RE.sub('', line)
        trimmed = stripped.strip()
        # Skip Phase 3 marker lines
        if PHASE3_MARKER_RE.match(trimmed):
            continue
        # Skip student header
        if STUDENT_HEADER_RE.match(trimmed):
            continue
        clean.append(stripped)
    return '\n'.join(clean)


def _trim_after_metadata(text: str) -> str:
    """Trim next-question content leaked after answer metadata.

    When Phase 3 markers aren't tight, extracted content may include
    the next question's header after 'Ord: X' / 'Obesvarad.' metadata.
    Truncate at the metadata boundary if followed by a question header.
    """
    lines = text.split('\n')
    last_meta_idx = -1
    for i, line in enumerate(lines):
        if ANSWER_METADATA_RE.match(line.strip()):
            last_meta_idx = i

    if last_meta_idx >= 0 and last_meta_idx < len(lines) - 1:
        for line in lines[last_meta_idx + 1:]:
            stripped = line.strip()
            if not stripped:
                continue
            if re.match(r'^\d+\s+\S', stripped) or stripped.startswith('Enter your answer'):
                return '\n'.join(lines[:last_meta_idx + 1]).strip()
            break

    return text


SUB_MARKER_DETECT_RE = re.compile(r'<!--\s*phase3_q\d{3}([a-z])_start\s*-->')


def extract_from_phase3_markers(
    file_content: str,
    question_id: str,
    subquestions: Optional[List[str]] = None,
) -> Optional[dict]:
    """Extract answer from Phase 3 annotated file using markers.

    Args:
        file_content: Content of annotated file from 03_material/
        question_id: e.g. "Q001"
        subquestions: e.g. ["a", "b"] or None (auto-detected from markers)

    Returns:
        dict with 'content', 'word_count', 'sub_answers' (if subquestions)
        or None if markers not found
    """
    q_num = question_id.replace('Q', '').replace('q', '')  # "001"
    q_tag = f"q{q_num}"

    q_start = f"<!-- phase3_{q_tag}_start -->"
    q_end = f"<!-- phase3_{q_tag}_end -->"

    start_idx = file_content.find(q_start)
    end_idx = file_content.find(q_end)

    if start_idx < 0 or end_idx < 0:
        return None

    content_start = start_idx + len(q_start)

    # Robust boundary: if the next question's start marker appears before
    # our end marker, use it as the boundary instead. This handles the case
    # where Phase 3 clusters all end markers together after the last answer.
    for m in NEXT_Q_START_RE.finditer(file_content, content_start):
        marker_tag = m.group(0)
        if f"phase3_{q_tag}_start" not in marker_tag and m.start() < end_idx:
            end_idx = m.start()
            break

    question_block = file_content[content_start:end_idx]

    # Auto-detect sub-question markers if not provided
    if subquestions is None:
        found = SUB_MARKER_DETECT_RE.findall(question_block)
        if found:
            subquestions = sorted(set(found))

    if subquestions:
        sub_answers = {}
        for sub in subquestions:
            sub_start = f"<!-- phase3_{q_tag}{sub}_start -->"
            sub_end = f"<!-- phase3_{q_tag}{sub}_end -->"
            s_idx = question_block.find(sub_start)
            e_idx = question_block.find(sub_end)
            if s_idx >= 0 and e_idx >= 0:
                raw = question_block[s_idx + len(sub_start):e_idx]
                sub_answers[sub] = _strip_line_indices(raw).strip()
            else:
                sub_answers[sub] = ""

        full_text = '\n\n'.join(
            f"{sub}) {text}" for sub, text in sub_answers.items() if text
        )
        word_count = len(full_text.split()) if full_text.strip() else 0
        return {
            'content': full_text,
            'word_count': word_count,
            'sub_answers': sub_answers,
        }
    else:
        clean = _strip_line_indices(question_block).strip()
        clean = _trim_after_metadata(clean)
        return {
            'content': clean,
            'word_count': len(clean.split()) if clean.strip() else 0,
        }


def has_phase3_markers(file_content: str) -> bool:
    """Check if file contains Phase 3 annotation markers."""
    return '<!-- phase3_q' in file_content


def process_student_files_from_markers(
    student_files: List[Path],
    questions: List[dict],
    quiet: bool = False,
) -> Tuple[Dict[str, List[dict]], dict]:
    """Process student files using Phase 3 markers.

    Reads annotated files from 03_material/student_answers/ and extracts
    answers between Phase 3 markers.

    Args:
        student_files: Annotated student files (from 03_material/)
        questions: Questions list from exam_config.yaml
        quiet: Suppress progress output

    Returns:
        Tuple of (questions_db, stats)
    """
    questions_db: Dict[str, List[dict]] = defaultdict(list)
    stats = {
        'students_processed': 0,
        'answers_extracted': 0,
        'not_found': 0,
        'empty_answers': 0,
        'errors': [],
    }

    for student_file in student_files:
        student_id = student_file.stem

        try:
            file_content = student_file.read_text(encoding='utf-8')

            if not has_phase3_markers(file_content):
                stats['errors'].append(
                    f"{student_id}: No Phase 3 markers found — run Phase 3 annotation first"
                )
                continue

            stats['students_processed'] += 1
            extracted_this_student = 0

            for q in questions:
                q_id = q['id']

                result = extract_from_phase3_markers(
                    file_content, q_id
                )

                if result is None:
                    stats['not_found'] += 1
                    continue

                content = result['content']
                word_count = result['word_count']

                if not content.strip():
                    stats['empty_answers'] += 1
                    content = "[Inget svar]"
                    word_count = 0

                has_subs = 'sub_answers' in result and result['sub_answers']
                answer = {
                    'student_id': student_id,
                    'question_id': q_id,
                    'content': content,
                    'word_count': word_count,
                    'answer_start_type': 'sub_question' if has_subs else 'after_text',
                }

                # Add sub_answers for Q-file sub-question formatting
                if has_subs:
                    answer['sub_answers'] = result['sub_answers']

                questions_db[q_id].append(answer)
                stats['answers_extracted'] += 1
                extracted_this_student += 1

                if not quiet:
                    log(f"  {student_id} -> {q_id} ({word_count} words)")

            if extracted_this_student == 0:
                stats['errors'].append(
                    f"{student_id}: 0 answers extracted (file read but no question "
                    f"markers matched — student excluded from all Q-files)"
                )

        except Exception as e:
            stats['errors'].append(f"Student {student_id}: {str(e)}")

    return questions_db, stats


def load_exam_config(config_path: Path) -> dict:
    """
    Load exam_config.yaml with answer_boundaries.

    Args:
        config_path: Path to exam_config.yaml

    Returns:
        Parsed YAML content

    Raises:
        FileNotFoundError: If config file doesn't exist
        ValueError: If answer_boundaries is missing
    """
    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    with open(config_path, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)

    if 'answer_boundaries' not in config:
        raise ValueError(
            "exam_config.yaml missing 'answer_boundaries'. "
            "Run Phase 4D first to detect answer boundaries."
        )

    return config


def find_student_files(project_path: Path) -> List[Path]:
    """
    Find all student markdown files in 02_markdown/student_answers/.

    Args:
        project_path: Root directory of project

    Returns:
        List of paths to student markdown files
    """
    student_dir = project_path / PHASE2_MARKDOWN / "student_answers"

    if not student_dir.exists():
        raise FileNotFoundError(
            f"Student answers directory not found: {student_dir}"
        )

    student_files = sorted(student_dir.glob("*.md"))

    if not student_files:
        raise ValueError(f"No student markdown files found in {student_dir}")

    return student_files


def extract_answer_by_markers(
    file_content: str,
    question_header: str,
    start_marker: str,
    end_marker: str,
    context_lines: int = 3,
    answer_start_type: str = 'after_text',
    answer_end_type: str = 'marker',
    next_question_headers: List[str] = None
) -> Tuple[Optional[str], str, str, int]:
    """
    Extract answer from file content using text markers.

    Args:
        file_content: Full content of the student markdown file
        question_header: Question identifier (e.g., "1 Restriktionsenzym (a-d)")
        start_marker: Text that marks answer start
        end_marker: Text that marks answer end (if answer_end_type is 'marker')
        context_lines: Number of lines to extract for context
        answer_start_type: 'sub_question' (start AT marker) or 'after_text' (start AFTER marker)
        answer_end_type: 'marker' (use end_marker) or 'next_question' (end at next question)
        next_question_headers: List of headers to detect next question (for answer_end_type='next_question')

    Returns:
        Tuple of (answer_text, context_before, context_after, word_count)
        Returns (None, "", "", 0) if question not found
    """
    lines = file_content.split('\n')
    next_question_headers = next_question_headers or []

    # Find question header line
    # Strategy: First try endswith() to skip TOC entries that append "Textområde" etc.
    # If no match, fall back to startswith() which handles multi-line questions
    # where question text wraps across lines after PDF→MD conversion.
    # See: https://github.com/tikankika/Assessment_suite/issues/13
    header_line_idx = None

    # Pass 1: endswith (skips TOC entries like "1 Restriktionsenzym (a-d) Textområde")
    for i, line in enumerate(lines):
        stripped = line.rstrip()
        if stripped.endswith(question_header):
            header_line_idx = i
            break

    # Pass 2: startswith fallback (handles wrapped question text)
    if header_line_idx is None:
        for i, line in enumerate(lines):
            stripped = line.rstrip()
            if stripped.startswith(question_header):
                header_line_idx = i
                break

    if header_line_idx is None:
        return None, "", "", 0

    # Find start marker after question header
    start_line_idx = None
    for i in range(header_line_idx + 1, len(lines)):
        if start_marker and start_marker in lines[i]:
            start_line_idx = i
            break
        elif not start_marker:
            # Empty start_marker means start at first line after header
            start_line_idx = i
            break

    if start_line_idx is None:
        return None, "", "", 0

    # Determine where answer content actually starts based on answer_start_type
    if answer_start_type == 'sub_question':
        # Answer starts AT the marker line (includes sub-question like "a)")
        answer_content_start = start_line_idx
    else:
        # answer_start_type == 'after_text': Answer starts AFTER the marker line
        answer_content_start = start_line_idx + 1

    # Find end marker
    end_line_idx = None

    if answer_end_type == 'marker' and end_marker:
        # Look for the explicit end marker, OR any answer-status line. A skipped
        # question in an Inspera export ends with "Unanswered." (not the
        # configured "Answered." end_marker); without this, a skipped question
        # finds no end marker and runs on into the next answered question,
        # swallowing everything between. ANSWER_METADATA_RE matches every status
        # marker (Answered./Unanswered./Besvarad./Obesvarad./Ej besvarad. + word
        # counts), so any of them terminates the answer.
        for i in range(answer_content_start, len(lines)):
            if end_marker in lines[i] or ANSWER_METADATA_RE.match(lines[i].strip()):
                end_line_idx = i
                break

    if answer_end_type == 'next_question' or end_line_idx is None:
        # Look for next question header
        for i in range(answer_content_start, len(lines)):
            line_stripped = lines[i].rstrip()
            # Check against known next question headers
            for next_header in next_question_headers:
                if line_stripped.endswith(next_header):
                    end_line_idx = i
                    break
            if end_line_idx:
                break
            # Also check for generic question pattern (number at start)
            if re.match(r'^\d+\s+\S', lines[i]) and i > answer_content_start + 1:
                # Verify it's not just content by checking if line ends without trailing content markers
                if not any(marker in lines[i] for marker in ['Ord:', 'Words:', 'Besvarad', 'Answered']):
                    end_line_idx = i
                    break

    if end_line_idx is None:
        # Fallback: take until end of file
        end_line_idx = len(lines)

    # Extract answer
    if answer_content_start >= end_line_idx:
        return "", "", "", 0

    answer_lines = lines[answer_content_start:end_line_idx]
    answer_text = '\n'.join(answer_lines).strip()

    # Extract word count from end marker line if present
    word_count = len(answer_text.split())
    if end_line_idx < len(lines):
        end_line = lines[end_line_idx]
        # Try both Swedish and English patterns
        word_match = re.search(r'(?:Ord|Words):\s*(\d+)', end_line)
        if word_match:
            word_count = int(word_match.group(1))

    # Extract context before (question text)
    context_start = max(header_line_idx, start_line_idx - context_lines)
    context_before_lines = lines[context_start:start_line_idx + 1]
    context_before = '\n'.join(context_before_lines).strip()

    # Extract context after
    context_end = min(len(lines), end_line_idx + context_lines + 1)
    context_after_lines = lines[end_line_idx:context_end]
    context_after = '\n'.join(context_after_lines).strip()

    return answer_text, context_before, context_after, word_count


def build_question_lookup(questions: List[dict]) -> Dict[str, dict]:
    """
    Build lookup dict from questions array for Q-file metadata.

    Args:
        questions: List of question objects from exam_config.yaml

    Returns:
        Dict mapping question_id -> {title, max_points, rubric_id, question_type}
    """
    lookup = {}
    for q in questions:
        q_id = q['id']  # "Q001", "Q002", etc.
        rubric_data = q.get('rubric_data', {})
        lookup[q_id] = {
            'title': q.get('question_title') or q.get('section_title') or rubric_data.get('section_title') or q_id,
            'max_points': q.get('points') or rubric_data.get('rubric_points') or q.get('max_marks', 0),
            'rubric_id': q.get('rubric_id'),
            'question_type': q.get('question_type', 'Unknown'),
            'number': q.get('number', 0),
        }
    return lookup


def write_question_file(
    question_id: str,
    answers: List[dict],
    output_dir: Path,
    question_details: Dict[str, Any]
) -> str:
    """
    Write all student answers for one question to a Q-file.

    Format: Q1_alla_elever.md

    RFC-022: New output format with HTML comment markers and separated sub-questions.
    - PHASE5_STUDENT_START/END markers for machine parsing
    - Sub-questions separated with their own headers
    - Metadata in HTML comments for Phase 6/7 compatibility

    Args:
        question_id: Question identifier (e.g., "Q1")
        answers: List of answer dicts with student_id, content, word_count,
                 sub_question_end_marker, answer_start_type
        output_dir: Output directory
        question_details: Dict with title, max_points, rubric_id

    Returns:
        Filename of created Q-file
    """
    filename = f"{question_id}_alla_elever.md"
    filepath = output_dir / filename

    # Sort by student_id
    sorted_answers = sorted(answers, key=lambda a: a['student_id'])

    # Extract question details
    title = question_details.get('title', question_id)
    max_points = question_details.get('max_points', 0)
    rubric_id = question_details.get('rubric_id')

    with open(filepath, 'w', encoding='utf-8') as f:
        # Write YAML frontmatter
        f.write("---\n")
        f.write("ASSESSMENT-STATUS:\n")
        f.write(f'  File: "{filename}"\n')
        f.write(f'  Question: "Fråga {question_id.replace("Q", "")}: {title}"\n')

        # Include Rubric-ID if available
        if rubric_id:
            f.write(f'  Rubric-ID: "{rubric_id}"\n')
        else:
            f.write('  Rubric-ID: null\n')

        f.write(f'  Max-points: {max_points}\n')
        f.write(f'  Total-students: {len(sorted_answers)}\n')
        f.write(f'  Progress: "0/{len(sorted_answers)} (0.00%)"\n')
        f.write(f'  Date: "{date.today().isoformat()}"\n')
        f.write("---\n\n")

        # Write student answers
        for i, answer in enumerate(sorted_answers):
            student_id = answer['student_id']
            word_count = answer['word_count']
            content = answer['content']
            sub_question_end_marker = answer.get('sub_question_end_marker')
            sub_questions_text = answer.get('sub_questions_text', {})
            answer_start_type = answer.get('answer_start_type', 'after_text')

            # START marker for machine parsing
            f.write(f'<!-- PHASE5_STUDENT_START student_id="{student_id}" question_id="{question_id}" -->\n')

            # Write main header
            f.write(f"## Elev {student_id} ({word_count} ord)\n\n")

            # Check if we should split into sub-questions
            sub_answers = answer.get('sub_answers')  # From Phase 3 marker extraction
            has_sub_questions = answer_start_type == 'sub_question' or bool(sub_answers)

            if has_sub_questions:
                if sub_answers:
                    # Phase 3 marker path: sub_answers already cleanly extracted
                    sub_questions = []
                    for label, text in sub_answers.items():
                        wc = len(text.split()) if text.strip() else 0
                        sub_questions.append({
                            'label': label,
                            'content': text,
                            'word_count': wc,
                        })
                else:
                    # Boundary path: re-parse content to split sub-questions
                    sub_questions = split_sub_questions(content, sub_question_end_marker, sub_questions_text)

                # Track sub-question labels for metadata
                sub_q_labels = [sq['label'] for sq in sub_questions if sq['label']]

                for j, sq in enumerate(sub_questions):
                    if sq['label']:
                        # Write sub-question header
                        f.write(f"### {sq['label']}) \n\n")

                    # Write answer content
                    f.write("**Svar:**\n\n")
                    f.write(sq['content'])
                    f.write("\n\n")

                    # Write word count for sub-question
                    if sq['label']:
                        f.write(f"*Ord: {sq['word_count']}*\n\n")

                    # Separator between sub-questions (but not after last)
                    if j < len(sub_questions) - 1:
                        f.write("---\n\n")
            else:
                # No sub-questions - write as single block
                f.write("**Svar:**\n\n")
                f.write(content)
                f.write("\n\n")

                sub_q_labels = []

            # Metadata comment for Phase 6/7 parsing
            sub_q_str = ', '.join(sub_q_labels) if sub_q_labels else 'none'
            f.write(f'<!-- PHASE5_ANSWER\n')
            f.write(f'student_id: {student_id}\n')
            f.write(f'question_id: {question_id}\n')
            f.write(f'total_words: {word_count}\n')
            f.write(f'sub_questions: [{sub_q_str}]\n')
            f.write(f'-->\n')

            # END marker
            f.write(f'<!-- PHASE5_STUDENT_END -->\n\n')

            # Write separator between students (except after last answer)
            if i < len(sorted_answers) - 1:
                f.write("---\n\n")

    return filename


def split_sub_questions(
    content: str,
    sub_question_end_marker: Optional[str] = None,
    sub_questions_text: Optional[Dict[str, str]] = None
) -> List[Dict[str, Any]]:
    """
    Split answer content into individual sub-questions.

    Detects sub-question labels (a), b), c), etc.) and splits content accordingly.
    Uses sub_questions_text dict to remove the question text from each answer.

    Args:
        content: Full answer content (may contain multiple sub-questions)
        sub_question_end_marker: Optional marker indicating end of each sub-answer (e.g., "Ord:")
        sub_questions_text: Dict mapping label -> question text (from Phase 4D)
            e.g., {"a": "Vad är ett restriktionsenzym?", "b": "Förklara..."}

    Returns:
        List of dicts with:
        - label: "a", "b", "c", etc.
        - question_text: The question text (from sub_questions_text)
        - content: The answer text for this sub-question (without question text)
        - word_count: Word count for this sub-answer

    If no sub-questions detected, returns single item with label None.
    """
    if not content or not content.strip():
        return [{'label': None, 'question_text': None, 'content': content, 'word_count': 0}]

    sub_questions_text = sub_questions_text or {}
    lines = content.split('\n')
    sub_questions = []
    current_label = None
    current_lines = []

    # Pattern for sub-question labels: a), b), c), d), e), A), B), etc.
    sub_q_pattern = re.compile(r'^([a-zA-Z])\)')

    for line in lines:
        stripped = line.strip()

        # Check if this line starts a new sub-question
        match = sub_q_pattern.match(stripped)
        if match:
            # Save previous sub-question if any
            if current_label is not None and current_lines:
                sub_content = _process_sub_answer(
                    current_lines, current_label, sub_question_end_marker, sub_questions_text
                )
                word_count = len(sub_content.split()) if sub_content else 0
                sub_questions.append({
                    'label': current_label,
                    'question_text': sub_questions_text.get(current_label),
                    'content': sub_content,
                    'word_count': word_count,
                })

            # Start new sub-question
            current_label = match.group(1).lower()
            # Keep everything after the label on the same line
            remainder = stripped[len(match.group(0)):].strip()
            current_lines = [remainder] if remainder else []
        else:
            # Continue current sub-question
            current_lines.append(line)

    # Don't forget the last sub-question
    if current_label is not None and current_lines:
        sub_content = _process_sub_answer(
            current_lines, current_label, sub_question_end_marker, sub_questions_text
        )
        word_count = len(sub_content.split()) if sub_content else 0
        sub_questions.append({
            'label': current_label,
            'question_text': sub_questions_text.get(current_label),
            'content': sub_content,
            'word_count': word_count,
        })

    # If no sub-questions found, return the whole content
    if not sub_questions:
        return [{'label': None, 'question_text': None, 'content': content.strip(), 'word_count': len(content.split())}]

    return sub_questions


def _process_sub_answer(
    lines: List[str],
    label: str,
    sub_question_end_marker: Optional[str],
    sub_questions_text: Dict[str, str]
) -> str:
    """
    Process a sub-answer: remove question text and trailing markers.

    The sub_questions_text contains the LAST LINE of the question text
    (the line directly before the student's answer). We find this line
    and remove everything from the start up to and including it.

    Args:
        lines: Lines of content for this sub-question
        label: The sub-question label (a, b, c, etc.)
        sub_question_end_marker: Marker to remove from end (e.g., "Ord:")
        sub_questions_text: Dict mapping label -> LAST LINE of question text

    Returns:
        Clean answer content without question text or end markers
    """
    if not lines:
        return ""

    # Remove trailing word count marker if present
    # Work with lines to preserve structure
    result_lines = lines.copy()

    # Remove trailing "Ord: XX" marker from last non-empty line
    if sub_question_end_marker:
        for i in range(len(result_lines) - 1, -1, -1):
            if result_lines[i].strip():
                if sub_question_end_marker in result_lines[i]:
                    # Remove this line (it's just the word count)
                    result_lines = result_lines[:i]
                break

    # Remove question text (last line of question) from the beginning
    question_last_line = sub_questions_text.get(label)
    if question_last_line:
        # Normalize for comparison (including quote normalization)
        normalized_q = _normalize_for_match(question_last_line)

        # Find the line that matches (or contains) the question last line
        for i, line in enumerate(result_lines):
            normalized_line = _normalize_for_match(line)
            if normalized_line == normalized_q or normalized_line.endswith(normalized_q):
                # Found the question line - remove everything up to and including it
                result_lines = result_lines[i + 1:]
                break

    return '\n'.join(result_lines).strip()


def _normalize_for_match(text: str) -> str:
    """
    Normalize text for matching: collapse whitespace and normalize quotes.

    Handles Unicode curly quotes that may differ between PDF conversion
    and YAML config files.
    """
    # Collapse whitespace
    result = ' '.join(text.strip().split())

    # Normalize quotes (curly → straight) using Unicode escapes
    result = result.replace('\u201c', '"').replace('\u201d', '"')  # Double curly quotes
    result = result.replace('\u2018', "'").replace('\u2019', "'")  # Single curly quotes

    return result


def validate_answer_boundaries(answer_boundaries: dict) -> Tuple[bool, List[str]]:
    """
    Validate that answer_boundaries has required fields for each question.

    Returns:
        Tuple of (is_valid, list_of_errors)
    """
    errors = []
    required_fields = ['question_header', 'answer_start_type', 'answer_start_marker', 'answer_end_type']

    question_boundaries = answer_boundaries.get('questions', {})

    if not question_boundaries:
        errors.append("answer_boundaries.questions is empty or missing")
        return False, errors

    for q_id, q_bounds in question_boundaries.items():
        # Skip auto-graded questions
        if q_bounds.get('skip_boundary_detection') or q_bounds.get('auto_graded'):
            continue

        for field in required_fields:
            if field not in q_bounds:
                errors.append(f"{q_id}: missing '{field}'")

        # If answer_end_type is 'marker', answer_end_marker is required
        if q_bounds.get('answer_end_type') == 'marker' and not q_bounds.get('answer_end_marker'):
            errors.append(f"{q_id}: answer_end_type is 'marker' but answer_end_marker is missing")

    return len(errors) == 0, errors


def process_student_files(
    student_files: List[Path],
    answer_boundaries: dict,
    quiet: bool = False
) -> Tuple[Dict[str, List[dict]], dict]:
    """
    Process all student files and extract answers using boundary markers.

    Args:
        student_files: List of paths to student markdown files
        answer_boundaries: answer_boundaries section from exam_config.yaml
        quiet: Suppress progress output

    Returns:
        Tuple of:
        - Dict mapping question_id -> List[answer dicts]
        - Statistics dict with processing summary

    Raises:
        ValueError: If answer_boundaries is missing required fields (run Phase 4D first)
    """
    # Validate answer_boundaries format
    is_valid, validation_errors = validate_answer_boundaries(answer_boundaries)
    if not is_valid:
        error_list = '\n  - '.join(validation_errors)
        raise ValueError(
            f"exam_config.yaml has invalid answer_boundaries format.\n"
            f"Missing fields:\n  - {error_list}\n\n"
            f"Please run Phase 4D again to analyze and save correct answer boundaries.\n"
            f"Required fields per question: question_header, answer_start_type, "
            f"answer_start_marker, answer_end_type (and answer_end_marker if type is 'marker')"
        )

    questions_db: Dict[str, List[dict]] = defaultdict(list)
    stats = {
        'students_processed': 0,
        'answers_extracted': 0,
        'not_found': 0,
        'empty_answers': 0,
        'errors': [],
    }

    # Get global defaults
    global_config = answer_boundaries.get('global', {})
    global_sub_end = global_config.get('default_sub_question_end')
    global_answer_end = global_config.get('default_answer_end')

    question_boundaries = answer_boundaries.get('questions', {})

    # Build list of all question headers for next_question detection
    all_question_headers = [
        q_bounds.get('question_header', '')
        for q_bounds in question_boundaries.values()
        if q_bounds.get('question_header')
    ]

    for student_file in student_files:
        student_id = student_file.stem  # Filename without .md extension

        try:
            with open(student_file, 'r', encoding='utf-8') as f:
                file_content = f.read()

            stats['students_processed'] += 1
            extracted_this_student = 0

            # Process each question
            for q_id, q_bounds in question_boundaries.items():
                # Skip if skip flag set
                if q_bounds.get('skip_boundary_detection') or q_bounds.get('auto_graded'):
                    continue

                question_header = q_bounds['question_header']
                answer_start_type = q_bounds['answer_start_type']
                answer_start_marker = q_bounds['answer_start_marker']
                answer_end_type = q_bounds['answer_end_type']
                answer_end_marker = q_bounds.get('answer_end_marker', global_answer_end or '')

                # Extract answer
                answer_text, context_before, context_after, word_count = extract_answer_by_markers(
                    file_content,
                    question_header,
                    answer_start_marker,
                    answer_end_marker,
                    answer_start_type=answer_start_type,
                    answer_end_type=answer_end_type,
                    next_question_headers=all_question_headers
                )

                if answer_text is None:
                    stats['not_found'] += 1
                    continue

                if not answer_text.strip():
                    stats['empty_answers'] += 1
                    # Still record empty answers for completeness
                    answer_text = "[Inget svar]"
                    word_count = 0

                # Get sub_question_end_marker and sub_questions for sub-question splitting
                sub_question_end_marker = q_bounds.get('sub_question_end_marker', global_sub_end)
                sub_questions_text = q_bounds.get('sub_questions', {})  # label -> question text

                answer = {
                    'student_id': student_id,
                    'question_id': q_id,
                    'content': answer_text,
                    'word_count': word_count,
                    'context_before': context_before,
                    'context_after': context_after,
                    'sub_question_end_marker': sub_question_end_marker,
                    'sub_questions_text': sub_questions_text,  # For removing question text
                    'answer_start_type': answer_start_type,
                }

                questions_db[q_id].append(answer)
                stats['answers_extracted'] += 1
                extracted_this_student += 1

                if not quiet:
                    log(f"  {student_id} -> {q_id} ({word_count} words)")

            if extracted_this_student == 0:
                stats['errors'].append(
                    f"{student_id}: 0 answers extracted (file read but no question "
                    f"boundaries matched — student excluded from all Q-files)"
                )

        except Exception as e:
            stats['errors'].append(f"Student {student_id}: {str(e)}")

    return questions_db, stats


def check_existing_qfiles(output_dir: Path) -> Tuple[List[str], List[str]]:
    """
    Check for existing Q-files and whether they contain assessments.

    BUGFIX 2026-01-08: Warn before overwriting Q-files with existing assessments.

    Args:
        output_dir: Directory to check for Q-files

    Returns:
        Tuple of (existing_qfiles, qfiles_with_assessments)
    """
    existing_qfiles = []
    qfiles_with_assessments = []

    if not output_dir.exists():
        return [], []

    for qfile in output_dir.glob("Q*_alla_elever.md"):
        existing_qfiles.append(qfile.name)

        # Check if file contains BEDÖMNING
        try:
            content = qfile.read_text(encoding='utf-8')
            if '### BEDÖMNING:' in content or '### ANALYTIC ASSESSMENT:' in content:
                qfiles_with_assessments.append(qfile.name)
        except Exception:
            pass

    return existing_qfiles, qfiles_with_assessments


async def phase5_create_qfiles_tool(
    config_path: Optional[str] = None,
    output_dir: Optional[str] = None,
    project_path: Optional[str] = None,
    quiet: bool = False,
    force: bool = False
) -> dict:
    """
    Create Q-files from exam_config.yaml answer_boundaries.

    Reads answer boundary markers and extracts student answers directly
    from markdown files, generating Q-files for manual assessment.

    BUGFIX 2026-01-08: Added check for existing Q-files with assessments.
    Will NOT overwrite unless force=True.

    Args:
        config_path: Path to exam_config.yaml (optional if project_path given)
        output_dir: Output directory for Q-files (optional, default: 05_answers_by_question/)
        project_path: Path to project root (can derive config_path and output_dir)
        quiet: Suppress progress output (default: False)
        force: Force overwrite even if assessments exist (default: False)

    Returns:
        {
            "success": bool,
            "qfiles_created": list[str],
            "output_directory": str,
            "students_processed": int,
            "answers_extracted": int,
            "not_found": int,
            "error": str | None,
            "warning": str | None  # NEW: Warning about existing assessments
        }
    """
    try:
        # Security: validate paths before any file operations
        for check_path in [p for p in [project_path, config_path, output_dir] if p]:
            is_safe, security_error = validate_path_security(check_path)
            if not is_safe:
                return {"success": False, "error": f"Security: {security_error}"}

        # Derive paths from project_path if not provided
        if project_path:
            project_root = Path(project_path).resolve()
            if not config_path:
                config_path = str(project_root / "exam_config.yaml")
            if not output_dir:
                output_dir = str(project_root / PHASE5_ANSWERS)

        # Validate we have required paths
        if not config_path:
            return {
                "success": False,
                "error": "Missing config_path. Provide config_path or project_path.",
                "hint": "Example: project_path='/path/to/project' or config_path='/path/to/exam_config.yaml'"
            }
        if not output_dir:
            return {
                "success": False,
                "error": "Missing output_dir. Provide output_dir or project_path.",
                "hint": "Example: project_path='/path/to/project' or output_dir='/path/to/05_answers_by_question'"
            }

        config_path_resolved = Path(config_path).resolve()
        output_path = Path(output_dir).resolve()

        # Determine project path (directory containing exam_config.yaml)
        project_path = config_path_resolved.parent

        # Setup project-specific logging
        if project_path.exists():
            setup_project_logging(project_path)
            log_phase_start(5, "phase5_qfiles", config=config_path_resolved.name)

        if not quiet:
            log("Phase 5: Creating Q-files from answer_boundaries")
            log("=" * 60)
            log(f"Config: {config_path_resolved}")
            log(f"Output: {output_path}")
            log("")

        # BUGFIX 2026-01-08: Check for existing Q-files with assessments
        existing_qfiles, qfiles_with_assessments = check_existing_qfiles(output_path)

        if qfiles_with_assessments and not force:
            warning_msg = (
                f"WARNING: {len(qfiles_with_assessments)} Q-file(s) already contain BEDÖMNING! "
                f"Regenerating will OVERWRITE existing assessments. "
                f"Files affected: {', '.join(qfiles_with_assessments[:5])}"
            )
            if len(qfiles_with_assessments) > 5:
                warning_msg += f" ... and {len(qfiles_with_assessments) - 5} more"
            warning_msg += ". Set force=True to proceed anyway."

            log(f"\n⚠️  {warning_msg}\n")

            return {
                "success": False,
                "phase": 5,
                "phase_name": "Create Q-files",
                "qfiles_created": [],
                "output_directory": str(output_path),
                "students_processed": 0,
                "answers_extracted": 0,
                "not_found": 0,
                "error": None,
                "warning": warning_msg,
                "existing_qfiles": existing_qfiles,
                "qfiles_with_assessments": qfiles_with_assessments,
                "suggestion": "Use force=True to overwrite, or backup existing files first."
            }

        if existing_qfiles and not quiet:
            log(f"Note: {len(existing_qfiles)} existing Q-files will be overwritten.")
            if qfiles_with_assessments:
                log(f"⚠️  {len(qfiles_with_assessments)} of these contain assessments (force=True used)")
            log("")

        # 1. Load exam_config.yaml
        if not quiet:
            log("Loading exam configuration...")

        config = load_exam_config(config_path_resolved)

        exam_info = config.get('exam', {})
        exam_name = exam_info.get('exam_name', 'Unknown')
        questions = config.get('questions', [])
        answer_boundaries = config.get('answer_boundaries', {})

        if not quiet:
            log(f"  Exam: {exam_name}")
            log(f"  Questions in config: {len(questions)}")
            log(f"  Answer boundaries: {len(answer_boundaries.get('questions', {}))} questions")
            log("")

        # 2. Find student files — prefer 03_material/ (annotated) over 02_markdown/
        if not quiet:
            log("Finding student files...")

        material_dir = project_path / PHASE3_MATERIAL / "student_answers"
        use_markers = False

        if material_dir.exists():
            material_files = sorted(material_dir.glob("*.md"))
            if material_files:
                # Check if first file has Phase 3 markers
                sample = material_files[0].read_text(encoding='utf-8')
                if has_phase3_markers(sample):
                    use_markers = True
                    student_files = material_files
                    if not quiet:
                        log(f"  Found {len(material_files)} annotated files in 03_material/ (Phase 3 markers)")

        if not use_markers:
            student_files = find_student_files(project_path)
            if not quiet:
                log(f"  Found {len(student_files)} student files in 02_markdown/")
                log("  WARNING: No Phase 3 markers found — using boundary matching (less reliable)")

        if not quiet:
            log("")

        # 3. Build question lookup
        question_lookup = build_question_lookup(questions)

        # 4. Process student answers
        if not quiet:
            log("Extracting student answers...")
            log("-" * 60)

        if use_markers:
            questions_db, stats = process_student_files_from_markers(
                student_files,
                questions,
                quiet,
            )
        else:
            questions_db, stats = process_student_files(
                student_files,
                answer_boundaries,
                quiet,
            )

        if not quiet:
            log("")
            log(f"  Extracted {stats['answers_extracted']} answers")
            if stats['not_found'] > 0:
                log(f"  Not found: {stats['not_found']} (question not in student file)")
            if stats['empty_answers'] > 0:
                log(f"  Empty answers: {stats['empty_answers']}")
            log("")

        # Sanity check: expected vs actual extraction counts
        expected_questions = len([
            q for q in questions
            if not answer_boundaries.get('questions', {}).get(q['id'], {}).get('auto_graded')
        ])
        expected_total = stats['students_processed'] * expected_questions
        actual_total = stats['answers_extracted']
        coverage_warnings = []

        if expected_total > 0 and actual_total < expected_total:
            missing = expected_total - actual_total
            coverage_warnings.append(
                f"Coverage gap: {actual_total}/{expected_total} answers extracted "
                f"({missing} missing from {stats['students_processed']} students × "
                f"{expected_questions} questions)"
            )
            if not quiet:
                log(f"  WARNING: {coverage_warnings[0]}")

        # Per-question student count check
        for q_id, answers in questions_db.items():
            if len(answers) < stats['students_processed']:
                gap = stats['students_processed'] - len(answers)
                coverage_warnings.append(
                    f"{q_id}: {len(answers)}/{stats['students_processed']} students ({gap} missing)"
                )

        # Check if any answers were extracted
        if not questions_db:
            return {
                "success": False,
                "phase": 5,
                "phase_name": "Create Q-files",
                "qfiles_created": [],
                "output_directory": str(output_path),
                "students_processed": stats['students_processed'],
                "answers_extracted": 0,
                "not_found": stats['not_found'],
                "error": "No answers were extracted. Check answer_boundaries in exam_config.yaml."
            }

        # 5. Create output directory
        output_path.mkdir(parents=True, exist_ok=True)

        # 6. Write Q-files
        if not quiet:
            log("Writing Q-files...")
            log("-" * 60)

        qfiles_created = []

        for question_id in sorted(questions_db.keys()):
            answers = questions_db[question_id]
            q_details = question_lookup.get(question_id, {})

            filename = write_question_file(
                question_id=question_id,
                answers=answers,
                output_dir=output_path,
                question_details=q_details
            )

            qfiles_created.append(filename)

            if not quiet:
                rubric_id = q_details.get('rubric_id')
                rubric_info = f" [Rubric: {rubric_id}]" if rubric_id else ""
                log(f"  {filename} ({len(answers)} students){rubric_info}")

        # 7. Copy Q-files to 06_analytic_assessment/ for assessment work
        assessment_dir = project_path / PHASE6_ASSESSMENT
        assessment_dir.mkdir(parents=True, exist_ok=True)

        if not quiet:
            log("")
            log("Copying Q-files to assessment directory...")
            log(f"  Source: {output_path}")
            log(f"  Target: {assessment_dir}")

        copied_files = []
        for qfile in qfiles_created:
            src = output_path / qfile
            dst = assessment_dir / qfile
            shutil.copy2(src, dst)
            copied_files.append(qfile)

        if not quiet:
            log(f"  Copied {len(copied_files)} files")

        # 8. Summary
        if not quiet:
            log("")
            log("=" * 60)
            log("Phase 5 complete!")
            log("")
            log(f"  Students processed: {stats['students_processed']}")
            log(f"  Answers extracted: {stats['answers_extracted']}")
            log(f"  Q-files created: {len(qfiles_created)}")
            log(f"  Output: {output_path}")

            if stats['errors']:
                log("")
                log("Warnings:")
                for error in stats['errors'][:5]:
                    log(f"  - {error}")
                if len(stats['errors']) > 5:
                    log(f"  ... and {len(stats['errors']) - 5} more")

        # 8. Log to project state and workflow log
        try:
            update_project_state(
                project_path,
                phase=5,
                status="complete",
                phase_name="5_qfiles",
                qfiles_created=len(qfiles_created),
                students_processed=stats['students_processed'],
                answers_extracted=stats['answers_extracted']
            )

            log_workflow_action(
                project_path,
                phase=5,
                tool="phase5_qfiles",
                action="qfile_creation",
                input_data={
                    "config_path": str(config_path),
                    "output_dir": str(output_dir),
                },
                output_data={
                    "success": True,
                    "qfiles_created": qfiles_created,
                    "students_processed": stats['students_processed'],
                    "answers_extracted": stats['answers_extracted'],
                }
            )
        except Exception as e:
            log(f"Warning: Failed to update project state: {e}")

        return {
            "success": True,
            "phase": 5,
            "phase_name": "Create Q-files",
            "qfiles_created": qfiles_created,
            "source_directory": str(output_path),
            "assessment_directory": str(assessment_dir),
            "students_processed": stats['students_processed'],
            "answers_extracted": stats['answers_extracted'],
            "not_found": stats['not_found'],
            "empty_answers": stats['empty_answers'],
            "coverage_warnings": coverage_warnings if coverage_warnings else None,
            "error": None,
            "next_phase": {
                "number": 6,
                "name": "Manual Assessment",
                "instruction": f"Q-files ready in {assessment_dir}",
                "note": f"{PHASE5_ANSWERS}/ is master copy, {PHASE6_ASSESSMENT}/ is for grading"
            }
        }

    except FileNotFoundError as e:
        return {
            "success": False,
            "phase": 5,
            "phase_name": "Create Q-files",
            "qfiles_created": [],
            "output_directory": str(output_dir),
            "students_processed": 0,
            "answers_extracted": 0,
            "not_found": 0,
            "error": str(e)
        }
    except ValueError as e:
        return {
            "success": False,
            "phase": 5,
            "phase_name": "Create Q-files",
            "qfiles_created": [],
            "output_directory": str(output_dir),
            "students_processed": 0,
            "answers_extracted": 0,
            "not_found": 0,
            "error": str(e)
        }
    except Exception as e:
        return {
            "success": False,
            "phase": 5,
            "phase_name": "Create Q-files",
            "qfiles_created": [],
            "output_directory": str(output_dir),
            "students_processed": 0,
            "answers_extracted": 0,
            "not_found": 0,
            "error": f"Unexpected error: {str(e)}"
        }
