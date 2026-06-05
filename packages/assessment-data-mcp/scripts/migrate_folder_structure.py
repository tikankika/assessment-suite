#!/usr/bin/env python3
"""
RFC-018 + ADR-007: Migration script for folder restructure.

Old → New folder structure:
- 03_answers_by_question/ → 05_answers_by_question/
- 03_student_answers/ → 05_answers_by_question/  (ADR-007: production legacy)
- 04_student_reports/Bedomning_*.md → 07_analytic_student/Analytic_*.md
- 14_aterkoppling_till_elev/ → 14_student_feedback/  (ADR-007: standardize to English)
- Create 06_analytic_assessment/ (empty, for Phase 6 working copies)
- Create complete_assessment/Complete_*.md (with PHASE_7 markers)

⚠️ WARNING: This script is for CLEAN projects only!
   (Projects with Phase 7 only, no Phase 9-12 sections)

   If your project has Phase 9-12 sections, you must:
   - Option A: Manually migrate
   - Option B: Re-run Phase 9-12 after migration

Usage:
    python migrate_folder_structure.py /path/to/project [--dry-run] [--force]
"""

import sys
import shutil
from pathlib import Path
from datetime import datetime
import argparse

from assessment_data_mcp.constants.folders import (
    PHASE5_ANSWERS,
    PHASE6_ASSESSMENT,
    PHASE7_STUDENT,
    PHASE14_FEEDBACK,
    COMPLETE_ASSESSMENT,
    LEGACY_ANSWERS,
    LEGACY_STUDENT_ANSWERS,
    LEGACY_REPORTS,
    LEGACY_FEEDBACK,
)


def check_if_clean_project(project_path: Path) -> tuple[bool, list[str]]:
    """Check if project has only Phase 7 (no Phase 9-12 sections).

    Returns:
        Tuple of (is_clean, list of dirty markers found)
    """
    reports_dir = project_path / LEGACY_REPORTS

    if not reports_dir.exists():
        return True, []  # No reports yet, is clean

    # Check all report files
    dirty_markers = []
    report_files = list(reports_dir.glob("Bedomning_*.md"))

    for report_file in report_files:
        content = report_file.read_text(encoding='utf-8')

        # Check for Phase 9-12 markers
        for phase in [9, 10, 11, 12]:
            marker = f'<!-- PHASE_{phase}_START -->'
            if marker in content:
                dirty_markers.append(f"{report_file.name}: {marker}")

    return len(dirty_markers) == 0, dirty_markers


def migrate_project(project_path: Path, dry_run: bool = False, force: bool = False) -> None:
    """Migrate project to new folder structure."""

    print(f"\n{'='*60}")
    print(f"RFC-018 Migration: {project_path.name}")
    print(f"{'='*60}")

    # Verify project exists
    if not project_path.exists():
        print(f"❌ Error: Project path not found: {project_path}")
        sys.exit(1)

    # Check if already migrated
    if (project_path / "05_answers_by_question").exists():
        print("⚠️  Warning: Project appears to already be migrated (05_answers_by_question exists)")
        if not force:
            print("Use --force to re-run migration anyway")
            sys.exit(0)

    # Check if clean
    is_clean, dirty_markers = check_if_clean_project(project_path)

    if not is_clean:
        print("\n⚠️  WARNING: This project has Phase 9-12 sections!")
        print("This migration script is for CLEAN projects only.")
        print("\nFound markers:")
        for marker in dirty_markers[:5]:
            print(f"  - {marker}")
        if len(dirty_markers) > 5:
            print(f"  ... and {len(dirty_markers) - 5} more")
        print("\nOptions:")
        print("  A) Manually migrate")
        print("  B) Delete Phase 9-12 sections and re-run after migration")
        print("  C) Use --force to continue anyway (will lose Phase 9-12 data)")

        if not force:
            sys.exit(1)

        print("\n⚠️  Continuing with --force flag...")

    print(f"\nMode: {'DRY RUN' if dry_run else 'LIVE'}")
    print()

    # Migration steps
    old_qfiles = project_path / LEGACY_ANSWERS
    old_qfiles_alt = project_path / LEGACY_STUDENT_ANSWERS  # ADR-007: production legacy
    new_qfiles = project_path / PHASE5_ANSWERS
    assessment_dir = project_path / PHASE6_ASSESSMENT
    old_reports = project_path / LEGACY_REPORTS
    new_reports = project_path / PHASE7_STUDENT
    complete_dir = project_path / COMPLETE_ASSESSMENT
    old_feedback = project_path / LEGACY_FEEDBACK  # ADR-007: Swedish → English
    new_feedback = project_path / PHASE14_FEEDBACK

    # Step 1: Move Q-files 03 → 05
    # ADR-007: Also handle 03_student_answers (production legacy name)
    if not old_qfiles.exists() and old_qfiles_alt.exists():
        old_qfiles = old_qfiles_alt
    if old_qfiles.exists():
        print(f"1. Moving Q-files: {old_qfiles.name} → {new_qfiles.name}")
        if not dry_run:
            if new_qfiles.exists():
                shutil.rmtree(new_qfiles)
            shutil.move(str(old_qfiles), str(new_qfiles))
        print(f"   ✓ Done")
    else:
        print(f"1. Q-files directory not found: {old_qfiles.name} (skipping)")

    # Step 2: Create 06_analytic_assessment
    print(f"2. Creating assessment directory: {assessment_dir.name}")
    if not dry_run:
        assessment_dir.mkdir(parents=True, exist_ok=True)
    print(f"   ✓ Done")

    # Step 3: Move and rename reports 04 → 07
    if old_reports.exists():
        print(f"3. Moving and renaming reports: {old_reports.name} → {new_reports.name}")
        if not dry_run:
            new_reports.mkdir(parents=True, exist_ok=True)

        for old_file in old_reports.glob("Bedomning_*.md"):
            student_id = old_file.stem.replace("Bedomning_", "")
            new_file = new_reports / f"Analytic_{student_id}.md"
            print(f"   {old_file.name} → {new_file.name}")
            if not dry_run:
                # Read content and optionally update header
                content = old_file.read_text(encoding='utf-8')
                # Update header if it contains "Bedömning:"
                content = content.replace(
                    f"# Bedömning: Elev {student_id}",
                    f"# Analytic Assessment: Elev {student_id}"
                )
                new_file.write_text(content, encoding='utf-8')

        if not dry_run:
            # Remove old directory after successful migration
            shutil.rmtree(old_reports)
        print(f"   ✓ Done")
    else:
        print(f"3. Reports directory not found: {old_reports.name} (skipping)")

    # Step 4: Create complete_assessment with PHASE_7 markers
    if new_reports.exists() or old_reports.exists():
        reports_source = new_reports if new_reports.exists() else old_reports
        print(f"4. Creating complete_assessment with PHASE_7 markers")
        if not dry_run:
            complete_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime('%Y-%m-%d')

        for analytic_file in (new_reports if not dry_run else old_reports).glob("*.md"):
            if analytic_file.name.startswith("Analytic_"):
                student_id = analytic_file.stem.replace("Analytic_", "")
            elif analytic_file.name.startswith("Bedomning_"):
                student_id = analytic_file.stem.replace("Bedomning_", "")
            else:
                continue

            complete_file = complete_dir / f"Complete_{student_id}.md"
            print(f"   Creating {complete_file.name}")

            if not dry_run:
                analytic_content = analytic_file.read_text(encoding='utf-8')

                complete_content = f"""# Complete Assessment: Elev {student_id}

*Progressiv bedömning genom fas 7-12*
*Migrerad: {timestamp}*

---

<!-- PHASE_7_START -->
## PHASE 7: Grundläggande Bedömning

{analytic_content}
<!-- PHASE_7_END -->

---

<!-- CHANGELOG_START -->
## ÄNDRINGSLOGG

| Datum | Fas | Ändring |
|-------|-----|---------|
| {timestamp} | Migration | RFC-018 folder restructure |
| {timestamp} | Phase 7 | Grundbedömning (migrerad) |
<!-- CHANGELOG_END -->
"""
                complete_file.write_text(complete_content, encoding='utf-8')

        print(f"   ✓ Done")
    else:
        print(f"4. No reports to migrate to complete_assessment (skipping)")

    # Step 5: Rename 14_aterkoppling_till_elev → 14_student_feedback (ADR-007)
    if old_feedback.exists() and not new_feedback.exists():
        print(f"5. Renaming feedback directory: {old_feedback.name} → {new_feedback.name}")
        if not dry_run:
            shutil.move(str(old_feedback), str(new_feedback))
        print(f"   ✓ Done")
    elif old_feedback.exists() and new_feedback.exists():
        print(f"5. Both {old_feedback.name} and {new_feedback.name} exist (skipping — resolve manually)")
    else:
        print(f"5. No legacy feedback directory to rename (skipping)")

    # Summary
    print(f"\n{'='*60}")
    print(f"Migration {'DRY RUN ' if dry_run else ''}complete!")
    print(f"{'='*60}")

    if dry_run:
        print("\nThis was a dry run. No files were changed.")
        print("Run without --dry-run to apply changes.")
    else:
        print("\nNew folder structure:")
        print(f"  ✓ {new_qfiles.name}/ - Original Q-files")
        print(f"  ✓ {assessment_dir.name}/ - Phase 6 working copies (empty)")
        print(f"  ✓ {new_reports.name}/ - Analytic reports")
        print(f"  ✓ {complete_dir.name}/ - Complete assessments with Phase markers")


def main():
    parser = argparse.ArgumentParser(
        description="RFC-018: Migrate project folder structure",
        epilog="⚠️ This script is for CLEAN projects only (Phase 7 only, no Phase 9-12)"
    )
    parser.add_argument(
        "project_path",
        type=Path,
        help="Path to the assessment project to migrate"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without applying them"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force migration even for dirty projects (will lose Phase 9-12 data)"
    )

    args = parser.parse_args()

    migrate_project(
        project_path=args.project_path.resolve(),
        dry_run=args.dry_run,
        force=args.force
    )


if __name__ == "__main__":
    main()
