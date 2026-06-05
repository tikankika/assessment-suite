"""
Phase 7: Student Report Generator

Reorganizes Q-file assessments from question-view to student-view.
Aggregates all assessments for each student into individual reports.

Components:
- standard_parser: Parse standard format Q-files (hardcoded patterns)
- intelligent_detector: Detect format variations using Claude
- config_parser: Load format config from YAML
- validator: Validate parsed data
- generator: Generate student reports (Phase 2)

See RFC-001 for full specification.
"""

from .standard_parser import (
    StandardParser,
    StudentAssessment,
    QuestionAssessment,
    AspectScore,
    ParseResult,
    PATTERNS,
)
from .intelligent_detector import (
    IntelligentDetector,
    FormatType,
    DetectionResult,
    FormatHint,
)
from .config_parser import (
    ConfigParser,
    FormatConfig,
    PatternConfig,
    generate_default_config,
    load_config,
)
from .validator import (
    Validator,
    ValidationResult,
    ValidationIssue,
    AnomalyReport,
    quick_validate,
)
from .generator import (
    StudentReportGenerator,
    StudentReport,
    GenerationResult,
    generate_reports,
)

__all__ = [
    # Standard parser
    'StandardParser',
    'StudentAssessment',
    'QuestionAssessment',
    'AspectScore',
    'ParseResult',
    'PATTERNS',
    # Intelligent detector
    'IntelligentDetector',
    'FormatType',
    'DetectionResult',
    'FormatHint',
    # Config parser
    'ConfigParser',
    'FormatConfig',
    'PatternConfig',
    'generate_default_config',
    'load_config',
    # Validator
    'Validator',
    'ValidationResult',
    'ValidationIssue',
    'AnomalyReport',
    'quick_validate',
    # Generator
    'StudentReportGenerator',
    'StudentReport',
    'GenerationResult',
    'generate_reports',
]
