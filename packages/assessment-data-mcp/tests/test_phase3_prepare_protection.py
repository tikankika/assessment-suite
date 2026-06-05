"""Tests for Phase 3 prepare force-overwrite protection."""

import json
import pytest
from pathlib import Path


@pytest.fixture
def project_dir(tmp_path):
    """Create a minimal project structure for phase3_prepare tests."""
    # project_state.json
    (tmp_path / "project_state.json").write_text(
        json.dumps({"current_phase": 2})
    )

    # Source files
    src_dir = tmp_path / "02_markdown" / "student_answers"
    src_dir.mkdir(parents=True)
    (src_dir / "stu1.md").write_text("1. Beskriv\n\nMitt svar.\n")
    (src_dir / "stu2.md").write_text("1. Beskriv\n\nAnnat svar.\n")

    return tmp_path


@pytest.fixture
def annotated_dest(project_dir):
    """Create destination with one annotated file and one plain file."""
    dest_dir = project_dir / "03_material" / "student_answers"
    dest_dir.mkdir(parents=True)

    # stu1: already annotated
    (dest_dir / "stu1.md").write_text(
        "0001 <!-- student: stu1 -->\n"
        "0002 \n"
        "<!-- phase3_q001_start -->\n"
        "0003 1. Beskriv\n"
        "0004 \n"
        "0005 Mitt svar.\n"
        "<!-- phase3_q001_end -->\n"
    )

    # stu2: prepared but NOT annotated
    (dest_dir / "stu2.md").write_text(
        "0001 <!-- student: stu2 -->\n"
        "0002 \n"
        "0003 1. Beskriv\n"
        "0004 \n"
        "0005 Annat svar.\n"
    )

    return project_dir


@pytest.mark.asyncio
async def test_force_protects_annotated_files(annotated_dest):
    """force=True should NOT overwrite files that have Phase 3 annotations."""
    from assessment_data_mcp.tools.phase3_prepare import phase3_prepare_tool

    result = await phase3_prepare_tool(
        project_path=str(annotated_dest),
        force=True,
    )

    assert result["success"] is True
    # stu1 should be protected (has annotations)
    assert "stu1.md" in result.get("protected_files", [])
    # stu2 should be overwritten (no annotations)
    assert "stu2.md" in result.get("copied_files", [])


@pytest.mark.asyncio
async def test_force_overwrite_annotations_bypasses_protection(annotated_dest):
    """force=True + force_overwrite_annotations=True should overwrite everything."""
    from assessment_data_mcp.tools.phase3_prepare import phase3_prepare_tool

    result = await phase3_prepare_tool(
        project_path=str(annotated_dest),
        force=True,
        force_overwrite_annotations=True,
    )

    assert result["success"] is True
    # Both files should be copied
    assert "stu1.md" in result["copied_files"]
    assert "stu2.md" in result["copied_files"]
    # No protected files
    assert result.get("files_protected", 0) == 0

    # The overwritten stu1 should NO LONGER have annotations
    dest = annotated_dest / "03_material" / "student_answers" / "stu1.md"
    content = dest.read_text()
    assert '<!-- phase3_q' not in content


@pytest.mark.asyncio
async def test_no_force_skips_existing(project_dir):
    """Without force, existing files are skipped."""
    from assessment_data_mcp.tools.phase3_prepare import phase3_prepare_tool

    # First run — creates files
    result1 = await phase3_prepare_tool(project_path=str(project_dir))
    assert result1["files_copied"] == 2

    # Second run — should skip
    result2 = await phase3_prepare_tool(project_path=str(project_dir))
    assert result2["files_copied"] == 0
    assert result2["files_skipped"] == 2
