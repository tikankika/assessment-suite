"""
Intelligent Detector - Detect Q-file format variations.

This module handles the "detection path" for Q-files that don't match
standard format. It uses pattern analysis and optionally Claude for
intelligent format detection.

Detection Flow:
1. Try standard patterns first
2. If standard fails, analyze content for format hints
3. Return detected format or suggest config creation

See RFC-001 for full specification.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Tuple


class FormatType(Enum):
    """Detected format type."""
    STANDARD = "standard"           # Matches Phase 6 output exactly
    STANDARD_VARIANT = "variant"    # Minor variations (language, spacing)
    CUSTOM = "custom"               # Requires custom config
    UNKNOWN = "unknown"             # Cannot detect, needs manual config


@dataclass
class FormatHint:
    """A detected format hint."""
    element: str              # What was detected (e.g., "student_header")
    pattern: str              # The detected pattern
    confidence: float         # 0.0-1.0 confidence score
    examples: list[str] = field(default_factory=list)  # Example matches


@dataclass
class DetectionResult:
    """Result of format detection."""
    format_type: FormatType
    confidence: float         # Overall confidence 0.0-1.0
    hints: list[FormatHint] = field(default_factory=list)
    suggested_config: Optional[dict] = None  # For CUSTOM type
    issues: list[str] = field(default_factory=list)


class IntelligentDetector:
    """
    Detect Q-file format variations.

    Usage:
        detector = IntelligentDetector()
        result = detector.detect_format(content)

        if result.format_type == FormatType.STANDARD:
            # Use StandardParser
        elif result.format_type == FormatType.CUSTOM:
            # Generate config from result.suggested_config
    """

    # Common pattern variations to detect
    STUDENT_PATTERNS = [
        # Standard Phase 6 format
        (re.compile(r'^## Elev ([A-Za-z0-9]+) \((\d+) ord\)'), 1.0),
        # Alternative: "## Student X (N words)"
        (re.compile(r'^## Student ([A-Za-z0-9]+) \((\d+) words?\)'), 0.9),
        # Alternative: "## Elev X"
        (re.compile(r'^## Elev ([A-Za-z0-9]+)\s*$'), 0.8),
        # Alternative: "### Elev X"
        (re.compile(r'^### Elev ([A-Za-z0-9]+)'), 0.7),
        # Generic numbered student
        (re.compile(r'^##+ (?:Student|Elev|Studerande)[\s#:]*(\d+)'), 0.6),
    ]

    ASSESSMENT_PATTERNS = [
        # Standard formats
        (re.compile(r'^### ANALYTIC ASSESSMENT:'), 1.0),
        (re.compile(r'^### BEDÖMNING:'), 1.0),
        # Variations
        (re.compile(r'^### Assessment:?', re.IGNORECASE), 0.9),
        (re.compile(r'^### Bedömning:?', re.IGNORECASE), 0.9),
        (re.compile(r'^## BEDÖMNING:?'), 0.8),
        (re.compile(r'^\*\*BEDÖMNING:?\*\*'), 0.7),
    ]

    TOTAL_PATTERNS = [
        # Standard Phase 6 formats (highest confidence)
        (re.compile(r'^\*\*TOTAL:\s*([\d.,]+)/([\d.,]+)p?\*\*'), 1.0),
        (re.compile(r'^\*\*TOTALPOÄNG:\s*([\d.,]+)/([\d.,]+)p?\*\*'), 1.0),
        # Variations with bold markers
        (re.compile(r'^\*\*Totalt?:\s*([\d.,]+)/([\d.,]+)p?\*\*', re.IGNORECASE), 0.9),
        (re.compile(r'^\*\*Total(?:poäng)?:\s*([\d.,]+)/([\d.,]+)p?\*\*', re.IGNORECASE), 0.9),
        # Without bold markers
        (re.compile(r'^Total(?:poäng)?:\s*([\d.,]+)/([\d.,]+)', re.IGNORECASE), 0.8),
        (re.compile(r'^\*\*Poäng:\s*([\d.,]+)/([\d.,]+)', re.IGNORECASE), 0.7),
        (re.compile(r'Summa:\s*([\d.,]+)/([\d.,]+)', re.IGNORECASE), 0.6),
    ]

    NEXT_STEP_PATTERNS = [
        # Standard format
        (re.compile(r'^\*\*→\s*Next step:\*\*\s*(.+)$'), 1.0),
        (re.compile(r'^\*\*→\s*Nästa steg:\*\*\s*(.+)$'), 1.0),
        # Variations
        (re.compile(r'^Next step:\s*(.+)$', re.IGNORECASE), 0.8),
        (re.compile(r'^Nästa steg:\s*(.+)$', re.IGNORECASE), 0.8),
        (re.compile(r'^\*\*Feedback:\*\*\s*(.+)$', re.IGNORECASE), 0.7),
        (re.compile(r'^→\s*(.+)$'), 0.5),
    ]

    def __init__(self) -> None:
        """Initialize the detector."""
        pass

    def detect_format(self, content: str) -> DetectionResult:
        """
        Detect the format of Q-file content.

        Args:
            content: Q-file content as string

        Returns:
            DetectionResult with format type and hints
        """
        lines = content.split('\n')
        hints: list[FormatHint] = []
        issues: list[str] = []

        # Detect student header format
        student_hint = self._detect_pattern(
            lines, self.STUDENT_PATTERNS, "student_header"
        )
        if student_hint:
            hints.append(student_hint)
        else:
            issues.append("Could not detect student header format")

        # Detect assessment header format
        assessment_hint = self._detect_pattern(
            lines, self.ASSESSMENT_PATTERNS, "assessment_header"
        )
        if assessment_hint:
            hints.append(assessment_hint)
        else:
            issues.append("Could not detect assessment header format")

        # Detect total line format
        total_hint = self._detect_pattern(
            lines, self.TOTAL_PATTERNS, "total_line"
        )
        if total_hint:
            hints.append(total_hint)

        # Detect next step format
        next_step_hint = self._detect_pattern(
            lines, self.NEXT_STEP_PATTERNS, "next_step"
        )
        if next_step_hint:
            hints.append(next_step_hint)

        # Calculate overall confidence and determine format type
        format_type, confidence = self._determine_format_type(hints, issues)

        result = DetectionResult(
            format_type=format_type,
            confidence=confidence,
            hints=hints,
            issues=issues
        )

        # Generate suggested config for custom formats
        if format_type in (FormatType.CUSTOM, FormatType.STANDARD_VARIANT):
            result.suggested_config = self._generate_config(hints)

        return result

    def _detect_pattern(
        self,
        lines: list[str],
        patterns: list[tuple[re.Pattern, float]],
        element_name: str
    ) -> Optional[FormatHint]:
        """Detect which pattern matches best."""
        best_match = None
        best_confidence = 0.0
        examples = []

        for pattern, base_confidence in patterns:
            matches = [line for line in lines if pattern.match(line)]
            if matches:
                # Confidence increases with more matches
                match_confidence = min(base_confidence + len(matches) * 0.02, 1.0)
                if match_confidence > best_confidence:
                    best_confidence = match_confidence
                    best_match = pattern.pattern
                    examples = matches[:3]  # Keep up to 3 examples

        if best_match:
            return FormatHint(
                element=element_name,
                pattern=best_match,
                confidence=best_confidence,
                examples=examples
            )
        return None

    def _determine_format_type(
        self,
        hints: list[FormatHint],
        issues: list[str]
    ) -> tuple[FormatType, float]:
        """Determine overall format type from hints."""
        if not hints:
            return FormatType.UNKNOWN, 0.0

        avg_confidence = sum(h.confidence for h in hints) / len(hints)

        # Check if all high-confidence patterns are standard
        all_standard = all(h.confidence >= 0.95 for h in hints)
        mostly_standard = all(h.confidence >= 0.8 for h in hints)

        if all_standard and len(hints) >= 2:
            return FormatType.STANDARD, avg_confidence
        elif mostly_standard and len(hints) >= 2:
            return FormatType.STANDARD_VARIANT, avg_confidence
        elif avg_confidence >= 0.5:
            return FormatType.CUSTOM, avg_confidence
        else:
            return FormatType.UNKNOWN, avg_confidence

    def _generate_config(self, hints: list[FormatHint]) -> dict:
        """Generate suggested YAML config from detected hints."""
        config = {
            'format_version': '1.0',
            'patterns': {},
            'detected_confidence': 0.0,
            'needs_review': True
        }

        total_confidence = 0.0
        for hint in hints:
            config['patterns'][hint.element] = {
                'pattern': hint.pattern,
                'confidence': hint.confidence,
                'examples': hint.examples
            }
            total_confidence += hint.confidence

        if hints:
            config['detected_confidence'] = total_confidence / len(hints)

        return config

    def is_standard_format(self, content: str) -> bool:
        """Quick check if content is standard format."""
        result = self.detect_format(content)
        return result.format_type == FormatType.STANDARD

    def get_format_summary(self, content: str) -> str:
        """Get a human-readable summary of detected format."""
        result = self.detect_format(content)

        lines = [
            f"Format Type: {result.format_type.value}",
            f"Confidence: {result.confidence:.1%}",
            "",
            "Detected Patterns:"
        ]

        for hint in result.hints:
            lines.append(f"  - {hint.element}: {hint.confidence:.1%} confidence")
            if hint.examples:
                lines.append(f"    Example: {hint.examples[0][:60]}...")

        if result.issues:
            lines.append("")
            lines.append("Issues:")
            for issue in result.issues:
                lines.append(f"  - {issue}")

        return '\n'.join(lines)
