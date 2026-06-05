#!/usr/bin/env python3
"""
Cleanup script for Q-files with malformed BEDÖMNING sections.

Fixes:
1. Double ### BEDÖMNING: headers
2. Double --- separators

Usage:
    python3 cleanup_qfiles.py /path/to/06_analytic_assessment/
"""

import re
import sys
from pathlib import Path


def cleanup_content(content: str) -> tuple[str, dict]:
    """Apply regex fixes to Q-file content."""

    # Count issues before
    double_headers = len(re.findall(
        r'### BEDÖMNING:\s*\n### BEDÖMNING: [A-Za-z]+\d+ \(\d+\.?\d*/\d+p\)',
        content
    ))
    double_seps = len(re.findall(r'---\s*\n\s*---', content))

    # Fix 1: Remove double BEDÖMNING headers
    # Matches: "### BEDÖMNING:\n### BEDÖMNING: StudentId (X/Yp)"
    # Replaces with: "### BEDÖMNING: StudentId (X/Yp)"
    content = re.sub(
        r'### BEDÖMNING:\s*\n(### BEDÖMNING: [A-Za-z]+\d+ \(\d+\.?\d*/\d+p\))',
        r'\1',
        content
    )

    # Fix 2: Remove double --- separators
    content = re.sub(r'---\s*\n\s*---', '---', content)

    stats = {
        'headers_fixed': double_headers,
        'separators_fixed': double_seps,
    }

    return content, stats


def process_file(filepath: Path, dry_run: bool = False) -> dict:
    """Process a single Q-file."""
    content = filepath.read_text(encoding='utf-8')
    fixed_content, stats = cleanup_content(content)

    if not dry_run and (stats['headers_fixed'] > 0 or stats['separators_fixed'] > 0):
        filepath.write_text(fixed_content, encoding='utf-8')

    return stats


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 cleanup_qfiles.py /path/to/06_analytic_assessment/")
        print("\nOptions:")
        print("  --dry-run    Show what would be fixed without making changes")
        sys.exit(1)

    target_dir = Path(sys.argv[1])
    dry_run = '--dry-run' in sys.argv

    if not target_dir.exists():
        print(f"Error: Directory not found: {target_dir}")
        sys.exit(1)

    q_files = sorted(target_dir.glob("Q*.md"))

    if not q_files:
        print(f"No Q-files found in {target_dir}")
        sys.exit(1)

    print(f"{'[DRY RUN] ' if dry_run else ''}Processing {len(q_files)} Q-files...")
    print()

    total_headers = 0
    total_seps = 0

    for qfile in q_files:
        stats = process_file(qfile, dry_run=dry_run)
        total_headers += stats['headers_fixed']
        total_seps += stats['separators_fixed']

        if stats['headers_fixed'] > 0 or stats['separators_fixed'] > 0:
            status = "would fix" if dry_run else "fixed"
            print(f"  {qfile.name}: {status} {stats['headers_fixed']} headers, {stats['separators_fixed']} separators")
        else:
            print(f"  {qfile.name}: OK (no issues)")

    print()
    print(f"{'Would fix' if dry_run else 'Fixed'}: {total_headers} double headers, {total_seps} double separators")

    if dry_run and (total_headers > 0 or total_seps > 0):
        print("\nRun without --dry-run to apply fixes.")


if __name__ == "__main__":
    main()
