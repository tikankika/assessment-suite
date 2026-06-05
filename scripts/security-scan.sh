#!/usr/bin/env bash
#
# security-scan.sh — Scan files for identifying information
#
# All patterns are built into this script. No external config file needed.
# Personal names are protected by rules (data-protection.md) and manual
# review, not by pattern matching — you cannot grep for unknown names.
#
# Usage:
#   ./scripts/security-scan.sh              # Scan staged files (pre-commit mode)
#   ./scripts/security-scan.sh --all        # Scan all tracked files
#   ./scripts/security-scan.sh --history    # Scan entire git history
#   ./scripts/security-scan.sh file1 file2  # Scan specific files
#
# Exit codes: 0 = clean, 1 = issues found

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
FOUND=0

# Colors (if terminal supports them)
if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  NC='\033[0m'
else
  RED='' GREEN='' NC=''
fi

# --- Patterns (shared with commit-msg and git-security.sh) ---

source "$(git rev-parse --show-toplevel)/scripts/security-patterns.sh"
PATTERNS=("${SECURITY_PATTERNS[@]}")
ALLOWLIST=("${SECURITY_ALLOWLIST[@]}")

# Files excluded from scanning (they may legitimately contain blocked terms)
EXCLUDED_PATHS=(
  '.claude/rules/'
  'scripts/security-scan.sh'
  'scripts/security-patterns.sh'
  'docs/rfcs/RFC-023'
)

# --- Determine which files to scan ---

MODE="staged"
FILES=()

if [ $# -gt 0 ]; then
  case "$1" in
    --all)
      MODE="all"
      ;;
    --history)
      MODE="history"
      ;;
    *)
      MODE="explicit"
      FILES=("$@")
      ;;
  esac
fi

is_excluded() {
  local file="$1"
  for excluded in "${EXCLUDED_PATHS[@]}"; do
    if echo "$file" | grep -q "$excluded" 2>/dev/null; then
      return 0
    fi
  done
  return 1
}

if [ "$MODE" = "staged" ]; then
  while IFS= read -r f; do
    [ -n "$f" ] && ! is_excluded "$f" && FILES+=("$f")
  done < <(git diff --cached --name-only --diff-filter=ACM 2>/dev/null | \
    grep -vE '\.(png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot|lock)$' | \
    grep -v 'package-lock.json')

  if [ ${#FILES[@]} -eq 0 ]; then
    exit 0
  fi
fi

if [ "$MODE" = "all" ]; then
  while IFS= read -r f; do
    [ -n "$f" ] && ! is_excluded "$f" && FILES+=("$f")
  done < <(git ls-files | \
    grep -vE '\.(png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot|lock)$' | \
    grep -v 'package-lock.json')
fi

# --- Scan functions ---

scan_history() {
  echo "Scanning git history (this may take a moment)..."
  echo ""

  local history_cache
  history_cache="$(git log --all -p 2>/dev/null)"

  for pattern in "${PATTERNS[@]}"; do
    local matches
    matches="$(echo "$history_cache" | grep -E "$pattern" 2>/dev/null || true)"

    # Filter allowlist
    for allow in "${ALLOWLIST[@]}"; do
      matches="$(echo "$matches" | grep -v "$allow" 2>/dev/null || true)"
    done

    local count
    count="$(echo "$matches" | grep -c . 2>/dev/null || true)"
    count="$(echo "$count" | tr -d '[:space:]')"
    if [ "$count" -gt 0 ] 2>/dev/null; then
      echo -e "${RED}FOUND${NC} in history: pattern \"$pattern\" ($count occurrences)"
      echo "$matches" | sort -u | head -3 | sed 's/^/  /'
      echo ""
      FOUND=1
    fi
  done
}

# --- Run scans ---

if [ "$MODE" = "history" ]; then
  scan_history
else
  for pattern in "${PATTERNS[@]}"; do
    for file in "${FILES[@]}"; do
      file_matches=""

      if [ "$MODE" = "staged" ]; then
        file_content="$(git show ":$file" 2>/dev/null)" || continue
        file_matches="$(echo "$file_content" | grep -nE "$pattern" 2>/dev/null)" || continue
      else
        [ -f "$file" ] || continue
        file_matches="$(grep -nE "$pattern" "$file" 2>/dev/null)" || continue
      fi

      # Filter allowlist
      filtered="$file_matches"
      for allow in "${ALLOWLIST[@]}"; do
        filtered="$(echo "$filtered" | grep -v "$allow" 2>/dev/null)" || true
      done

      if [ -n "$filtered" ]; then
        echo -e "${RED}BLOCKED${NC} [$pattern] in $file:"
        echo "$filtered" | head -5 | sed 's/^/  /'
        local_count="$(echo "$filtered" | wc -l | tr -d ' ')"
        if [ "$local_count" -gt 5 ]; then
          echo "  ... and $((local_count - 5)) more"
        fi
        FOUND=1
      fi
    done
  done
fi

# --- Report ---

echo ""
if [ "$FOUND" -eq 1 ]; then
  echo -e "${RED}SECURITY SCAN FAILED${NC} — identifying information found."
  echo "Fix the issues above."
  if [ "$MODE" = "staged" ]; then
    echo ""
    echo "To bypass (USE WITH CAUTION): git commit --no-verify"
  fi
  exit 1
else
  echo -e "${GREEN}Security scan passed${NC} — no identifying information found."
  exit 0
fi
