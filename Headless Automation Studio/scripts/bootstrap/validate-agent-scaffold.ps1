#!/usr/bin/env powershell
<#
.SYNOPSIS
    Validates that all required agent workflow scaffold files and directories exist.
    Emits PASS/FAIL per item and exits non-zero if anything is missing.

.USAGE
    .\scripts\bootstrap\validate-agent-scaffold.ps1
#>

$ErrorActionPreference = "Continue"

# Compute repo root from script location (scripts/bootstrap -> repo root is two levels up)
$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot   = [System.IO.Path]::GetFullPath((Join-Path $ScriptDir "..\.." ))

$RequiredDirectories = @(
    ".github",
    ".github\ISSUE_TEMPLATE",
    "docs",
    "docs\orchestration",
    "docs\prompts",
    "docs\setup",
    "scripts",
    "scripts\bootstrap",
    "n8n",
    "n8n\workflows",
    "config"
)

$RequiredFiles = @(
    ".github\ISSUE_TEMPLATE\task.md",
    ".github\pull_request_template.md",
    "docs\orchestration\overview.md",
    "docs\orchestration\labels.md",
    "docs\orchestration\task-payload.schema.json",
    "docs\orchestration\agent-status-format.md",
    "docs\prompts\primary-builder.md",
    "docs\prompts\antigravity-scrutinizer.md",
    "docs\prompts\jules-finisher.md",
    "docs\setup\local-setup-checklist.md",
    "docs\setup\github-webhook-setup.md",
    "docs\setup\jules-api-setup.md",
    "docs\setup\antigravity-review-process.md",
    "scripts\bootstrap\setup-agent-docs.ps1",
    "scripts\bootstrap\setup-agent-docs.sh",
    "scripts\bootstrap\validate-agent-scaffold.ps1",
    "scripts\bootstrap\validate-agent-scaffold.sh",
    "n8n\workflows\README.md",
    "n8n\workflows\github-router.workflow.json",
    "n8n\workflows\pr-to-jules.workflow.json",
    "config\labels.json",
    "config\task-payload.example.json",
    "README.agent-workflow.md"
)

$Failures = 0

Write-Host ""
Write-Host "=== Agent Scaffold Validation ===" -ForegroundColor Cyan
Write-Host "    Repo root: $RepoRoot"
Write-Host ""

Write-Host "-- Directories --" -ForegroundColor Gray
foreach ($RelDir in $RequiredDirectories) {
    $FullPath = [System.IO.Path]::Combine($RepoRoot, $RelDir)
    if ([System.IO.Directory]::Exists($FullPath)) {
        Write-Host "  [PASS] DIR  $RelDir" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] DIR  $RelDir" -ForegroundColor Red
        $Failures++
    }
}

Write-Host ""
Write-Host "-- Files --" -ForegroundColor Gray
foreach ($RelFile in $RequiredFiles) {
    $FullPath = [System.IO.Path]::Combine($RepoRoot, $RelFile)
    if ([System.IO.File]::Exists($FullPath)) {
        Write-Host "  [PASS] FILE $RelFile" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] FILE $RelFile" -ForegroundColor Red
        $Failures++
    }
}

Write-Host ""
Write-Host "=================================" -ForegroundColor Cyan

if ($Failures -eq 0) {
    Write-Host "All checks passed. Scaffold is complete." -ForegroundColor Green
    exit 0
} else {
    Write-Host "$Failures item(s) missing. Run setup-agent-docs.ps1 to create stubs." -ForegroundColor Red
    exit 1
}
