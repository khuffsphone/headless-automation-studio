#!/usr/bin/env bash
# setup-agent-docs.sh
# Ensures all required agent workflow directories and files exist.
# Creates missing files with a stub placeholder. Does NOT overwrite existing files.
#
# Usage: ./scripts/bootstrap/setup-agent-docs.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

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

CREATED=0
SKIPPED=0

for REL_PATH in "${REQUIRED_FILES[@]}"; do
  FULL_PATH="$REPO_ROOT/$REL_PATH"
  DIR="$(dirname "$FULL_PATH")"

  # Ensure parent directory exists
  if [ ! -d "$DIR" ]; then
    mkdir -p "$DIR"
    echo "  [DIR]     Created directory: $DIR"
  fi

  if [ -f "$FULL_PATH" ]; then
    echo "  [SKIP]    Already exists:    $REL_PATH"
    SKIPPED=$((SKIPPED + 1))
  else
    # Create a stub placeholder
    printf "# %s\n\n> STUB: This file was created by setup-agent-docs.sh. Replace with actual content.\n" \
      "$REL_PATH" > "$FULL_PATH"
    echo "  [CREATED] Created stub:        $REL_PATH"
    CREATED=$((CREATED + 1))
  fi
done

echo ""
echo "Setup complete."
echo "  Created: $CREATED  |  Skipped (already exist): $SKIPPED"
