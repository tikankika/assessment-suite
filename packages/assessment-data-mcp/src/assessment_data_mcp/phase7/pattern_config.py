"""
Pattern Config - Load and save Phase 7 parsing patterns from exam_config.yaml.

This module handles the "config path" for Q-file parsing patterns.
Teachers can confirm detected patterns, which are stored in exam_config.yaml
and reused for consistent parsing.

Storage location: exam_config.yaml under `phase7_patterns` section.

Example exam_config.yaml section:
```yaml
phase7_patterns:
  detected_at: "2026-01-19T14:30:00Z"
  confirmed_by: "TestTeacher"
  total_patterns:
    - pattern: '\\(\\s*(\\d+)\\s*/\\s*(\\d+)\\s*poäng\\)'
      example: "(8/10 poäng)"
      groups: [1, 2]  # group 1 = total, group 2 = max
    - pattern: '(\\d+)\\s*av\\s*(\\d+)\\s*poäng'
      example: "8 av 10 poäng"
      groups: [1, 2]
```
"""

from __future__ import annotations

import re
import yaml
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple

from ..constants.folders import PHASE6_ASSESSMENT


@dataclass
class TotalPattern:
    """A pattern for extracting total points."""
    pattern: str
    example: str
    groups: List[int]  # [total_group, max_group]
    confidence: float = 1.0  # Confirmed patterns have 1.0

    def compile(self) -> re.Pattern:
        """Compile the pattern to regex."""
        return re.compile(self.pattern)

    def extract(self, text: str) -> Optional[Tuple[float, float]]:
        """
        Extract total and max points from text.

        Returns:
            Tuple of (total_points, max_points) or None if no match
        """
        compiled = self.compile()
        match = compiled.search(text)
        if match:
            try:
                total_str = match.group(self.groups[0]).replace(',', '.')
                max_str = match.group(self.groups[1]).replace(',', '.')
                return (float(total_str), float(max_str))
            except (IndexError, ValueError):
                return None
        return None


@dataclass
class Phase7PatternConfig:
    """Configuration for Phase 7 parsing patterns."""
    detected_at: str = ""
    confirmed_by: str = ""
    total_patterns: List[TotalPattern] = field(default_factory=list)

    def has_patterns(self) -> bool:
        """Check if any patterns are configured."""
        return len(self.total_patterns) > 0


# Common patterns that Claude's free-text assessments might use
FALLBACK_PATTERNS = [
    TotalPattern(
        pattern=r'\((\d+(?:[.,]\d+)?)\s*/\s*(\d+(?:[.,]\d+)?)\s*(?:poäng|p)\)',
        example="(8/10 poäng)",
        groups=[1, 2],
        confidence=0.9
    ),
    TotalPattern(
        pattern=r'(\d+(?:[.,]\d+)?)\s*av\s*(\d+(?:[.,]\d+)?)\s*(?:poäng|p)',
        example="8 av 10 poäng",
        groups=[1, 2],
        confidence=0.8
    ),
    TotalPattern(
        pattern=r'Poäng:\s*(\d+(?:[.,]\d+)?)\s*/\s*(\d+(?:[.,]\d+)?)',
        example="Poäng: 8/10",
        groups=[1, 2],
        confidence=0.8
    ),
    TotalPattern(
        pattern=r'Score:\s*(\d+(?:[.,]\d+)?)\s*/\s*(\d+(?:[.,]\d+)?)',
        example="Score: 8/10",
        groups=[1, 2],
        confidence=0.7
    ),
    TotalPattern(
        pattern=r'(\d+(?:[.,]\d+)?)\s*poäng\s*av\s*(\d+(?:[.,]\d+)?)',
        example="8 poäng av 10",
        groups=[1, 2],
        confidence=0.7
    ),
    TotalPattern(
        pattern=r'Totalpoäng:\s*(\d+(?:[.,]\d+)?)\s*/\s*(\d+(?:[.,]\d+)?)',
        example="Totalpoäng: 8/10",
        groups=[1, 2],
        confidence=0.9
    ),
]


def load_pattern_config(project_path: Path) -> Optional[Phase7PatternConfig]:
    """
    Load Phase 7 patterns from exam_config.yaml.

    Args:
        project_path: Path to project root

    Returns:
        Phase7PatternConfig or None if not configured
    """
    config_path = project_path / "exam_config.yaml"
    if not config_path.exists():
        return None

    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)

        if not config or 'phase7_patterns' not in config:
            return None

        p7 = config['phase7_patterns']
        patterns = []

        for p in p7.get('total_patterns', []):
            patterns.append(TotalPattern(
                pattern=p['pattern'],
                example=p.get('example', ''),
                groups=p.get('groups', [1, 2]),
                confidence=p.get('confidence', 1.0)
            ))

        return Phase7PatternConfig(
            detected_at=p7.get('detected_at', ''),
            confirmed_by=p7.get('confirmed_by', ''),
            total_patterns=patterns
        )

    except Exception as e:
        print(f"Warning: Failed to load phase7_patterns from exam_config.yaml: {e}")
        return None


def save_pattern_config(
    project_path: Path,
    config: Phase7PatternConfig
) -> bool:
    """
    Save Phase 7 patterns to exam_config.yaml.

    Args:
        project_path: Path to project root
        config: Pattern configuration to save

    Returns:
        True if saved successfully
    """
    config_path = project_path / "exam_config.yaml"

    try:
        # Load existing config
        existing = {}
        if config_path.exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                existing = yaml.safe_load(f) or {}

        # Build phase7_patterns section
        patterns_data = {
            'detected_at': config.detected_at or datetime.now().isoformat(),
            'confirmed_by': config.confirmed_by,
            'total_patterns': [
                {
                    'pattern': p.pattern,
                    'example': p.example,
                    'groups': p.groups,
                    'confidence': p.confidence
                }
                for p in config.total_patterns
            ]
        }

        existing['phase7_patterns'] = patterns_data

        # Write back
        with open(config_path, 'w', encoding='utf-8') as f:
            yaml.dump(existing, f, default_flow_style=False, allow_unicode=True, sort_keys=False)

        return True

    except Exception as e:
        print(f"Error saving phase7_patterns to exam_config.yaml: {e}")
        return False


@dataclass
class PatternAnalysisResult:
    """Result of analyzing Q-files for patterns."""
    total_students: int = 0
    students_with_assessments: int = 0

    # Pattern match counts
    standard_format_count: int = 0  # **TOTAL: X/Yp**
    metadata_format_count: int = 0  # <!-- PHASE6_ASSESSMENT -->

    # Fallback pattern matches
    fallback_matches: Dict[str, int] = field(default_factory=dict)

    # Students that couldn't be parsed
    unparseable_students: List[str] = field(default_factory=list)

    # Suggested patterns (sorted by match count)
    suggested_patterns: List[TotalPattern] = field(default_factory=list)

    def format_summary(self) -> str:
        """Format as markdown summary."""
        lines = []
        lines.append("## Pattern Analysis Results")
        lines.append("")
        lines.append(f"**Total students with assessments:** {self.students_with_assessments}")
        lines.append("")
        lines.append("### Pattern Distribution")
        lines.append("")
        lines.append("| Pattern | Count | % |")
        lines.append("|---------|-------|---|")

        total = self.students_with_assessments or 1
        lines.append(f"| Standard (**TOTAL: X/Yp**) | {self.standard_format_count} | {self.standard_format_count/total*100:.0f}% |")
        lines.append(f"| Metadata (PHASE6_ASSESSMENT) | {self.metadata_format_count} | {self.metadata_format_count/total*100:.0f}% |")

        for pattern_name, count in sorted(self.fallback_matches.items(), key=lambda x: -x[1]):
            lines.append(f"| {pattern_name} | {count} | {count/total*100:.0f}% |")

        unparseable = len(self.unparseable_students)
        lines.append(f"| **Unparseable** | {unparseable} | {unparseable/total*100:.0f}% |")
        lines.append("")

        if self.suggested_patterns:
            lines.append("### Suggested Patterns for exam_config.yaml")
            lines.append("")
            lines.append("```yaml")
            lines.append("phase7_patterns:")
            lines.append(f"  detected_at: \"{datetime.now().isoformat()}\"")
            lines.append("  confirmed_by: \"\"  # Fill in your name")
            lines.append("  total_patterns:")
            for p in self.suggested_patterns[:5]:  # Top 5
                lines.append(f"    - pattern: '{p.pattern}'")
                lines.append(f"      example: \"{p.example}\"")
                lines.append(f"      groups: {p.groups}")
            lines.append("```")
            lines.append("")

        if self.unparseable_students:
            lines.append("### Unparseable Students")
            lines.append("")
            for sid in self.unparseable_students[:10]:  # Show first 10
                lines.append(f"- {sid}")
            if len(self.unparseable_students) > 10:
                lines.append(f"- ... and {len(self.unparseable_students) - 10} more")

        return '\n'.join(lines)


def analyze_patterns(
    project_path: Path,
    q_files_dir: str = PHASE6_ASSESSMENT
) -> PatternAnalysisResult:
    """
    Analyze Q-files to detect which patterns are used.

    Args:
        project_path: Path to project root
        q_files_dir: Directory containing Q-files

    Returns:
        PatternAnalysisResult with detailed breakdown
    """
    from .standard_parser import StandardParser, PATTERNS

    result = PatternAnalysisResult()
    q_dir = project_path / q_files_dir

    if not q_dir.exists():
        return result

    parser = StandardParser()

    # Pattern for PHASE6_ASSESSMENT metadata
    metadata_pattern = PATTERNS['phase6_metadata']
    total_pattern = PATTERNS['total_line']

    for q_file in sorted(q_dir.glob("Q*.md")):
        try:
            content = q_file.read_text(encoding='utf-8')
        except Exception:
            continue

        pr = parser.parse_file(q_file)

        for student in pr.students:
            if not student.assessment or not student.assessment.raw_text.strip():
                continue

            result.students_with_assessments += 1
            raw_text = student.assessment.raw_text

            # Check for standard format
            if total_pattern.search(raw_text):
                result.standard_format_count += 1
                continue

            # Check for metadata format
            if metadata_pattern.search(raw_text):
                result.metadata_format_count += 1
                continue

            # Try fallback patterns
            matched = False
            for fallback in FALLBACK_PATTERNS:
                extracted = fallback.extract(raw_text)
                if extracted:
                    pattern_name = fallback.example
                    result.fallback_matches[pattern_name] = result.fallback_matches.get(pattern_name, 0) + 1
                    matched = True
                    break

            if not matched:
                result.unparseable_students.append(student.student_id)

    result.total_students = result.students_with_assessments

    # Build suggested patterns from matches
    if result.fallback_matches:
        for fallback in FALLBACK_PATTERNS:
            if fallback.example in result.fallback_matches:
                result.suggested_patterns.append(fallback)
        result.suggested_patterns.sort(
            key=lambda p: result.fallback_matches.get(p.example, 0),
            reverse=True
        )

    return result
