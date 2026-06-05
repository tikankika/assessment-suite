#!/usr/bin/env bash
# Shared security patterns — sourced by security-scan.sh, commit-msg, and git-security.sh
# Single source of truth for identifying-information patterns.

SECURITY_PATTERNS=(
  '/Users/[a-zA-Z][a-zA-Z0-9_-]+/'     # macOS home paths
  '/home/[a-zA-Z][a-zA-Z0-9_-]+/'      # Linux home paths
  'C:\\Users\\[a-zA-Z]'                  # Windows home paths
  '(19|20)[0-9]{6}-[0-9]{4}'            # Swedish personnummer (YYYYMMDD-XXXX)
)

SECURITY_ALLOWLIST=(
  '/Users/yourname/'                     # Generic placeholder in docs
  '/Users/username/'                     # Generic placeholder in tool descriptions
  '/Users/you/'                          # Generic placeholder in GETTING_STARTED
  '/home/user/'                          # Generic placeholder in docs/tests
  '/home/username/'                      # Generic placeholder in docs
)
