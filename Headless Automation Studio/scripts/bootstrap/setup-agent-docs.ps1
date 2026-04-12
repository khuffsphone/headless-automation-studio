#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Ensures all required agent workflow directories and files exist.
    Creates missing files with a stub placeholder. Does NOT overwrite existing files.

.USAGE
    .\scripts\bootstrap\setup-agent-docs.ps1
#>

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot ".." "..")).ToString()

$RequiredFiles = @(
    ".github/ISSUE_TEMPLATE/task.md",
    ".github/pull_request_template.md",
    "docs/orchestration/overview.md",
    "docs/orchestration/labels.md",
    "docs/orchestration/task-payload.schema.json",
    "docs/orchestration/agent-status-format.md",
    "docs/prompts/primary-builder.md",
    "docs/prompts/antigravity-scrutinizer.md",
    "docs/prompts/jules-finisher.md",
    "docs/setup/local-setup-checklist.md",
    "docs/setup/github-webhook-setup.md",
    "docs/setup/jules-api-setup.md",
    "docs/setup/antigravity-review-process.md",
    "scripts/bootstrap/setup-agent-docs.ps1",
    "scripts/bootstrap/setup-agent-docs.sh",
    "scripts/bootstrap/validate-agent-scaffold.ps1",
    "scripts/bootstrap/validate-agent-scaffold.sh",
    "n8n/workflows/README.md",
    "n8n/workflows/github-router.workflow.json",
    "n8n/workflows/pr-to-jules.workflow.json",
    "config/labels.json",
    "config/task-payload.example.json",
    "README.agent-workflow.md"
)

$Created = 0
$Skipped = 0

foreach ($RelPath in $RequiredFiles) {
    $FullPath = Join-Path $RepoRoot $RelPath
    $Dir = Split-Path $FullPath -Parent

    # Ensure parent directory exists
    if (-not (Test-Path $Dir)) {
        New-Item -ItemType Directory -Path $Dir -Force | Out-Null
        Write-Host "  [DIR]     Created directory: $Dir" -ForegroundColor DarkGray
    }

    if (Test-Path $FullPath) {
        Write-Host "  [SKIP]    Already exists:    $RelPath" -ForegroundColor DarkYellow
        $Skipped++
    } else {
        # Create a stub placeholder
        $StubContent = "# $RelPath`n`n> STUB: This file was created by setup-agent-docs.ps1. Replace with actual content.`n"
        Set-Content -Path $FullPath -Value $StubContent -Encoding UTF8
        Write-Host "  [CREATED] Created stub:        $RelPath" -ForegroundColor Green
        $Created++
    }
}

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Cyan
Write-Host "  Created: $Created  |  Skipped (already exist): $Skipped"
