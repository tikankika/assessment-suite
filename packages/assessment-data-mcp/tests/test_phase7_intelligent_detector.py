"""
Tests for Phase 7 Intelligent Detector

Tests format detection for Q-files.
"""

import pytest

from assessment_data_mcp.phase7.intelligent_detector import (
    IntelligentDetector,
    FormatType,
    DetectionResult,
    FormatHint,
)


# Sample content in standard format
STANDARD_FORMAT = """## Elev 100001 (47 ord)

Test answer.

### ANALYTIC ASSESSMENT:
**6a:** ✓✓✓ **2.0p** - Good
**6b:** ✓ **0.5p** - OK

**TOTAL: 2.5/5p**
**→ Next step:** Practice more.

---
"""

# Sample content with variant format (Swedish header)
VARIANT_FORMAT = """## Elev 100001 (47 ord)

Test answer.

### BEDÖMNING:
**6a:** ✓✓✓ **2.0p** - Good

**TOTAL: 2.5/5p**
**→ Nästa steg:** Öva mer.

---
"""

# Sample content with custom format
CUSTOM_FORMAT = """### Student 100001

Test answer.

## Assessment
**Score: 2.5/5**

Next: Practice more.
"""

# Sample content with unknown format
UNKNOWN_FORMAT = """Some random content
That doesn't match
Any expected patterns.
"""


class TestFormatDetection:
    """Test format detection."""

    def test_detect_standard_format(self):
        """Test detection of standard format."""
        detector = IntelligentDetector()
        result = detector.detect_format(STANDARD_FORMAT)

        assert result.format_type == FormatType.STANDARD
        assert result.confidence >= 0.8

    def test_detect_variant_format(self):
        """Test detection of variant format (Swedish)."""
        detector = IntelligentDetector()
        result = detector.detect_format(VARIANT_FORMAT)

        # Should be STANDARD or STANDARD_VARIANT
        assert result.format_type in (FormatType.STANDARD, FormatType.STANDARD_VARIANT)
        assert result.confidence >= 0.8

    def test_detect_custom_format(self):
        """Test detection of custom format."""
        detector = IntelligentDetector()
        result = detector.detect_format(CUSTOM_FORMAT)

        # Custom format should have lower confidence
        assert result.format_type in (FormatType.CUSTOM, FormatType.UNKNOWN)

    def test_detect_unknown_format(self):
        """Test detection of unknown format."""
        detector = IntelligentDetector()
        result = detector.detect_format(UNKNOWN_FORMAT)

        assert result.format_type == FormatType.UNKNOWN
        assert len(result.issues) > 0


class TestFormatHints:
    """Test format hint extraction."""

    def test_hints_contain_student_header(self):
        """Test that hints include student header pattern."""
        detector = IntelligentDetector()
        result = detector.detect_format(STANDARD_FORMAT)

        hint_elements = [h.element for h in result.hints]
        assert "student_header" in hint_elements

    def test_hints_contain_assessment_header(self):
        """Test that hints include assessment header pattern."""
        detector = IntelligentDetector()
        result = detector.detect_format(STANDARD_FORMAT)

        hint_elements = [h.element for h in result.hints]
        assert "assessment_header" in hint_elements

    def test_hint_examples(self):
        """Test that hints include examples."""
        detector = IntelligentDetector()
        result = detector.detect_format(STANDARD_FORMAT)

        for hint in result.hints:
            if hint.confidence > 0.5:
                # High confidence hints should have examples
                assert len(hint.examples) > 0


class TestSuggestedConfig:
    """Test suggested config generation."""

    def test_suggested_config_for_custom(self):
        """Test that custom formats get suggested config."""
        detector = IntelligentDetector()
        result = detector.detect_format(CUSTOM_FORMAT)

        if result.format_type in (FormatType.CUSTOM, FormatType.STANDARD_VARIANT):
            assert result.suggested_config is not None
            assert 'patterns' in result.suggested_config

    def test_suggested_config_patterns(self):
        """Test that suggested config contains detected patterns."""
        detector = IntelligentDetector()
        result = detector.detect_format(STANDARD_FORMAT)

        if result.suggested_config:
            patterns = result.suggested_config.get('patterns', {})
            for hint in result.hints:
                assert hint.element in patterns


class TestHelperMethods:
    """Test helper methods."""

    def test_is_standard_format(self):
        """Test quick standard format check."""
        detector = IntelligentDetector()

        assert detector.is_standard_format(STANDARD_FORMAT) is True
        assert detector.is_standard_format(UNKNOWN_FORMAT) is False

    def test_get_format_summary(self):
        """Test human-readable summary."""
        detector = IntelligentDetector()
        summary = detector.get_format_summary(STANDARD_FORMAT)

        assert "Format Type:" in summary
        assert "Confidence:" in summary
        assert "Detected Patterns:" in summary


class TestMultipleStudents:
    """Test detection with multiple students."""

    def test_multiple_students_increases_confidence(self):
        """Test that more students increase confidence."""
        single = """## Elev 111 (10 ord)

Test.

### ANALYTIC ASSESSMENT:
**a:** ✓ **1p** - OK

**TOTAL: 1/2p**
**→ Next step:** More.

---
"""

        multiple = single + """## Elev 222 (20 ord)

Another test.

### ANALYTIC ASSESSMENT:
**a:** ✓✓ **2p** - Good

**TOTAL: 2/2p**
**→ Next step:** Continue.

---

## Elev 333 (15 ord)

Third test.

### ANALYTIC ASSESSMENT:
**a:** ✓ **1p** - OK

**TOTAL: 1/2p**
**→ Next step:** Practice.

---
"""

        detector = IntelligentDetector()

        result_single = detector.detect_format(single)
        result_multiple = detector.detect_format(multiple)

        # Multiple students should give same or higher confidence
        assert result_multiple.confidence >= result_single.confidence
