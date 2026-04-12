#!/usr/bin/env bash
# validate-agent-scaffold.sh
# Validates that all required agent workflow scaffold files and directories exist.
# Emits PASS/FAIL per item and exits non-zero if anything is missing.
#
# Usage: ./scripts/bootstrap/validate-agent-scaffold.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

REQUIRED_DIRECTORIES=(
  ".github"
  ".github/ISSUE_TEMPLATE"
  "docs"
  "docs/orchestration"
  "docs/prompts"
  "docs/setup"
  "scripts"
  "scripts/bootstrap"
  "n8n"
  "n8n/workflows"
  "config"
)

REQUIRED_FILES=(
  ".github/ISSUE_TEMPLATE/task.md"
  ".github/pull_request_template.md"
  "docs/orchestration/overview.md"
  "docs/orchestration/labels.md"
  "docs/orchestration/task-payload.schema.json"
  "docs/orchestration/agent-status-format.md"
  "docs/prompts/primary-builder.md"
  "docs/prompts/antigravity-scrutinizer.md"
  "docs/prompts/jules-finisher.md"
  "docs/setup/local-setup-checklist.md"
  "docs/setup/github-webhook-setup.md"
  "docs/setup/jules-api-setup.md"
  "docs/setup/antigravity-review-process.md"
  "scripts/bootstrap/setup-agent-docs.ps1"
  "scripts/bootstrap/setup-agent-docs.sh"
  "scripts/bootstrap/validate-agent-scaffold.ps1"
  "scripts/bootstrap/validate-agent-scaffold.sh"
  "n8n/workflows/README.md"
  "n8n/workflows/github-router.workflow.json"
  "n8n/workflows/pr-to-jules.workflow.json"
  "config/labels.json"
  "config/task-payload.example.json"
  "README.agent-workflow.md"
)

FAILURES=0

echo ""
echo "=== Agent Scaffold Validation ==="
echo ""

echo "-- Directories --"
for REL_DIR in "${REQUIRED_DIRECTORIES[@]}"; do
  FULL_PATH="$REPO_ROOT/$REL_DIR"
  if [ -d "$FULL_PATH" ]; then
    echo "  [PASS] DIR  $REL_DIR"
  else
    echo "  [FAIL] DIR  $REL_DIR"
    FAILURES=$((FAILURES + 1))
  fi
done

echo ""
echo "-- Files --"
for REL_FILE in "${REQUIRED_FILES[@]}"; do
  FULL_PATH="$REPO_ROOT/$REL_FILE"
  if [ -f "$FULL_PATH" ]; then
    echo "  [PASS] FILE $REL_FILE"
  else
    echo "  [FAIL] FILE $REL_FILE"
    FAILURES=$((FAILURES + 1))
  fi
done

echo ""
echo "================================="

if [ "$FAILURES" -eq 0 ]; then
  echo "All checks passed. Scaffold is complete."
  exit 0
else
  echo "$FAILURES item(s) missing. Run setup-agent-docs.sh to create stubs."
  exit 1
fi
