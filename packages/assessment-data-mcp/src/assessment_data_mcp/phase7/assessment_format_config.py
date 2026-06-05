"""
Phase 6-post Assessment Format Configuration

Reader for assessment_format section in exam_config.yaml
Used by Phase 7 to determine how to parse Q-file assessments.

RFC-022: Separation of format detection (Phase 6-post) from report generation (Phase 7)

Supports per-question patterns since different Q-files may have different formats.
"""

from pathlib import Path
from typing import Optional, Literal, Dict
from dataclasses import dataclass, field
import yaml


@dataclass
class QuestionFormat:
    """Format configuration for a single question"""
    points_pattern: str  # Regex to extract points for this question


@dataclass
class AssessmentFormatV2:
    """v2 standard format with HTML comment markers"""
    type: Literal['v2']
    confirmed_by: str
    confirmed_at: str


@dataclass
class AssessmentFormatLegacy:
    """Legacy format with markdown headers - supports per-question patterns"""
    type: Literal['legacy']
    legacy_header: str
    student_id_pattern: str
    confirmed_by: str
    confirmed_at: str
    # Per-question patterns (Q001, Q002, etc.)
    questions: Dict[str, QuestionFormat] = field(default_factory=dict)
    # Fallback pattern if question not in dict
    default_points_pattern: Optional[str] = None

    def get_points_pattern(self, question_id: str) -> Optional[str]:
        """Get points pattern for a specific question"""
        if question_id in self.questions:
            return self.questions[question_id].points_pattern
        return self.default_points_pattern


AssessmentFormat = AssessmentFormatV2 | AssessmentFormatLegacy


def load_assessment_format(project_path: Path) -> Optional[AssessmentFormat]:
    """
    Load assessment format configuration from exam_config.yaml

    Args:
        project_path: Path to project root

    Returns:
        AssessmentFormat object or None if not configured

    Example yaml structure:
        assessment_format:
          type: 'legacy'
          legacy_header: '### BEDÖMNING:'
          student_id_pattern: '### BEDÖMNING:\s*(\S+)'
          questions:
            Q001:
              points_pattern: '\*\*TOTALPOÄNG:\s*(\d+)/(\d+)p\*\*'
            Q002:
              points_pattern: '\((\d+)/(\d+)p\)'
          default_points_pattern: '\((\d+)/(\d+)p\)'  # fallback
          confirmed_by: 'TestTeacher'
          confirmed_at: '2026-01-20T22:30:00'
    """
    config_path = project_path / "exam_config.yaml"

    if not config_path.exists():
        return None

    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)

        if not config or 'assessment_format' not in config:
            return None

        fmt = config['assessment_format']

        if fmt['type'] == 'v2':
            return AssessmentFormatV2(
                type='v2',
                confirmed_by=fmt.get('confirmed_by', 'unknown'),
                confirmed_at=fmt.get('confirmed_at', '')
            )
        elif fmt['type'] == 'legacy':
            # Parse per-question patterns
            questions: Dict[str, QuestionFormat] = {}
            if 'questions' in fmt:
                for q_id, q_config in fmt['questions'].items():
                    questions[q_id] = QuestionFormat(
                        points_pattern=q_config.get('points_pattern', '')
                    )

            # Support old format with single points_pattern (backwards compatibility)
            default_pattern = fmt.get('default_points_pattern') or fmt.get('points_pattern')

            return AssessmentFormatLegacy(
                type='legacy',
                legacy_header=fmt['legacy_header'],
                student_id_pattern=fmt['student_id_pattern'],
                confirmed_by=fmt.get('confirmed_by', 'unknown'),
                confirmed_at=fmt.get('confirmed_at', ''),
                questions=questions,
                default_points_pattern=default_pattern
            )
        else:
            return None

    except Exception as e:
        print(f"Error loading assessment format: {e}")
        return None


def has_assessment_format(project_path: Path) -> bool:
    """
    Quick check if assessment format is configured

    Args:
        project_path: Path to project root

    Returns:
        True if format is configured, False otherwise
    """
    return load_assessment_format(project_path) is not None
