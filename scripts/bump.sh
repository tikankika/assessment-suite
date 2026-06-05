#!/usr/bin/env bash
#
# bump.sh — Update version across all version-bearing locations in the monorepo
# (10 sed edits + 2 regenerated lock files). The root README.md and ROADMAP.md
# are deliberately version-less and are intentionally not touched.
#
# Usage:
#   ./scripts/bump.sh 0.7.0
#   ./scripts/bump.sh 0.6.2 --dry-run
#
set -euo pipefail

NEW_VERSION="${1:-}"
DRY_RUN=false
[[ "${2:-}" == "--dry-run" ]] && DRY_RUN=true

if [[ -z "$NEW_VERSION" ]]; then
  echo "Usage: ./scripts/bump.sh <version> [--dry-run]"
  echo "Example: ./scripts/bump.sh 0.7.0"
  exit 1
fi

# Validate semver format
if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: Version must be semver (e.g., 0.7.0)"
  exit 1
fi

# Find repo root (where this script lives in scripts/)
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

DATE_TODAY=$(date +%Y-%m-%d)

# All files and their sed patterns
declare -a FILES=(
  "packages/assessment-mcp/package.json"
  "packages/assessment-data-mcp/pyproject.toml"
  "CITATION.cff"
  "packages/assessment-mcp/src/server.ts"
  "packages/assessment-data-mcp/src/assessment_data_mcp/__init__.py"
  "packages/assessment-data-mcp/setup.py"
  "packages/assessment-mcp/README.md"
  "packages/assessment-mcp/docs/API.md"
  "packages/assessment-data-mcp/README.md"
  # Lock files are regenerated, not sed-edited (see step 12-13 below).
  # NOTE: root README.md and ROADMAP.md are deliberately version-less and are
  # NOT bumped (see step 7-9).
)

# --- Detect current version from package.json (source of truth) ---
CURRENT_VERSION=$(grep -o '"version": "[0-9]*\.[0-9]*\.[0-9]*"' packages/assessment-mcp/package.json | grep -o '[0-9]*\.[0-9]*\.[0-9]*')

if [[ -z "$CURRENT_VERSION" ]]; then
  echo "Error: Could not detect current version from package.json"
  exit 1
fi

echo "Bumping: $CURRENT_VERSION → $NEW_VERSION"
echo ""

if $DRY_RUN; then
  echo "[DRY RUN] Would update these files:"
  echo ""
fi

UPDATED=0
SKIPPED=0

update_file() {
  local file="$1"
  local pattern="$2"
  local replacement="$3"

  if [[ ! -f "$file" ]]; then
    echo "  SKIP  $file (not found)"
    SKIPPED=$((SKIPPED + 1))
    return
  fi

  if $DRY_RUN; then
    if grep -q "$pattern" "$file" 2>/dev/null; then
      echo "  WOULD $file"
    else
      echo "  SKIP  $file (pattern not found)"
    fi
  else
    if sed -i '' "s|$pattern|$replacement|g" "$file" 2>/dev/null; then
      echo "  OK    $file"
      UPDATED=$((UPDATED + 1))
    else
      echo "  FAIL  $file"
    fi
  fi
}

# 1. package.json — "version": "X.Y.Z"
update_file "packages/assessment-mcp/package.json" \
  "\"version\": \"$CURRENT_VERSION\"" \
  "\"version\": \"$NEW_VERSION\""

# 2. pyproject.toml — version = "X.Y.Z"
update_file "packages/assessment-data-mcp/pyproject.toml" \
  "^version = \"$CURRENT_VERSION\"" \
  "version = \"$NEW_VERSION\""

# 3. CITATION.cff — version + date-released
update_file "CITATION.cff" \
  "version: \"$CURRENT_VERSION\"" \
  "version: \"$NEW_VERSION\""
update_file "CITATION.cff" \
  "date-released: \"[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]\"" \
  "date-released: \"$DATE_TODAY\""

# 4. server.ts — version: 'X.Y.Z'
update_file "packages/assessment-mcp/src/server.ts" \
  "version: '[0-9]*\.[0-9]*\.[0-9]*'" \
  "version: '$NEW_VERSION'"

# 5. __init__.py — __version__ = "X.Y.Z"
update_file "packages/assessment-data-mcp/src/assessment_data_mcp/__init__.py" \
  "__version__ = \"[0-9]*\.[0-9]*\.[0-9]*\"" \
  "__version__ = \"$NEW_VERSION\""

# 6. setup.py — version="X.Y.Z"
update_file "packages/assessment-data-mcp/setup.py" \
  "version=\"[0-9]*\.[0-9]*\.[0-9]*\"" \
  "version=\"$NEW_VERSION\""

# 7-9. Package docs that carry a **Version:** line.
# NOTE: ROADMAP.md and the root README.md are deliberately version-less (the
# rewritten "two-door" README points to ROADMAP for versions, and ROADMAP
# describes maturity in prose, not a version number) — so they are intentionally
# NOT bumped here. Re-adding them would only produce false "pattern not found".
for doc in packages/assessment-mcp/README.md packages/assessment-mcp/docs/API.md packages/assessment-data-mcp/README.md; do
  update_file "$doc" \
    "\*\*Version:\*\* [0-9]*\.[0-9]*\.[0-9]*" \
    "**Version:** $NEW_VERSION"
done

# 12-13. Lock files (regenerated, not sed)
if ! $DRY_RUN; then
  echo ""
  echo "Regenerating lock files..."

  # uv.lock
  (cd packages/assessment-data-mcp && uv lock 2>&1 | tail -1)
  echo "  OK    packages/assessment-data-mcp/uv.lock"

  # package-lock.json
  (cd packages/assessment-mcp && npm install --package-lock-only 2>&1 | tail -1)
  echo "  OK    packages/assessment-mcp/package-lock.json"
fi

echo ""
if $DRY_RUN; then
  echo "Dry run complete. Run without --dry-run to apply."
else
  echo "Done! Updated $UPDATED files."
  echo ""
  echo "Verify:"
  echo "  grep -rn '$NEW_VERSION' packages/assessment-mcp/package.json packages/assessment-data-mcp/pyproject.toml CITATION.cff"
  echo ""
  echo "Next: review changes, then commit."
fi
