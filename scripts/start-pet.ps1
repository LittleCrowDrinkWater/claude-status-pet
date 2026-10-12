<#
.SYNOPSIS
    Deploy the locally built pet binary if it changed, then start the aggregate pet.
.DESCRIPTION
    Meant for a Claude Code SessionStart hook. Copies pet-app/src-tauri/target/release/claude-status-pet.exe
    into %USERPROFILE%\.claude\pet-data\bin under both names the plugin uses, restarting the running pet
    only when the binary actually differs. Starting is idempotent: a second aggregate pet exits on the
    global lock pet-all.lock.
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$build_output = Join-Path $PSScriptRoot '..\pet-app\src-tauri\target\release\claude-status-pet.exe'
$bin_dir = Join-Path $env:USERPROFILE '.claude\pet-data\bin'
$gui_exe = Join-Path $bin_dir 'claude-status-pet-windows-x64.exe'
# Plugin hooks call the extension-less name through Git Bash for write-status.
$hook_exe = Join-Path $bin_dir 'claude-status-pet'
# cargo may still be writing the exe; copying it mid-write would deploy a truncated binary.
$BUILD_SETTLE_SECONDS = 15

function Test-NeedsDeploy {
    if (-not (Test-Path -LiteralPath $build_output)) { return $false }
    $build_age = (Get-Date) - (Get-Item -LiteralPath $build_output).LastWriteTime
    if ($build_age.TotalSeconds -lt $BUILD_SETTLE_SECONDS) { return $false }
    if (-not (Test-Path -LiteralPath $gui_exe)) { return $true }
    return (Get-FileHash -LiteralPath $build_output).Hash -ne (Get-FileHash -LiteralPath $gui_exe).Hash
}

function Copy-WithRetry {
    param([Parameter(Mandatory)][string]$Destination)
    # A write-status hook from another session can hold the file for a few milliseconds.
    for ($attempt = 1; $attempt -le 5; $attempt++) {
        try {
            Copy-Item -LiteralPath $build_output -Destination $Destination -Force
            return
        }
        catch {
            if ($attempt -eq 5) { throw }
            Start-Sleep -Milliseconds 300
        }
    }
}

New-Item -ItemType Directory -Force -Path $bin_dir | Out-Null

if (Test-NeedsDeploy) {
    Get-Process -Name 'claude-status-pet-windows-x64' -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Milliseconds 500
    Copy-WithRetry -Destination $gui_exe
    Copy-WithRetry -Destination $hook_exe
}

if (Test-Path -LiteralPath $gui_exe) {
    Start-Process -FilePath $gui_exe -ArgumentList 'run', '--all' -WindowStyle Hidden
}
