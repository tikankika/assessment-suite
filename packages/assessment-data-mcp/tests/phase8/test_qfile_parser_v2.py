"""
Tests for extract_bedömning() v2 metadata support.

Verifies that the Phase 8 fallback parser can extract points from:
1. PHASE6_ASSESSMENT v2 metadata blocks (format_version: 2)
2. PHASE6_ASSESSMENT legacy metadata blocks
3. Bold-text **BEDÖMNING: X/Yp** (existing format)
"""

import pytest
from assessment_data_mcp.phase8.qfile_parser import extract_bedömning


class TestExtractBedömningV2:
    """Test v2 PHASE6_ASSESSMENT metadata extraction."""

    def test_extract_v2_metadata(self):
        """Should extract points from v2 metadata block."""
        section = """## Elev 100001 (47 ord)

Studentens svar här...

### BEDÖMNING:

**6a (Riktningar):** ✓✓✓ **2.0p** - Båda gaserna rätt

<!-- PHASE6_ASSESSMENT
student_id: 100001
total_points: 3.5
max_points: 5
assessed_by: Claude
assessed_at: 2026-02-28T10:00:00Z
format_version: 2
-->
"""
        earned, max_pts = extract_bedömning(section)
        assert earned == 3.5
        assert max_pts == 5.0

    def test_extract_v2_integer_points(self):
        """Should handle integer points in v2 metadata."""
        section = """## Elev 123456 (30 ord)

### BEDÖMNING:

<!-- PHASE6_ASSESSMENT
student_id: 123456
total_points: 4
max_points: 5
assessed_by: Claude
assessed_at: 2026-02-28T10:00:00Z
format_version: 2
-->
"""
        earned, max_pts = extract_bedömning(section)
        assert earned == 4.0
        assert max_pts == 5.0

    def test_extract_v2_null_points_falls_through(self):
        """Should fall through when v2 metadata has null points."""
        section = """## Elev 100001 (47 ord)

<!-- PHASE6_ASSESSMENT
student_id: 100001
total_points: null
max_points: null
assessed_by: Claude
assessed_at: 2026-02-28T10:00:00Z
format_version: 2
-->

**BEDÖMNING: 2/5p**
"""
        earned, max_pts = extract_bedömning(section)
        # Should fall through to bold-text pattern
        assert earned == 2.0
        assert max_pts == 5.0


class TestExtractBedömningLegacy:
    """Test legacy PHASE6_ASSESSMENT metadata extraction."""

    def test_extract_legacy_metadata(self):
        """Should extract points from legacy metadata block."""
        section = """## Elev 100001 (47 ord)

### BEDÖMNING:

<!-- PHASE6_ASSESSMENT
student_id: 100001
total_points: 3
max_points: 5
assessed_by: Claude
assessed_at: 2026-02-28T10:00:00Z
-->
"""
        earned, max_pts = extract_bedömning(section)
        assert earned == 3.0
        assert max_pts == 5.0

    def test_extract_legacy_decimal(self):
        """Should handle decimal points in legacy metadata."""
        section = """<!-- PHASE6_ASSESSMENT
student_id: 100001
total_points: 2.5
max_points: 5.0
assessed_by: Claude
assessed_at: 2026-02-28T10:00:00Z
-->
"""
        earned, max_pts = extract_bedömning(section)
        assert earned == 2.5
        assert max_pts == 5.0


class TestExtractBedömningBoldText:
    """Test existing bold-text fallback patterns still work."""

    def test_extract_bold_bedömning(self):
        """Should extract from **BEDÖMNING: X/Yp** format."""
        section = """## Elev 100001 (47 ord)

### BEDÖMNING:

**BEDÖMNING: 3/5p**

Bra svar.
"""
        earned, max_pts = extract_bedömning(section)
        assert earned == 3.0
        assert max_pts == 5.0

    def test_extract_bold_total(self):
        """Should extract from **TOTAL: X/Yp** format."""
        section = """## Elev 100001 (47 ord)

### BEDÖMNING:

**TOTAL: 4.5/5p**
"""
        earned, max_pts = extract_bedömning(section)
        assert earned == 4.5
        assert max_pts == 5.0

    def test_no_assessment_returns_zero(self):
        """Should return (0.0, 0.0) when no pattern matches."""
        section = """## Elev 100001 (47 ord)

Studentens svar utan bedömning.
"""
        earned, max_pts = extract_bedömning(section)
        assert earned == 0.0
        assert max_pts == 0.0
