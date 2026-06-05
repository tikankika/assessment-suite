"""
ADR-007: Canonical folder names — single source of truth.

All project directory names are defined here. Never hardcode folder names
elsewhere; import from this module instead.
"""

# Current folder names, keyed by phase
PHASE1_ORIGINAL       = "01_original"
PHASE2_MARKDOWN       = "02_markdown"
PHASE3_MATERIAL       = "03_material"
PHASE4_RUBRIC         = "04_rubric"
PHASE5_ANSWERS        = "05_answers_by_question"
PHASE6_ASSESSMENT     = "06_analytic_assessment"
PHASE7_STUDENT        = "07_analytic_student"
PHASE8_QUANTITATIVE   = "08_quantitative"
PHASE9_QUALITATIVE    = "09_qualitative"
PHASE10_EXTRAPOLATION = "10_extrapolation"
PHASE11_GRADING       = "11_grading"
PHASE12_FEEDBACK      = "12_feedback"
PHASE13_SUMMARY       = "13_teacher_summary"
PHASE14_FEEDBACK      = "14_student_feedback"
COMPLETE_ASSESSMENT   = "complete_assessment"
METHODOLOGY           = "methodology"

# Legacy folder names kept for migration and backwards compatibility
LEGACY_CONVERTED       = "02_converted"
LEGACY_ANSWERS         = "03_answers_by_question"
LEGACY_STUDENT_ANSWERS = "03_student_answers"
LEGACY_REPORTS         = "04_student_reports"
LEGACY_FEEDBACK        = "14_aterkoppling_till_elev"

# All known folder names (current + legacy)
ALL_KNOWN_FOLDERS = [
    PHASE1_ORIGINAL,
    PHASE2_MARKDOWN,
    PHASE3_MATERIAL,
    PHASE4_RUBRIC,
    PHASE5_ANSWERS,
    PHASE6_ASSESSMENT,
    PHASE7_STUDENT,
    PHASE8_QUANTITATIVE,
    PHASE9_QUALITATIVE,
    PHASE10_EXTRAPOLATION,
    PHASE11_GRADING,
    PHASE12_FEEDBACK,
    PHASE13_SUMMARY,
    PHASE14_FEEDBACK,
    COMPLETE_ASSESSMENT,
    METHODOLOGY,
    LEGACY_CONVERTED,
    LEGACY_ANSWERS,
    LEGACY_STUDENT_ANSWERS,
    LEGACY_REPORTS,
    LEGACY_FEEDBACK,
]
