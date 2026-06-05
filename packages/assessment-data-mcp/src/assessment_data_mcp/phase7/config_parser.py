"""
Config Parser - Load and apply custom format configurations.

This module handles the "config path" for Q-files that use non-standard
formats. Format configurations are stored in YAML files and define
custom patterns for parsing.

Config Structure:
```yaml
format_version: "1.0"
patterns:
  student_header:
    pattern: "^## Elev ([A-Za-z0-9]+) \\(\\d+ ord\\)"
    groups:
      student_id: 1
  assessment_header:
    pattern: "^### ANALYTIC ASSESSMENT:"
  total_line:
    pattern: "^\\*\\*TOTAL:\\s*([\\d.,]+)/([\\d.,]+)p\\*\\*"
    groups:
      points: 1
      max_points: 2
```

See RFC-001 for full specification.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Optional, Union

try:
    import yaml
    YAML_AVAILABLE = True
except ImportError:
    yaml = None  # type: ignore
    YAML_AVAILABLE = False

from .standard_parser import (
    AspectScore,
    ParseResult,
    QuestionAssessment,
    StudentAssessment,
)


@dataclass
class PatternConfig:
    """Configuration for a single pattern."""
    pattern: re.Pattern
    groups: dict[str, int] = field(default_factory=dict)
    optional: bool = False


@dataclass
class FormatConfig:
    """Complete format configuration."""
    version: str
    patterns: dict[str, PatternConfig] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_yaml(cls, yaml_content: str) -> 'FormatConfig':
        """Create config from YAML string."""
        if not YAML_AVAILABLE:
            raise ImportError("PyYAML is required for YAML config parsing. Install with: pip install pyyaml")
        data = yaml.safe_load(yaml_content)
        return cls.from_dict(data)

    @classmethod
    def from_dict(cls, data: dict) -> 'FormatConfig':
        """Create config from dictionary."""
        version = data.get('format_version', '1.0')
        patterns = {}

        for name, pattern_data in data.get('patterns', {}).items():
            if isinstance(pattern_data, str):
                # Simple pattern string
                patterns[name] = PatternConfig(
                    pattern=re.compile(pattern_data)
                )
            elif isinstance(pattern_data, dict):
                # Full pattern config
                patterns[name] = PatternConfig(
                    pattern=re.compile(pattern_data['pattern']),
                    groups=pattern_data.get('groups', {}),
                    optional=pattern_data.get('optional', False)
                )

        metadata = {k: v for k, v in data.items()
                    if k not in ('format_version', 'patterns')}

        return cls(
            version=version,
            patterns=patterns,
            metadata=metadata
        )


class ConfigParser:
    """
    Parser using custom format configuration.

    Usage:
        config = FormatConfig.from_yaml(yaml_content)
        parser = ConfigParser(config)
        result = parser.parse_content(content, "Q6")
    """

    def __init__(self, config: FormatConfig) -> None:
        """Initialize with format configuration."""
        self.config = config

    @classmethod
    def from_file(cls, config_path: str | Path) -> 'ConfigParser':
        """Create parser from YAML config file."""
        config_path = Path(config_path)
        content = config_path.read_text(encoding='utf-8')
        config = FormatConfig.from_yaml(content)
        return cls(config)

    def parse_file(self, file_path: str | Path) -> ParseResult:
        """Parse Q-file using custom config."""
        file_path = Path(file_path)
        question_id = self._extract_question_id(file_path.name)

        try:
            content = file_path.read_text(encoding='utf-8')
        except Exception as e:
            result = ParseResult(question_id=question_id)
            result.errors.append(f"Failed to read file: {e}")
            return result

        return self.parse_content(content, question_id)

    def parse_content(self, content: str, question_id: str = "unknown") -> ParseResult:
        """Parse content using custom config."""
        result = ParseResult(question_id=question_id)
        lines = content.split('\n')

        # Get patterns from config
        student_pattern = self._get_pattern('student_header')
        assessment_pattern = self._get_pattern('assessment_header')
        total_pattern = self._get_pattern('total_line')
        next_step_pattern = self._get_pattern('next_step')

        if not student_pattern:
            result.errors.append("Config missing required 'student_header' pattern")
            return result

        # Find all student sections
        student_indices = []
        for i, line in enumerate(lines):
            match = student_pattern.match(line)
            if match:
                student_indices.append((i, match))

        if not student_indices:
            result.warnings.append("No students found in content")
            return result

        # Parse each student section
        for i, (start_idx, header_match) in enumerate(student_indices):
            if i + 1 < len(student_indices):
                end_idx = student_indices[i + 1][0]
            else:
                end_idx = len(lines)

            section_lines = lines[start_idx:end_idx]

            # Extract student ID from configured group
            student_id_group = self.config.patterns.get('student_header', PatternConfig(
                pattern=re.compile('')
            )).groups.get('student_id', 1)
            student_id = header_match.group(student_id_group) if header_match.lastindex and header_match.lastindex >= student_id_group else f"student_{i}"

            # Extract word count if available
            word_count_group = self.config.patterns.get('student_header', PatternConfig(
                pattern=re.compile('')
            )).groups.get('word_count', 2)
            try:
                word_count = int(header_match.group(word_count_group)) if header_match.lastindex and header_match.lastindex >= word_count_group else 0
            except (IndexError, ValueError):
                word_count = 0

            student = StudentAssessment(
                student_id=student_id,
                word_count=word_count,
                answer_text="",
                line_start=start_idx,
                line_end=end_idx
            )

            # Find assessment section
            assessment_start = None
            if assessment_pattern:
                for j, line in enumerate(section_lines):
                    if assessment_pattern.match(line):
                        assessment_start = j
                        break

            if assessment_start is None:
                student.answer_text = '\n'.join(section_lines[1:]).strip()
            else:
                student.answer_text = '\n'.join(section_lines[1:assessment_start]).strip()

                # Parse assessment
                assessment = QuestionAssessment(question_id=question_id)
                assessment.raw_text = '\n'.join(section_lines[assessment_start:])

                for line in section_lines[assessment_start:]:
                    # Try total pattern
                    if total_pattern:
                        total_match = total_pattern.match(line)
                        if total_match:
                            points_group = self.config.patterns.get('total_line', PatternConfig(
                                pattern=re.compile('')
                            )).groups.get('points', 1)
                            max_group = self.config.patterns.get('total_line', PatternConfig(
                                pattern=re.compile('')
                            )).groups.get('max_points', 2)
                            try:
                                assessment.total_points = float(
                                    total_match.group(points_group).replace(',', '.')
                                )
                                assessment.max_points = float(
                                    total_match.group(max_group).replace(',', '.')
                                )
                            except (IndexError, ValueError):
                                pass

                    # Try next step pattern
                    if next_step_pattern:
                        next_match = next_step_pattern.match(line)
                        if next_match:
                            feedback_group = self.config.patterns.get('next_step', PatternConfig(
                                pattern=re.compile('')
                            )).groups.get('feedback', 1)
                            try:
                                assessment.next_step = next_match.group(feedback_group)
                            except (IndexError, ValueError):
                                pass

                student.assessment = assessment

            result.students.append(student)

        return result

    def _get_pattern(self, name: str) -> Optional[re.Pattern]:
        """Get compiled pattern by name."""
        if name in self.config.patterns:
            return self.config.patterns[name].pattern
        return None

    def _extract_question_id(self, filename: str) -> str:
        """Extract question ID from filename."""
        match = re.match(r'^(Q\d+[a-z]?)', filename, re.IGNORECASE)
        if match:
            return match.group(1).upper()
        match = re.search(r'(\d+)', filename)
        if match:
            return f"Q{match.group(1)}"
        return "Q?"


def generate_default_config() -> str:
    """Generate default YAML config for standard format."""
    config = """# Phase 7 Format Configuration
# This file defines patterns for parsing Q-files

format_version: "1.0"

patterns:
  student_header:
    pattern: "^## Elev ([A-Za-z0-9]+) \\\\(\\\\d+ ord\\\\)"
    groups:
      student_id: 1
      word_count: 2

  assessment_header:
    pattern: "^### (ANALYTIC ASSESSMENT|BEDÖMNING):"

  aspect_line:
    pattern: "^\\\\*\\\\*(.+?):\\\\*\\\\*\\\\s*([✓✗⚠\\\\-]+)\\\\s*\\\\*\\\\*([\\\\d.,]+)p\\\\*\\\\*\\\\s*-\\\\s*(.+)$"
    groups:
      name: 1
      symbol: 2
      points: 3
      comment: 4

  total_line:
    pattern: "^\\\\*\\\\*TOTAL:\\\\s*([\\\\d.,]+)/([\\\\d.,]+)p\\\\*\\\\*"
    groups:
      points: 1
      max_points: 2

  next_step:
    pattern: "^\\\\*\\\\*→\\\\s*(Next step|Nästa steg):\\\\*\\\\*\\\\s*(.+)$"
    groups:
      label: 1
      feedback: 2

  separator:
    pattern: "^---\\\\s*$"
    optional: true
"""
    return config


def load_config(project_path: str | Path) -> Optional[FormatConfig]:
    """
    Load format config from project.

    Looks for config in standard locations:
    - {project_path}/.assessment/format_config.yaml
    - {project_path}/format_config.yaml
    """
    project_path = Path(project_path)

    # Standard locations to check
    config_locations = [
        project_path / '.assessment' / 'format_config.yaml',
        project_path / 'format_config.yaml',
    ]

    for config_path in config_locations:
        if config_path.exists():
            try:
                content = config_path.read_text(encoding='utf-8')
                return FormatConfig.from_yaml(content)
            except Exception:
                continue

    return None
