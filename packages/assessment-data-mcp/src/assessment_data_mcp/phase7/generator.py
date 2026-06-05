"""
Generator - Generate student reports from Q-files.

This module aggregates assessments from all Q-files (question-view)
into individual student reports (student-view).

RFC-018 DUAL OUTPUT:
Input: 06_analytic_assessment/Q*.md (Phase 6 working copies)
Output:
  - 07_analytic_student/Analytic_{student}.md (basic assessment report)
  - complete_assessment/Complete_{student}.md (progressive build Phase 7-12)

See RFC-001 for full specification.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Union

from .standard_parser import (
    StandardParser,
    ParseResult,
    StudentAssessment,
    QuestionAssessment,
)
from .validator import Validator, ValidationResult, AnomalyReport
from .assessment_format_config import (
    load_assessment_format,
    AssessmentFormat,
    AssessmentFormatV2,
    AssessmentFormatLegacy
)
from ..utils.logging_config import setup_project_logging, log_phase_start
from ..constants.folders import (
    PHASE6_ASSESSMENT,
    PHASE7_STUDENT,
    COMPLETE_ASSESSMENT,
)

import re
import logging

logger = logging.getLogger(__name__)


@dataclass
class StudentReport:
    """Complete report for a single student."""
    student_id: str
    questions: Dict[str, QuestionAssessment] = field(default_factory=dict)
    total_points: Optional[float] = None  # None = qualitative assessment
    max_points: Optional[float] = None    # None = qualitative assessment

    @property
    def has_points(self) -> bool:
        """Check if this report has numeric points."""
        return self.total_points is not None

    @property
    def percentage(self) -> float:
        """Calculate percentage score."""
        if not self.has_points or self.max_points is None or self.max_points <= 0:
            return 0.0
        return (self.total_points / self.max_points) * 100


@dataclass
class GenerationResult:
    """Result of report generation."""
    success: bool
    reports_created: int = 0
    reports: List[StudentReport] = field(default_factory=list)
    output_dir: Optional[str] = None
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    validation: Optional[ValidationResult] = None
    # Teacher confirmation flow fields
    requires_confirmation: bool = False
    anomalies: List[AnomalyReport] = field(default_factory=list)
    preview_summary: str = ""
    example_report: Optional[StudentReport] = None
    # Format info (from Phase 6-post)
    format_type: Optional[str] = None  # 'v2' or 'legacy'
    format_confirmed_by: Optional[str] = None
    # Existing reports check (for preview warning)
    existing_reports_count: int = 0

    @property
    def has_errors(self) -> bool:
        """Check if there are any error-level anomalies."""
        return any(a.severity == "error" for a in self.anomalies)

    @property
    def has_warnings(self) -> bool:
        """Check if there are any warning-level anomalies."""
        return any(a.severity == "warning" for a in self.anomalies)


class StudentReportGenerator:
    """
    Generate student reports from Q-files.

    RFC-022: Simplified flow - requires Phase 6-post format detection first.
    1. Load assessment_format from yaml (Phase 6-post configured)
    2. Parse Q-files using configured format
    3. Generate reports

    Usage:
        generator = StudentReportGenerator()
        result = generator.generate(
            project_path="/path/to/project",
            output_dir="07_analytic_student"  # RFC-018
        )
    """

    def __init__(self) -> None:
        """Initialize the generator."""
        self.parser = StandardParser()
        self.validator = Validator()
        self._format_config: Optional[AssessmentFormat] = None
        self._parse_results: List[ParseResult] = []

    def generate(
        self,
        project_path: str | Path,
        output_dir: str = PHASE7_STUDENT,
        dry_run: bool = False,
        force: bool = False
    ) -> GenerationResult:
        """
        Generate student reports from Q-files.

        Args:
            project_path: Path to project root
            output_dir: Output directory name (relative to project)
            dry_run: If True, validate but don't write files
            force: If True, overwrite existing reports

        Returns:
            GenerationResult with created reports
        """
        project_path = Path(project_path)
        result = GenerationResult(success=False)

        # RFC-022: Load assessment_format from yaml (Phase 6-post must run first)
        self._format_config = load_assessment_format(project_path)
        if not self._format_config:
            result.errors.append(
                "Ingen assessment_format konfigurerad i exam_config.yaml. "
                "Kör Phase 6-post (phase6_post_format) först för att detektera och konfigurera format."
            )
            return result

        # Store format info in result
        result.format_type = self._format_config.type
        result.format_confirmed_by = self._format_config.confirmed_by
        logger.info(f"Using assessment format: {self._format_config.type} (confirmed by: {self._format_config.confirmed_by})")

        # Find Q-files (RFC-018: Phase 6 working copies in 06/)
        q_files_dir = project_path / PHASE6_ASSESSMENT
        if not q_files_dir.exists():
            result.errors.append(f"Q-files directory not found: {q_files_dir}")
            return result

        q_files = self._find_q_files(q_files_dir)
        if not q_files:
            result.errors.append(f"No Q-files found in {q_files_dir}")
            return result

        logger.info(f"Found {len(q_files)} Q-files to process")

        # Parse all Q-files using configured format
        parse_results: List[ParseResult] = []

        for q_file in q_files:
            pr = self._parse_with_format(q_file)
            if pr.errors:
                result.errors.extend(pr.errors)
            parse_results.append(pr)

        if not parse_results:
            result.errors.append("Failed to parse any Q-files")
            return result

        # Store for later use (e.g., anomaly detection)
        self._parse_results = parse_results

        # Cross-validate
        validation = self.validator.cross_validate(parse_results)
        result.validation = validation
        result.warnings.extend([w.message for w in validation.warnings])

        # Aggregate by student
        student_reports = self._aggregate_by_student(parse_results)

        if not student_reports:
            result.errors.append("No students found in Q-files")
            return result

        # Prepare output
        output_path = project_path / output_dir
        result.output_dir = str(output_path)

        if dry_run:
            # Dry run - just return what would be created
            result.success = True
            result.reports = list(student_reports.values())
            result.reports_created = len(student_reports)
            return result

        # Create output directory
        output_path.mkdir(parents=True, exist_ok=True)

        # Check for existing files (RFC-018: Analytic_*.md)
        if not force:
            existing = list(output_path.glob("Analytic_*.md"))
            if existing:
                result.errors.append(
                    f"Output directory contains {len(existing)} existing reports. "
                    "Use force=True to overwrite."
                )
                return result

        # RFC-018 DUAL OUTPUT: Create complete_assessment directory
        complete_dir = project_path / COMPLETE_ASSESSMENT
        complete_dir.mkdir(parents=True, exist_ok=True)

        # Generate reports (DUAL OUTPUT: both 07/ and complete_assessment/)
        for student_id, report in student_reports.items():
            report_content = self._format_report(report)

            # FILE 1: Analytic report (basic assessment)
            analytic_file = output_path / f"Analytic_{student_id}.md"
            try:
                analytic_file.write_text(report_content, encoding='utf-8')
            except Exception as e:
                result.errors.append(f"Failed to write {analytic_file}: {e}")
                continue

            # FILE 2: Complete assessment (progressive build Phase 7-12)
            complete_content = self._format_complete_report(report, report_content)
            complete_file = complete_dir / f"Complete_{student_id}.md"
            try:
                complete_file.write_text(complete_content, encoding='utf-8')
                result.reports.append(report)
                result.reports_created += 1
            except Exception as e:
                result.errors.append(f"Failed to write {complete_file}: {e}")

        result.success = result.reports_created > 0 and len(result.errors) == 0
        return result

    def _aggregate_by_student(
        self,
        parse_results: List[ParseResult]
    ) -> Dict[str, StudentReport]:
        """Aggregate all assessments by student."""
        students: Dict[str, StudentReport] = {}

        for pr in parse_results:
            question_id = pr.question_id

            for student_data in pr.students:
                student_id = student_data.student_id

                # Create report if not exists
                if student_id not in students:
                    students[student_id] = StudentReport(student_id=student_id)

                report = students[student_id]

                # Add assessment for this question
                if student_data.assessment:
                    # Copy answer_text and question_context to assessment
                    # (these are extracted at StudentAssessment level but needed in report)
                    student_data.assessment.answer_text = student_data.answer_text
                    student_data.assessment.question_context = student_data.question_context

                    report.questions[question_id] = student_data.assessment

                    # Only sum points if assessment has points
                    if student_data.assessment.has_points:
                        # Initialize report points if this is first assessment with points
                        if report.total_points is None:
                            report.total_points = 0.0
                            report.max_points = 0.0
                        report.total_points += student_data.assessment.total_points
                        report.max_points += (student_data.assessment.max_points or 0.0)

        return students

    def _format_report(self, report: StudentReport) -> str:
        """Format a student report as markdown."""
        lines = []

        # Header
        lines.append(f"# Bedömning: Elev {report.student_id}")
        lines.append("")
        lines.append(f"*Genererad: {datetime.now().strftime('%Y-%m-%d %H:%M')}*")
        lines.append("")

        # Summary
        lines.append("## Sammanfattning")
        lines.append("")

        if report.has_points:
            lines.append(f"- **Totalpoäng:** {report.total_points:.1f}/{report.max_points:.1f}p")
            lines.append(f"- **Procent:** {report.percentage:.1f}%")
        else:
            lines.append("- **Typ:** Kvalitativ bedömning (ej poängsatt)")

        lines.append(f"- **Antal frågor:** {len(report.questions)}")
        lines.append("")

        # Questions overview table (only if we have points)
        if report.questions and report.has_points:
            lines.append("### Poäng per fråga")
            lines.append("")
            lines.append("| Fråga | Poäng | Max | Procent |")
            lines.append("|-------|-------|-----|---------|")

            for q_id in sorted(report.questions.keys()):
                assessment = report.questions[q_id]
                if assessment.has_points:
                    pct = (assessment.total_points / assessment.max_points * 100) if assessment.max_points and assessment.max_points > 0 else 0
                    lines.append(f"| {q_id} | {assessment.total_points:.1f} | {assessment.max_points:.1f} | {pct:.0f}% |")
                else:
                    lines.append(f"| {q_id} | - | - | Kvalitativ |")

            lines.append("")

        # Detailed assessments
        lines.append("---")
        lines.append("")
        lines.append("## Detaljerade bedömningar")
        lines.append("")

        for q_id in sorted(report.questions.keys()):
            assessment = report.questions[q_id]
            lines.append(f"### Fråga {q_id}")
            lines.append("")

            # RFC-025 BUG-3 FIX: ALWAYS include question context and student answer
            # This provides essential context for formative feedback

            # Include question context (from <details>Kontext före svaret</details>)
            if assessment.question_context:
                lines.append("**Fråga:**")
                lines.append("")
                lines.append(assessment.question_context)
                lines.append("")

            # Include student answer (ALWAYS, not just when no raw_text)
            if assessment.answer_text:
                lines.append("**Ditt svar:**")
                lines.append("")
                lines.append(assessment.answer_text)
                lines.append("")

            # Show assessment (either raw_text or structured)
            if assessment.raw_text:
                lines.append("**Bedömning:**")
                lines.append("")
                # Clean up raw_text
                cleaned_lines = self._clean_raw_assessment(assessment.raw_text)
                for line in cleaned_lines:
                    lines.append(line)
                lines.append("")

            # If no raw_text, show structured assessment
            elif assessment.aspects:
                lines.append("**Bedömning:**")
                lines.append("")
                for aspect in assessment.aspects:
                    lines.append(f"- **{aspect.name}:** {aspect.symbol} **{aspect.points}p** - {aspect.comment}")
                lines.append("")

                if assessment.next_step:
                    lines.append(f"**→ Nästa steg:** {assessment.next_step}")
                    lines.append("")

                if assessment.comment:
                    lines.append(f"**Kommentar:** {assessment.comment}")
                    lines.append("")
            else:
                lines.append("*Bedömning saknas*")
                lines.append("")

            lines.append("---")
            lines.append("")

        return '\n'.join(lines)

    def _format_complete_report(
        self,
        report: StudentReport,
        analytic_content: str
    ) -> str:
        """
        Format Complete assessment file with PHASE_7 markers.

        RFC-018: This file is progressively built through Phase 7-12.
        Each phase adds its section before the CHANGELOG.

        Args:
            report: StudentReport data
            analytic_content: Already formatted analytic content

        Returns:
            Formatted markdown with PHASE_7 markers and changelog
        """
        timestamp = datetime.now().strftime('%Y-%m-%d')

        return f"""# Complete Assessment: Elev {report.student_id}

*Progressiv bedömning genom fas 7-12*
*Skapad: {timestamp}*

---

<!-- PHASE_7_START -->
## PHASE 7: Grundläggande Bedömning

{analytic_content}
<!-- PHASE_7_END -->

---

<!-- CHANGELOG_START -->
## ÄNDRINGSLOGG

| Datum | Fas | Ändring |
|-------|-----|---------|
| {timestamp} | Phase 7 | Grundbedömning skapad |
<!-- CHANGELOG_END -->
"""

    def _clean_raw_assessment(self, raw_text: str) -> List[str]:
        """
        Clean up raw assessment text by removing artifacts.

        Removes:
        - Header lines (### BEDÖMNING:, ### ANALYTIC ASSESSMENT:)
        - HTML tags (<details>, </details>, <summary>)
        - Metadata lines (Ord: X, standalone numbers like "5/9")
        - Code block markers (```)
        - Excessive separators (multiple ---)
        - Consecutive empty lines (collapse to max 1)
        - Empty lines at start/end

        Returns:
            List of cleaned lines ready for output
        """
        lines = raw_text.strip().split('\n')
        cleaned = []
        prev_was_empty_or_sep = False

        for line in lines:
            stripped = line.strip()

            # Skip header lines
            if stripped.startswith('### BEDÖMNING') or stripped.startswith('### ANALYTIC ASSESSMENT'):
                continue

            # Skip HTML tags
            if stripped.startswith('<details') or stripped.startswith('</details') or stripped.startswith('<summary'):
                continue

            # Skip metadata lines (Ord: X, standalone fractions like 5/9)
            if re.match(r'^Ord:\s*\d+', stripped):
                continue
            if re.match(r'^\d+/\d+$', stripped):  # Standalone fraction like "5/9"
                continue

            # Skip code block markers
            if stripped == '```':
                continue

            # Collapse multiple separators and empty lines
            is_empty_or_sep = stripped in ('', '---')
            if is_empty_or_sep:
                if prev_was_empty_or_sep:
                    continue  # Skip consecutive empty/separator lines
                prev_was_empty_or_sep = True
                # Skip separators entirely in cleaned output (we add our own)
                if stripped == '---':
                    continue
            else:
                prev_was_empty_or_sep = False

            # Skip empty lines at start
            if not cleaned and stripped == '':
                continue

            cleaned.append(line)

        # Remove trailing empty lines
        while cleaned and cleaned[-1].strip() == '':
            cleaned.pop()

        return cleaned

    def _find_q_files(self, q_files_dir: Path) -> List[Path]:
        """
        Find Q-files in assessment directory, preferring dated versions over originals.

        File naming patterns:
        - Original: Q001_alla_elever.md
        - Dated: Q001_alla_elever_2026-01-18_Author.md
        - Copy: Q001_alla_elever_2026-01-18_Author 1.md (avoid these)

        Returns:
            List of selected Q-file paths, sorted by question number
        """
        all_q_files = sorted(q_files_dir.glob("Q*.md"))
        if not all_q_files:
            return []

        # Group files by question number
        q_files_by_question: Dict[str, List[Path]] = {}
        for q_file in all_q_files:
            match = re.match(r'^(Q\d+[a-z]?)', q_file.name, re.IGNORECASE)
            if match:
                q_id = match.group(1).upper()
                if q_id not in q_files_by_question:
                    q_files_by_question[q_id] = []
                q_files_by_question[q_id].append(q_file)

        # Select best file per question (prefer dated versions)
        selected_files: List[Path] = []
        for q_id, files in sorted(q_files_by_question.items()):
            # Filter out copy files (with " 1", " 2", etc. suffix)
            non_copy_files = [f for f in files if not re.search(r' \d+\.md$', f.name)]
            if not non_copy_files:
                non_copy_files = files  # Fallback to all files

            # Separate dated files from original
            dated_files = [f for f in non_copy_files if re.search(r'_\d{4}-\d{2}-\d{2}_', f.name)]
            original_files = [f for f in non_copy_files if not re.search(r'_\d{4}-\d{2}-\d{2}_', f.name)]

            if dated_files:
                # Prefer dated files - sort by date descending to get latest
                def extract_date(f: Path) -> str:
                    match = re.search(r'_(\d{4}-\d{2}-\d{2})_', f.name)
                    return match.group(1) if match else ''
                dated_files.sort(key=extract_date, reverse=True)
                selected_files.append(dated_files[0])
                logger.info(f"{q_id}: Selected dated file {dated_files[0].name}")
            elif original_files:
                selected_files.append(original_files[0])
                logger.info(f"{q_id}: Using original file {original_files[0].name}")
            else:
                selected_files.append(files[0])

        return selected_files

    def _prescan_assessments(
        self,
        content: str,
        format_config: Optional[AssessmentFormat] = None
    ) -> Dict[str, str]:
        """
        Scan for assessment sections in file.

        RFC-022 Priority (reads from assessment_format in yaml):
        1. v2 format (PHASE6_ASSESSMENT_START/END) - always checked first
        2. Legacy format - only if format_config.type == 'legacy' (Phase 6-post confirmed)

        Args:
            content: Full file content
            format_config: AssessmentFormat from yaml (Phase 6-post configured)

        Returns:
            Dict mapping student_id -> assessment raw text
        """
        assessments: Dict[str, str] = {}

        # RFC-022: v2 format with START/END markers is standard - always check first
        v2_start_pattern = re.compile(r'<!--\s*PHASE6_ASSESSMENT_START\s+student_id="([^"]+)"\s*-->')
        v2_end_pattern = re.compile(r'<!--\s*PHASE6_ASSESSMENT_END\s*-->')

        # Find all v2 assessment blocks
        v2_matches = list(v2_start_pattern.finditer(content))
        if v2_matches:
            logger.info(f"Found {len(v2_matches)} v2 format assessments (standard)")
            for match in v2_matches:
                student_id = match.group(1)
                start_pos = match.start()

                # Find the corresponding END marker
                end_search = v2_end_pattern.search(content, start_pos)
                if end_search:
                    end_pos = end_search.end()
                    assessment_text = content[start_pos:end_pos]
                    assessments[student_id] = assessment_text
                else:
                    # No END marker - take until next START or EOF
                    next_start = v2_start_pattern.search(content, match.end())
                    if next_start:
                        assessment_text = content[start_pos:next_start.start()]
                    else:
                        assessment_text = content[start_pos:]
                    assessments[student_id] = assessment_text

        # RFC-022: Legacy format ONLY if assessment_format.type == 'legacy' (Phase 6-post confirmed)
        if format_config and format_config.type == 'legacy' and not assessments:
            legacy_config = format_config  # Type narrowing
            logger.info(f"Using legacy format - Phase 6-post confirmed by {legacy_config.confirmed_by}")

            # Use student_id_pattern from yaml config
            try:
                legacy_pattern = re.compile(f'^{legacy_config.student_id_pattern}', re.MULTILINE)
            except re.error as e:
                logger.error(f"Invalid student_id_pattern in yaml: {e}")
                legacy_pattern = re.compile(r'^### BEDÖMNING:\s*(\S+)', re.MULTILINE)

            legacy_matches = list(legacy_pattern.finditer(content))

            if legacy_matches:
                logger.info(f"Found {len(legacy_matches)} legacy format assessments")
                for i, match in enumerate(legacy_matches):
                    student_id = match.group(1)
                    start_pos = match.start()

                    # Find end: next header or EOF
                    if i + 1 < len(legacy_matches):
                        end_pos = legacy_matches[i + 1].start()
                    else:
                        end_pos = len(content)

                    assessment_text = content[start_pos:end_pos].strip()
                    assessments[student_id] = assessment_text

        if not assessments:
            logger.warning(
                "No standard v2 format (PHASE6_ASSESSMENT_START/END) found. "
                "Legacy format requires assessment_format in exam_config.yaml (run Phase 6-post)"
            )

        return assessments

    def _parse_with_format(self, q_file: Path) -> ParseResult:
        """
        Parse Q-file using configured format from Phase 6-post.

        RFC-022 Simplified Flow:
        1. Parse students using standard parser
        2. Pre-scan for assessments using configured format
        3. Apply points_pattern to extract points

        Args:
            q_file: Path to Q-file

        Returns:
            ParseResult with assessments and points
        """
        # Parse students first
        pr = self.parser.parse_file(q_file)

        try:
            content = q_file.read_text(encoding='utf-8')
        except Exception as e:
            logger.error(f"Failed to read {q_file}: {e}")
            pr.errors.append(f"Failed to read file: {e}")
            return pr

        # Pre-scan for assessments using configured format
        prescan = self._prescan_assessments(content, format_config=self._format_config)
        matched_count = 0

        if prescan:
            logger.info(f"Found {len(prescan)} assessments in {q_file.name}")
            for student in pr.students:
                if student.student_id in prescan:
                    assessment_text = prescan[student.student_id]
                    # Parse the assessment section
                    student.assessment = self.parser._parse_assessment(
                        assessment_text.split('\n'),
                        pr.question_id
                    )
                    if student.assessment and student.assessment.raw_text:
                        matched_count += 1

            logger.info(f"Matched {matched_count}/{len(pr.students)} students")

        # Apply points_pattern from format config (per-question)
        if self._format_config and self._format_config.type == 'legacy':
            legacy_config = self._format_config

            # Get pattern for THIS question (or fallback to default)
            points_pattern = legacy_config.get_points_pattern(pr.question_id)

            if not points_pattern:
                logger.warning(f"No points_pattern for {pr.question_id} in yaml")
                return pr

            logger.info(f"Applying points_pattern for {pr.question_id}")

            try:
                points_regex = re.compile(points_pattern)
            except re.error as e:
                logger.error(f"Invalid points_pattern for {pr.question_id}: {e}")
                pr.errors.append(f"Invalid points_pattern for {pr.question_id}: {e}")
                return pr

            points_extracted = 0
            for student in pr.students:
                if student.assessment and student.assessment.raw_text:
                    match = points_regex.search(student.assessment.raw_text)
                    if match:
                        try:
                            # Groups 1 and 2 are points and max_points
                            points_str = match.group(1).replace(',', '.')
                            max_str = match.group(2).replace(',', '.')
                            student.assessment.total_points = float(points_str)
                            student.assessment.max_points = float(max_str)
                            points_extracted += 1
                        except (ValueError, IndexError) as e:
                            logger.warning(f"Failed to parse points for {student.student_id}: {e}")

            logger.info(f"Extracted points for {points_extracted}/{len(pr.students)} students in {pr.question_id}")

        return pr

    def generate_single(
        self,
        student_id: str,
        q_files: List[Path],
    ) -> Optional[StudentReport]:
        """
        Generate report for a single student.

        Args:
            student_id: Student ID to generate report for
            q_files: List of Q-file paths

        Returns:
            StudentReport or None if student not found
        """
        report = StudentReport(student_id=student_id)

        for q_file in q_files:
            pr = self.parser.parse_file(q_file)

            # Find this student
            for student_data in pr.students:
                if student_data.student_id == student_id:
                    if student_data.assessment:
                        report.questions[pr.question_id] = student_data.assessment
                        # Only sum points if assessment has points
                        if student_data.assessment.has_points:
                            if report.total_points is None:
                                report.total_points = 0.0
                                report.max_points = 0.0
                            report.total_points += student_data.assessment.total_points
                            report.max_points += (student_data.assessment.max_points or 0.0)
                    break

        if not report.questions:
            return None

        return report

    def generate_preview(
        self,
        project_path: str | Path,
    ) -> GenerationResult:
        """
        Generate preview for teacher confirmation.

        This runs a dry-run analysis and returns a formatted preview
        with anomalies and example report for teacher review.

        Args:
            project_path: Path to project root

        Returns:
            GenerationResult with:
            - preview_summary: Formatted markdown for chat display
            - anomalies: List of issues to review
            - example_report: One sample student report
            - requires_confirmation: True (always for preview)
        """
        # Run dry-run to get all data
        result = self.generate(project_path, dry_run=True)

        # Check for existing reports in 07_analytic_student/
        project_path = Path(project_path)
        output_dir = project_path / PHASE7_STUDENT
        if output_dir.exists():
            existing = list(output_dir.glob("Analytic_*.md"))
            result.existing_reports_count = len(existing)
            if existing:
                result.warnings.append(
                    f"⚠️ {len(existing)} rapporter finns redan i {PHASE7_STUDENT}/. "
                    "Dessa kommer INTE att skrivas över om du inte använder force=True."
                )

        # RFC-029 §9 C2: Warn if Complete_*.md files contain Phase 8-12 sections
        complete_dir = project_path / COMPLETE_ASSESSMENT
        if complete_dir.exists():
            phase_markers = ["PHASE_8", "PHASE_9", "PHASE_10", "PHASE_11", "PHASE_12"]
            affected_files = []
            for complete_file in complete_dir.glob("Complete_*.md"):
                try:
                    content = complete_file.read_text(encoding='utf-8')
                    found = [m for m in phase_markers if m in content]
                    if found:
                        affected_files.append((complete_file.name, found))
                except Exception:
                    pass
            if affected_files:
                phases_str = ", ".join(
                    f"{name} (Phase {'+'.join(m.replace('PHASE_', '') for m in markers)})"
                    for name, markers in affected_files[:3]
                )
                result.warnings.append(
                    f"⚠️ VARNING: {len(affected_files)} Complete-filer innehåller data från senare faser. "
                    f"Om du genererar om (force=True) kommer Phase 8-12-sektioner att FÖRLORAS. "
                    f"Exempel: {phases_str}"
                )

        # Detect anomalies (RFC-022: no fallback, format always configured by Phase 6-post)
        result.anomalies = self.validator.detect_anomalies(
            self._parse_results,
            used_fallback=False,
            fallback_confidence=1.0
        )

        # Pick a representative example (median score)
        if result.reports:
            sorted_reports = sorted(result.reports, key=lambda r: r.percentage)
            median_idx = len(sorted_reports) // 2
            result.example_report = sorted_reports[median_idx]

        # Generate preview markdown
        result.preview_summary = self._format_preview(result, project_path)
        result.requires_confirmation = True

        return result

    def _format_preview(
        self,
        result: GenerationResult,
        project_path: str | Path
    ) -> str:
        """
        Format preview as markdown for chat display.

        Args:
            result: GenerationResult from dry-run
            project_path: Project path for display

        Returns:
            Formatted markdown string
        """
        project_path = Path(project_path)
        lines = []

        # Header
        lines.append("## 📋 Phase 7: Förhandsvisning av Studentrapporter")
        lines.append("")
        lines.append(f"**Projekt:** {project_path.name}")
        lines.append(f"**Analyserat:** {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        lines.append("")

        # Summary stats
        lines.append("### Sammanfattning")
        lines.append("")

        num_questions = len(self._parse_results)
        num_students = len(result.reports)
        total_assessments = sum(len(r.questions) for r in result.reports)
        expected_assessments = num_questions * num_students

        # Calculate average score (only for reports with points)
        reports_with_points = [r for r in result.reports if r.has_points]
        is_qualitative = len(reports_with_points) == 0 and len(result.reports) > 0

        if reports_with_points:
            avg_points = sum(r.total_points for r in reports_with_points) / len(reports_with_points)
            avg_max = sum(r.max_points for r in reports_with_points) / len(reports_with_points)
            avg_pct = (avg_points / avg_max * 100) if avg_max > 0 else 0
        else:
            avg_points = avg_max = avg_pct = 0

        lines.append("| Mätpunkt | Värde |")
        lines.append("|----------|-------|")
        lines.append(f"| Frågor parsade | {num_questions} |")
        lines.append(f"| Elever hittade | {num_students} |")
        lines.append(f"| Bedömningar | {total_assessments}/{expected_assessments} ({total_assessments/expected_assessments*100 if expected_assessments > 0 else 0:.0f}%) |")

        if is_qualitative:
            lines.append("| Typ | Kvalitativ (ej poängsatt) |")
        else:
            lines.append(f"| Medelpoäng | {avg_points:.1f}/{avg_max:.1f} ({avg_pct:.0f}%) |")
        lines.append("")

        # Existing reports warning (show BEFORE anomalies for visibility)
        if result.existing_reports_count > 0:
            lines.append("### ⚠️ RAPPORTER FINNS REDAN")
            lines.append("")
            lines.append(f"**{result.existing_reports_count} rapporter finns redan i {PHASE7_STUDENT}/**")
            lines.append("")
            lines.append("Om du kör `mode='generate'` utan `force=True` kommer inget att hända.")
            lines.append("Använd `force=True` för att skriva över befintliga rapporter.")
            lines.append("")

        # Anomalies section
        if result.anomalies:
            error_anomalies = [a for a in result.anomalies if a.severity == "error"]
            warning_anomalies = [a for a in result.anomalies if a.severity == "warning"]

            if error_anomalies:
                lines.append("### 🛑 Fel som måste åtgärdas")
                lines.append("")
                for a in error_anomalies:
                    q_prefix = f"**{a.question_id}:** " if a.question_id else ""
                    lines.append(f"- {q_prefix}{a.message}")
                lines.append("")

            if warning_anomalies:
                lines.append("### ⚠️ Varningar att granska")
                lines.append("")
                for a in warning_anomalies:
                    q_prefix = f"**{a.question_id}:** " if a.question_id else ""
                    lines.append(f"- {q_prefix}{a.message}")
                lines.append("")
        else:
            lines.append("### ✅ Inga anomalier upptäckta")
            lines.append("")

        # Question breakdown (only show if we have points)
        if not is_qualitative:
            lines.append("### 📊 Poängfördelning per fråga")
            lines.append("")
            lines.append("| Fråga | Medel | Min | Max | 0-poäng |")
            lines.append("|-------|-------|-----|-----|---------|")

            for pr in sorted(self._parse_results, key=lambda p: p.question_id):
                students_with_scores = [
                    s for s in pr.students
                    if s.assessment is not None and s.assessment.has_points
                ]
                if not students_with_scores:
                    lines.append(f"| {pr.question_id} | - | - | - | Kvalitativ |")
                    continue

                scores = [s.assessment.total_points for s in students_with_scores]
                max_possible = students_with_scores[0].assessment.max_points if students_with_scores else 0
                avg_score = sum(scores) / len(scores)
                min_score = min(scores)
                max_score = max(scores)
                zero_count = sum(1 for s in scores if s == 0)

                zero_flag = " ⚠️" if zero_count > len(scores) * 0.4 else ""
                lines.append(f"| {pr.question_id} | {avg_score:.1f}/{max_possible:.0f} | {min_score:.0f} | {max_score:.0f} | {zero_count}{zero_flag} |")
        else:
            lines.append("### 📋 Kvalitativ bedömning")
            lines.append("")
            lines.append("Bedömningarna innehåller ingen poängsättning.")

        lines.append("")

        # Example report
        if result.example_report:
            ex = result.example_report
            lines.append(f"### 👀 Exempelrapport: Elev {ex.student_id}")
            lines.append("")

            if ex.has_points:
                lines.append(f"**Totalpoäng:** {ex.total_points:.1f}/{ex.max_points:.1f}p ({ex.percentage:.1f}%)")
                lines.append("")
                lines.append("| Fråga | Poäng | Status |")
                lines.append("|-------|-------|--------|")

                for q_id in sorted(ex.questions.keys()):
                    assessment = ex.questions[q_id]
                    if assessment.has_points:
                        pct = (assessment.total_points / assessment.max_points * 100) if assessment.max_points and assessment.max_points > 0 else 0
                        if pct >= 80:
                            status = "✅"
                        elif pct >= 50:
                            status = "⚠️"
                        else:
                            status = "❌"
                        lines.append(f"| {q_id} | {assessment.total_points:.1f}/{assessment.max_points:.1f} | {status} |")
                    else:
                        lines.append(f"| {q_id} | - | Kvalitativ |")
            else:
                lines.append("**Typ:** Kvalitativ bedömning (ej poängsatt)")
                lines.append("")
                lines.append(f"**Antal frågor:** {len(ex.questions)}")

            lines.append("")

            # Show a sample assessment text (first question with content)
            for q_id in sorted(ex.questions.keys()):
                assessment = ex.questions[q_id]
                if assessment.raw_text:
                    # Get first few lines of the raw text
                    raw_lines = assessment.raw_text.strip().split('\n')[:6]
                    preview_text = '\n'.join(raw_lines)
                    if len(assessment.raw_text.strip().split('\n')) > 6:
                        preview_text += "\n..."

                    lines.append(f"**Exempel på bedömningstext ({q_id}):**")
                    lines.append("")
                    for line in preview_text.split('\n'):
                        lines.append(f"> {line}")
                    lines.append("")
                    break

        lines.append("---")
        lines.append("")

        # Decision prompt
        lines.append("### ❓ Vad vill du göra?")
        lines.append("")

        if result.has_errors:
            lines.append("⛔ **Det finns fel som måste åtgärdas innan rapporter kan skapas.**")
            lines.append("")
            lines.append("1. **Granska Q-filer** → Visa filen med problemet")
            lines.append("2. **Avbryt** → Gå tillbaka utan att skapa filer")
        else:
            lines.append(f"1. **Godkänn** → Generera alla {num_students} studentrapporter")
            if result.has_warnings:
                lines.append("2. **Granska varningar** → Visa Q-filer med avvikelser")
            lines.append(f"{'3' if result.has_warnings else '2'}. **Avbryt** → Gå tillbaka utan att skapa filer")

        return '\n'.join(lines)


def generate_reports(
    project_path: str | Path,
    output_dir: str = PHASE7_STUDENT,
    dry_run: bool = False,
    force: bool = False
) -> GenerationResult:
    """
    Convenience function to generate student reports.

    RFC-022: Requires Phase 6-post to configure assessment_format first.
    No more pattern confirmation in Phase 7 - that's handled by Phase 6-post.

    Args:
        project_path: Path to project root
        output_dir: Output directory name
        dry_run: If True, validate but don't write
        force: If True, overwrite existing

    Returns:
        GenerationResult
    """
    project = Path(project_path)

    # Setup project-specific logging
    if project.exists():
        setup_project_logging(project)
        log_phase_start(7, "generate_reports", dry_run=dry_run, force=force)

    generator = StudentReportGenerator()
    return generator.generate(
        project_path=project_path,
        output_dir=output_dir,
        dry_run=dry_run,
        force=force
    )
