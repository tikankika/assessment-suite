"""
Validator - Validate parsed Q-file data.

This module validates parsed student assessments for:
- Data completeness (required fields present)
- Data consistency (points sum correctly, IDs match)
- Cross-file validation (same students across Q-files)

See RFC-001 for full specification.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from .standard_parser import ParseResult, StudentAssessment, QuestionAssessment


@dataclass
class ValidationIssue:
    """A single validation issue."""
    level: str              # "error", "warning", "info"
    code: str               # Machine-readable code (e.g., "MISSING_TOTAL")
    message: str            # Human-readable message
    location: Optional[str] = None  # e.g., "Q6/student_100001"


@dataclass
class AnomalyReport:
    """
    Report of an anomaly that requires teacher review.

    Used in the confirmation flow to flag unusual patterns
    before generating student reports.
    """
    severity: str           # "error", "warning", "info"
    code: str               # "MANY_ZEROS", "FORMAT_FALLBACK", etc.
    message: str            # Human-readable message
    question_id: Optional[str] = None
    details: Dict = field(default_factory=dict)  # Additional context


@dataclass
class ValidationResult:
    """Result of validation."""
    valid: bool
    issues: list[ValidationIssue] = field(default_factory=list)

    @property
    def errors(self) -> list[ValidationIssue]:
        """Get only errors."""
        return [i for i in self.issues if i.level == "error"]

    @property
    def warnings(self) -> list[ValidationIssue]:
        """Get only warnings."""
        return [i for i in self.issues if i.level == "warning"]

    def add_error(self, code: str, message: str, location: Optional[str] = None) -> None:
        """Add an error issue."""
        self.issues.append(ValidationIssue(
            level="error",
            code=code,
            message=message,
            location=location
        ))
        self.valid = False

    def add_warning(self, code: str, message: str, location: Optional[str] = None) -> None:
        """Add a warning issue."""
        self.issues.append(ValidationIssue(
            level="warning",
            code=code,
            message=message,
            location=location
        ))

    def add_info(self, code: str, message: str, location: Optional[str] = None) -> None:
        """Add an info issue."""
        self.issues.append(ValidationIssue(
            level="info",
            code=code,
            message=message,
            location=location
        ))


class Validator:
    """
    Validate parsed Q-file data.

    Usage:
        validator = Validator()

        # Validate single parse result
        result = validator.validate_parse_result(parse_result)

        # Cross-validate multiple Q-files
        result = validator.cross_validate([result1, result2, result3])
    """

    def __init__(self, strict: bool = False) -> None:
        """
        Initialize validator.

        Args:
            strict: If True, treat warnings as errors
        """
        self.strict = strict

    def validate_parse_result(self, parse_result: ParseResult) -> ValidationResult:
        """
        Validate a single parse result.

        Checks:
        - All students have IDs
        - Assessed students have valid totals
        - Points calculations are correct
        """
        result = ValidationResult(valid=True)
        question_id = parse_result.question_id

        # Check for parse errors
        for error in parse_result.errors:
            result.add_error(
                "PARSE_ERROR",
                error,
                location=question_id
            )

        # Check for parse warnings
        for warning in parse_result.warnings:
            if self.strict:
                result.add_error("PARSE_WARNING", warning, location=question_id)
            else:
                result.add_warning("PARSE_WARNING", warning, location=question_id)

        # Validate each student
        student_ids = set()
        for student in parse_result.students:
            location = f"{question_id}/{student.student_id}"

            # Check for duplicate student IDs
            if student.student_id in student_ids:
                result.add_error(
                    "DUPLICATE_STUDENT",
                    f"Duplicate student ID: {student.student_id}",
                    location=location
                )
            student_ids.add(student.student_id)

            # Validate student
            self._validate_student(student, result, location)

        return result

    def validate_student(self, student: StudentAssessment) -> ValidationResult:
        """Validate a single student assessment."""
        result = ValidationResult(valid=True)
        location = f"student_{student.student_id}"
        self._validate_student(student, result, location)
        return result

    def _validate_student(
        self,
        student: StudentAssessment,
        result: ValidationResult,
        location: str
    ) -> None:
        """Internal student validation."""
        # Check student ID
        if not student.student_id:
            result.add_error(
                "MISSING_STUDENT_ID",
                "Student has no ID",
                location=location
            )

        # If no assessment, just validate answer exists
        if student.assessment is None:
            if not student.answer_text:
                result.add_warning(
                    "EMPTY_ANSWER",
                    "Student has no answer text",
                    location=location
                )
            return

        # Validate assessment
        self._validate_assessment(student.assessment, result, location)

    def _validate_assessment(
        self,
        assessment: QuestionAssessment,
        result: ValidationResult,
        location: str
    ) -> None:
        """Validate assessment data.

        RFC-021: Supports qualitative assessments where total_points and
        max_points may be None.
        """
        # Skip point validation for qualitative assessments
        if assessment.max_points is None and assessment.total_points is None:
            # Qualitative assessment - no point validation needed
            pass
        else:
            # Check max points (only if not None)
            if assessment.max_points is not None and assessment.max_points <= 0:
                result.add_warning(
                    "INVALID_MAX_POINTS",
                    f"Invalid max points: {assessment.max_points}",
                    location=location
                )

            # Check total points (only if not None)
            if assessment.total_points is not None and assessment.total_points < 0:
                result.add_error(
                    "NEGATIVE_POINTS",
                    f"Negative total points: {assessment.total_points}",
                    location=location
                )

            # Check points don't exceed max (only if both are not None)
            if (assessment.total_points is not None and
                assessment.max_points is not None and
                assessment.total_points > assessment.max_points > 0):
                result.add_error(
                    "POINTS_EXCEED_MAX",
                    f"Total points ({assessment.total_points}) exceed max ({assessment.max_points})",
                    location=location
                )

        # Check aspect points sum (only if total_points is not None)
        if assessment.aspects and assessment.total_points is not None:
            aspect_sum = sum(a.points for a in assessment.aspects)
            # Allow small floating point differences
            if abs(aspect_sum - assessment.total_points) > 0.01:
                result.add_warning(
                    "POINTS_MISMATCH",
                    f"Aspect points sum ({aspect_sum}) != total ({assessment.total_points})",
                    location=location
                )

            # Validate each aspect
            for aspect in assessment.aspects:
                if aspect.points < 0:
                    result.add_error(
                        "NEGATIVE_ASPECT_POINTS",
                        f"Negative points for aspect '{aspect.name}': {aspect.points}",
                        location=location
                    )

        # Check next step feedback
        if not assessment.next_step:
            result.add_warning(
                "MISSING_NEXT_STEP",
                "Assessment has no next step feedback",
                location=location
            )

    def cross_validate(self, parse_results: list[ParseResult]) -> ValidationResult:
        """
        Cross-validate multiple Q-files.

        Checks:
        - Same students appear across all Q-files
        - Student IDs are consistent
        - All questions are represented
        """
        result = ValidationResult(valid=True)

        if not parse_results:
            result.add_warning("NO_FILES", "No files to validate")
            return result

        # Collect all student IDs per question
        question_students: dict[str, set[str]] = {}
        for pr in parse_results:
            question_students[pr.question_id] = {
                s.student_id for s in pr.students
            }

        # Find students present in all questions
        all_questions = list(question_students.keys())
        if len(all_questions) > 1:
            # Get intersection of all student sets
            common_students = set.intersection(*question_students.values())

            # Check for students missing from some questions
            all_students = set.union(*question_students.values())
            for student_id in all_students:
                missing_from = [
                    q for q, students in question_students.items()
                    if student_id not in students
                ]
                if missing_from:
                    result.add_warning(
                        "MISSING_STUDENT_QUESTION",
                        f"Student {student_id} missing from: {', '.join(missing_from)}",
                        location=f"student_{student_id}"
                    )

        # Check for assessment completeness
        for pr in parse_results:
            unassessed = [s for s in pr.students if s.assessment is None]
            if unassessed:
                result.add_warning(
                    "UNASSESSED_STUDENTS",
                    f"{len(unassessed)} students not assessed in {pr.question_id}",
                    location=pr.question_id
                )

        return result

    def summarize(self, result: ValidationResult) -> str:
        """Generate human-readable validation summary."""
        lines = []

        if result.valid:
            lines.append("✓ Validation passed")
        else:
            lines.append("✗ Validation failed")

        error_count = len(result.errors)
        warning_count = len(result.warnings)

        if error_count:
            lines.append(f"\nErrors ({error_count}):")
            for issue in result.errors:
                loc = f" [{issue.location}]" if issue.location else ""
                lines.append(f"  - {issue.code}: {issue.message}{loc}")

        if warning_count:
            lines.append(f"\nWarnings ({warning_count}):")
            for issue in result.warnings:
                loc = f" [{issue.location}]" if issue.location else ""
                lines.append(f"  - {issue.code}: {issue.message}{loc}")

        return '\n'.join(lines)

    def detect_anomalies(
        self,
        parse_results: List[ParseResult],
        used_fallback: bool = False,
        fallback_confidence: float = 1.0
    ) -> List[AnomalyReport]:
        """
        Detect unusual patterns that require teacher review.

        Checks for:
        - Many students with 0 points on a question (>40%)
        - All students with 0 points (100% - likely format error)
        - Format fallback was used (intelligent detection)
        - Low detection confidence (<70%)
        - Missing assessments

        Args:
            parse_results: List of parsed Q-files
            used_fallback: Whether intelligent detection was used
            fallback_confidence: Confidence level of format detection

        Returns:
            List of AnomalyReport items requiring teacher attention
        """
        anomalies: List[AnomalyReport] = []

        # Check for format fallback
        if used_fallback:
            severity = "warning" if fallback_confidence >= 0.7 else "error"
            anomalies.append(AnomalyReport(
                severity=severity,
                code="FORMAT_FALLBACK",
                message=f"Använde intelligent format-detection (confidence: {fallback_confidence:.0%})",
                details={"confidence": fallback_confidence}
            ))

        # Check each question for anomalies
        for pr in parse_results:
            students_with_assessment = [
                s for s in pr.students if s.assessment is not None
            ]

            if not students_with_assessment:
                # No assessments at all
                anomalies.append(AnomalyReport(
                    severity="error",
                    code="NO_ASSESSMENTS",
                    message=f"Inga bedömningar hittades",
                    question_id=pr.question_id,
                    details={"student_count": len(pr.students)}
                ))
                continue

            # Count zeros
            zero_count = sum(
                1 for s in students_with_assessment
                if s.assessment.total_points == 0
            )
            total_assessed = len(students_with_assessment)
            zero_ratio = zero_count / total_assessed if total_assessed > 0 else 0

            # All zeros - likely format problem
            if zero_ratio == 1.0 and total_assessed > 1:
                anomalies.append(AnomalyReport(
                    severity="error",
                    code="ALL_ZEROS",
                    message=f"Alla {total_assessed} elever fick 0 poäng - troligen format-fel",
                    question_id=pr.question_id,
                    details={
                        "zero_count": zero_count,
                        "total": total_assessed,
                        "ratio": zero_ratio
                    }
                ))
            # Many zeros - might be intentional but flag for review
            elif zero_ratio > 0.4:
                anomalies.append(AnomalyReport(
                    severity="warning",
                    code="MANY_ZEROS",
                    message=f"{zero_count}/{total_assessed} elever fick 0 poäng ({zero_ratio:.0%})",
                    question_id=pr.question_id,
                    details={
                        "zero_count": zero_count,
                        "total": total_assessed,
                        "ratio": zero_ratio
                    }
                ))

            # Check for missing assessments
            unassessed = [s for s in pr.students if s.assessment is None]
            if unassessed:
                anomalies.append(AnomalyReport(
                    severity="warning",
                    code="MISSING_ASSESSMENTS",
                    message=f"{len(unassessed)} elever saknar bedömning",
                    question_id=pr.question_id,
                    details={
                        "unassessed_count": len(unassessed),
                        "unassessed_ids": [s.student_id for s in unassessed[:5]]
                    }
                ))

            # Check for points exceeding max (skip if qualitative assessment)
            for s in students_with_assessment:
                if (s.assessment.total_points is not None and
                    s.assessment.max_points is not None and
                    s.assessment.total_points > s.assessment.max_points > 0):
                    anomalies.append(AnomalyReport(
                        severity="error",
                        code="POINTS_EXCEED_MAX",
                        message=f"Elev {s.student_id}: {s.assessment.total_points} > {s.assessment.max_points} max",
                        question_id=pr.question_id,
                        details={
                            "student_id": s.student_id,
                            "points": s.assessment.total_points,
                            "max_points": s.assessment.max_points
                        }
                    ))

        return anomalies


def quick_validate(parse_result: ParseResult) -> tuple[bool, list[str]]:
    """
    Quick validation helper.

    Returns:
        Tuple of (is_valid, list_of_issues)
    """
    validator = Validator()
    result = validator.validate_parse_result(parse_result)

    issues = [
        f"[{i.level.upper()}] {i.code}: {i.message}"
        for i in result.issues
    ]

    return result.valid, issues
