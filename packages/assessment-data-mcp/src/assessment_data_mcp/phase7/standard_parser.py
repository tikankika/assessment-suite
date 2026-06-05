"""
Standard Parser - Parse Q-files with standard Phase 6 format.

This module handles the "happy path" where Q-files follow the exact
format produced by Phase 6 assessment_writer. For non-standard formats,
use intelligent_detector or config_parser.

Standard Format Patterns:
- Student header: ## Elev {id} ({wordCount} ord)
- Assessment header: ### ANALYTIC ASSESSMENT: (or ### BEDÖMNING:)
- Aspect line: **{name}:** {symbol} **{points}p** - {comment}
- Total: **TOTAL: {totalPoints}/{maxPoints}p**
- Next step: **→ Next step:** {feedback}
- Separator: ---

See RFC-001 for full specification.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Tuple, Union

from ..constants.patterns import PHASE6_V2_METADATA, PHASE6_LEGACY_METADATA, NEXT_STEP_LINE


# Standard format patterns (hardcoded from Phase 6 output)
PATTERNS = {
    # Student header: "## Elev <id> (47 ord)"
    # Also supports IDs with underscores/hyphens: "## Elev <id>_<id> (47 ord)"
    # Pattern [^\s(]+ matches any character except whitespace and opening parenthesis
    'student_header': re.compile(r'^## Elev ([^\s(]+) \((\d+) ord\)'),

    # Assessment section header (supports both Swedish and English)
    'assessment_start': re.compile(r'^### (ANALYTIC ASSESSMENT|BEDÖMNING):'),

    # Aspect score line: "**<aspect-id> (<name>):** <symbol> **<P>p** - <comment>"
    # Handles various number formats: 2p, 2.0p, 2,5p
    'aspect_line': re.compile(
        r'^\*\*(.+?):\*\*\s*'           # **AspectName:**
        r'([✓✗⚠\-]+)\s*'                # Quality symbol (✓✓✓, ✓✓, ✓, ⚠, ✗, -)
        r'\*\*([\d.,]+)p\*\*'           # **2.0p** or **2,5p**
        r'\s*-\s*(.+)$'                 # - Comment
    ),

    # Total points line: "**TOTAL: 2.5/5p**" or "**TOTALPOÄNG: 2.5/5p**" or "**BEDÖMNING: 1/2p**"
    # Uses non-capturing group (?:...) to keep group indices unchanged
    'total_line': re.compile(r'^\*\*(?:TOTAL|TOTALPOÄNG|BEDÖMNING):\s*([\d.,]+)/([\d.,]+)p\*\*'),

    # Next step line: "**→ Next step:** feedback text"
    # Also supports Swedish "**→ Nästa steg:**"
    # Note: NEXT_STEP_LINE (shared) captures 1 group; this local variant captures 2
    'next_step': re.compile(r'^\*\*→\s*(Next step|Nästa steg):\*\*\s*(.+)$'),

    # Optional comment line: "**Comment:** general comment"
    # Also supports Swedish "**Kommentar:**"
    'comment_line': re.compile(r'^\*\*(Comment|Kommentar):\*\*\s*(.+)$'),

    # Section separator
    'separator': re.compile(r'^---\s*$'),

    # RFC-021: PHASE6_ASSESSMENT v2 format with START/END markers
    # Format: <!-- PHASE6_ASSESSMENT_START student_id="..." -->
    'phase6_v2_start': re.compile(
        r'<!--\s*PHASE6_ASSESSMENT_START\s+student_id="([^"]+)"\s*-->'
    ),
    'phase6_v2_end': re.compile(
        r'<!--\s*PHASE6_ASSESSMENT_END\s*-->'
    ),
    # v2 metadata block — shared pattern (RFC-029 §3.5)
    # Groups: 1=student_id, 2=total_points, 3=max_points, 4=assessed_by, 5=assessed_at
    'phase6_v2_metadata': PHASE6_V2_METADATA,

    # Legacy PHASE6_ASSESSMENT metadata block (v1) — shared pattern (RFC-029 §3.5)
    # Groups: 1=student_id, 2=total_points, 3=max_points
    'phase6_metadata': PHASE6_LEGACY_METADATA,
}


@dataclass
class AspectScore:
    """Score for a single aspect in an assessment."""
    name: str           # Aspect label, e.g. format <aspect-id> (<aspect-name>)
    symbol: str         # Quality indicator: ✓✓✓, ✓✓, ✓, ⚠, ✗, -
    points: float       # Points awarded
    comment: str        # Brief explanation


@dataclass
class QuestionAssessment:
    """Assessment for a single question for a student."""
    question_id: str              # e.g., "Q6" (from filename)
    aspects: list[AspectScore] = field(default_factory=list)
    total_points: Optional[float] = None  # None = qualitative (no points)
    max_points: Optional[float] = None    # None = qualitative (no points)
    next_step: str = ""
    comment: Optional[str] = None
    raw_text: str = ""            # Original assessment text
    # Phase 7 enhancement: include context for qualitative analysis
    question_context: str = ""    # Question text from <details>Kontext före svaret</details>
    answer_text: str = ""         # Student's answer

    @property
    def has_points(self) -> bool:
        """Check if this assessment has numeric points."""
        return self.total_points is not None


@dataclass
class StudentAssessment:
    """Complete assessment data for a single student from a Q-file."""
    student_id: str
    word_count: int
    answer_text: str
    question_context: str = ""    # Question text from <details>Kontext före svaret</details>
    assessment: Optional[QuestionAssessment] = None
    line_start: int = 0           # Line number where student section starts
    line_end: int = 0             # Line number where student section ends


@dataclass
class ParseResult:
    """Result of parsing a Q-file."""
    question_id: str              # Extracted from filename (e.g., "Q6")
    students: list[StudentAssessment] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


class StandardParser:
    """
    Parser for standard Phase 6 Q-file format.

    Usage:
        parser = StandardParser()
        result = parser.parse_file("/path/to/Q<N>_<title>.md")

        for student in result.students:
            print(f"{student.student_id}: {student.assessment.total_points}p")
    """

    def __init__(self, custom_patterns: Optional[dict] = None) -> None:
        """
        Initialize the parser.

        Args:
            custom_patterns: Optional dict to override default patterns.
                             Keys: 'total_line', 'aspect_line', etc.
        """
        self.patterns = PATTERNS.copy()
        if custom_patterns:
            self.patterns.update(custom_patterns)

    def parse_file(self, file_path: str | Path) -> ParseResult:
        """
        Parse a Q-file and extract all student assessments.

        Args:
            file_path: Path to the Q-file

        Returns:
            ParseResult with all student assessments
        """
        file_path = Path(file_path)

        # Extract question ID from filename (e.g., "Q<N>_<title>.md" -> "Q<N>")
        question_id = self._extract_question_id(file_path.name)

        result = ParseResult(question_id=question_id)

        try:
            content = file_path.read_text(encoding='utf-8')
        except Exception as e:
            result.errors.append(f"Failed to read file: {e}")
            return result

        lines = content.split('\n')

        # Find all student sections
        student_indices = self._find_student_sections(lines)

        if not student_indices:
            result.warnings.append("No students found in file")
            return result

        # Parse each student section
        for i, (start_idx, student_match) in enumerate(student_indices):
            # Determine end of section (next student or EOF)
            if i + 1 < len(student_indices):
                end_idx = student_indices[i + 1][0]
            else:
                end_idx = len(lines)

            student = self._parse_student_section(
                lines[start_idx:end_idx],
                student_match,
                question_id,
                start_idx,
                end_idx
            )

            if student:
                result.students.append(student)
            else:
                result.warnings.append(f"Failed to parse student at line {start_idx + 1}")

        return result

    def parse_content(self, content: str, question_id: str = "unknown") -> ParseResult:
        """
        Parse Q-file content from a string.

        Args:
            content: File content as string
            question_id: Question identifier

        Returns:
            ParseResult with all student assessments
        """
        result = ParseResult(question_id=question_id)
        lines = content.split('\n')

        student_indices = self._find_student_sections(lines)

        if not student_indices:
            result.warnings.append("No students found in content")
            return result

        for i, (start_idx, student_match) in enumerate(student_indices):
            if i + 1 < len(student_indices):
                end_idx = student_indices[i + 1][0]
            else:
                end_idx = len(lines)

            student = self._parse_student_section(
                lines[start_idx:end_idx],
                student_match,
                question_id,
                start_idx,
                end_idx
            )

            if student:
                result.students.append(student)

        return result

    def _extract_question_id(self, filename: str) -> str:
        """Extract question ID from filename (e.g., 'Q<N>_<title>.md' -> 'Q<N>')."""
        # Try pattern like Q6_Something.md or Q6.md
        match = re.match(r'^(Q\d+[a-z]?)', filename, re.IGNORECASE)
        if match:
            return match.group(1).upper()

        # Try to extract just the number
        match = re.search(r'(\d+)', filename)
        if match:
            return f"Q{match.group(1)}"

        return "Q?"

    def _find_student_sections(self, lines: list[str]) -> list[tuple[int, re.Match]]:
        """Find all student header positions."""
        sections = []
        for i, line in enumerate(lines):
            match = self.patterns['student_header'].match(line)
            if match:
                sections.append((i, match))
        return sections

    def _parse_student_section(
        self,
        section_lines: list[str],
        header_match: re.Match,
        question_id: str,
        start_idx: int,
        end_idx: int
    ) -> Optional[StudentAssessment]:
        """Parse a single student section."""
        student_id = header_match.group(1)
        word_count = int(header_match.group(2))

        student = StudentAssessment(
            student_id=student_id,
            word_count=word_count,
            answer_text="",
            question_context="",
            line_start=start_idx,
            line_end=end_idx
        )

        # Find assessment section start
        assessment_start = None
        for i, line in enumerate(section_lines):
            if self.patterns['assessment_start'].match(line):
                assessment_start = i
                break

        if assessment_start is None:
            # No assessment yet - extract answer and context
            student.answer_text, student.question_context = self._extract_answer_and_context(
                section_lines[1:]
            )
            return student

        # Extract answer text AND question context (between header and assessment)
        student.answer_text, student.question_context = self._extract_answer_and_context(
            section_lines[1:assessment_start]
        )

        # Parse assessment section
        assessment_lines = section_lines[assessment_start:]
        student.assessment = self._parse_assessment(
            assessment_lines, question_id
        )

        return student

    def _extract_answer_and_context(self, lines: list[str]) -> Tuple[str, str]:
        """
        Extract student answer text AND question context.

        Returns:
            Tuple of (answer_text, question_context)
        """
        answer_lines = []
        question_context_lines = []
        in_details = False
        in_question_context = False
        in_code_block = False

        for line in lines:
            stripped = line.strip()

            # Track <details> sections
            if '<details>' in line:
                in_details = True
                # Check if this is "Kontext före svaret"
                continue
            if '<summary>Kontext före svaret</summary>' in line:
                in_question_context = True
                continue
            if '<summary>Kontext efter svaret</summary>' in line:
                in_question_context = False
                continue
            if '</details>' in line:
                in_details = False
                in_question_context = False
                in_code_block = False
                continue

            # Track code blocks inside details
            if in_details and stripped == '```':
                in_code_block = not in_code_block
                continue

            # Capture question context (inside "Kontext före svaret")
            if in_question_context and in_code_block:
                question_context_lines.append(line)
                continue

            # Skip other details content
            if in_details:
                continue

            # Skip separator lines
            if self.patterns['separator'].match(line):
                continue

            # Everything else is answer text
            answer_lines.append(line)

        answer_text = '\n'.join(answer_lines).strip()
        question_context = '\n'.join(question_context_lines).strip()

        # Clean up answer_text: remove "**Svar:**" prefix if present
        if answer_text.startswith('**Svar:**'):
            answer_text = answer_text[len('**Svar:**'):].strip()

        return answer_text, question_context

    def _parse_assessment(
        self,
        lines: list[str],
        question_id: str,
        config_patterns: list = None
    ) -> QuestionAssessment:
        """Parse assessment section.

        RFC-021 Priority order for extracting points:
        1. PHASE6_ASSESSMENT v2 metadata block (format_version: 2)
        2. Legacy PHASE6_ASSESSMENT metadata block (v1)
        3. Standard **TOTAL: X/Yp** pattern
        4. Config patterns from exam_config.yaml (teacher-confirmed)
        5. Aspect lines (summed)

        Args:
            lines: Assessment section lines
            question_id: Question ID
            config_patterns: Optional list of TotalPattern from exam_config.yaml
        """
        assessment = QuestionAssessment(question_id=question_id)
        raw_text = '\n'.join(lines)
        assessment.raw_text = raw_text

        # PRIORITY 1: Try PHASE6_ASSESSMENT v2 metadata block first (most reliable)
        v2_match = self.patterns['phase6_v2_metadata'].search(raw_text)
        if v2_match:
            # Extract from v2 machine-readable metadata
            student_id = v2_match.group(1)
            total_str = v2_match.group(2)
            max_str = v2_match.group(3)

            # Handle "null" values for qualitative assessments
            if total_str.lower() != 'null':
                assessment.total_points = float(total_str.replace(',', '.'))
            if max_str.lower() != 'null':
                assessment.max_points = float(max_str.replace(',', '.'))
            # Continue parsing for aspects, next_step, etc.
        else:
            # PRIORITY 2: Try legacy PHASE6_ASSESSMENT metadata block (v1)
            metadata_match = self.patterns['phase6_metadata'].search(raw_text)
            if metadata_match:
                # Extract from machine-readable metadata
                total_str = metadata_match.group(2).replace(',', '.')
                max_str = metadata_match.group(3).replace(',', '.')
                assessment.total_points = float(total_str)
                if max_str != '?':
                    assessment.max_points = float(max_str)
                # Continue parsing for aspects, next_step, etc.

        for line in lines:
            # Try aspect line
            aspect_match = self.patterns['aspect_line'].match(line)
            if aspect_match:
                points_str = aspect_match.group(3).replace(',', '.')
                assessment.aspects.append(AspectScore(
                    name=aspect_match.group(1),
                    symbol=aspect_match.group(2),
                    points=float(points_str),
                    comment=aspect_match.group(4)
                ))
                continue

            # PRIORITY 2: Try total line (only if not already set by metadata)
            if assessment.total_points is None:
                total_match = self.patterns['total_line'].match(line)
                if total_match:
                    assessment.total_points = float(
                        total_match.group(1).replace(',', '.')
                    )
                    assessment.max_points = float(
                        total_match.group(2).replace(',', '.')
                    )
                    continue

            # Try next step line
            next_step_match = self.patterns['next_step'].match(line)
            if next_step_match:
                assessment.next_step = next_step_match.group(2)
                continue

            # Try comment line
            comment_match = self.patterns['comment_line'].match(line)
            if comment_match:
                assessment.comment = comment_match.group(2)
                continue

        # PRIORITY 3: Try config patterns if still no points found
        if assessment.total_points is None and config_patterns:
            for pattern in config_patterns:
                extracted = pattern.extract(raw_text)
                if extracted:
                    assessment.total_points = extracted[0]
                    assessment.max_points = extracted[1]
                    break

        # RFC-021: Points are optional - qualitative assessments work with None
        return assessment

    def validate_format(self, content: str) -> tuple[bool, list[str]]:
        """
        Quick validation to check if content matches standard format.

        RFC-021: Also validates v2 format with START/END markers.

        Returns:
            Tuple of (is_standard_format, list_of_issues)
        """
        issues = []
        lines = content.split('\n')

        # Check for student headers
        student_headers = [
            l for l in lines
            if self.patterns['student_header'].match(l)
        ]
        if not student_headers:
            issues.append("No student headers found (expected '## Elev {id} ({n} ord)')")

        # Check for assessment sections (v2 markers OR legacy headers)
        has_v2_markers = bool(self.patterns['phase6_v2_start'].search(content))
        assessment_headers = [
            l for l in lines
            if self.patterns['assessment_start'].match(l)
        ]
        if not assessment_headers and not has_v2_markers:
            issues.append("No assessment headers found (expected '### ANALYTIC ASSESSMENT:' or '### BEDÖMNING:' or PHASE6_ASSESSMENT_START markers)")

        # Check for total lines OR PHASE6_ASSESSMENT metadata (v1 or v2)
        total_lines = [
            l for l in lines
            if self.patterns['total_line'].match(l)
        ]
        has_phase6_v2_metadata = bool(self.patterns['phase6_v2_metadata'].search(content))
        has_phase6_metadata = bool(self.patterns['phase6_metadata'].search(content))

        # v2 format allows null points (qualitative assessments), so don't require totals if v2 metadata present
        if assessment_headers and not total_lines and not has_phase6_metadata and not has_phase6_v2_metadata:
            issues.append("No total lines found (expected '**TOTAL: X/Yp**' or PHASE6_ASSESSMENT metadata)")

        is_standard = len(issues) == 0
        return is_standard, issues
