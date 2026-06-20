# =============================================================================
# Kodelyth ECC -- Windows PowerShell Installer
# Supports: Claude Code, Antigravity, Cursor, Codex, Windsurf, OpenCode
# Usage:
#   .\install.ps1                                   # Claude Code (default)
#   .\install.ps1 -Target windsurf-project          # Windsurf (project)
#   .\install.ps1 -Target windsurf-home             # Windsurf (global)
#   .\install.ps1 -Target antigravity               # Google Antigravity
#   .\install.ps1 -Target cursor-project            # Cursor IDE
#   .\install.ps1 -Target codex-home                # OpenAI Codex CLI
#   .\install.ps1 -Target opencode                  # OpenCode
# =============================================================================

param(
    [string]$Target = "claude-home",
    [string]$Bundle = "",
    [string]$Languages = ""   # comma-separated when called from npx (e.g. "typescript,python")
                               # PowerShell native call still accepts: -Languages @("typescript","python")
)

$ErrorActionPreference = "Stop"

# Normalize -Languages: accept both comma-separated string (npx) and array (direct PS call)
[string[]]$LangArray = if ($Languages -is [array]) {
    $Languages | Where-Object { $_ -ne '' }
} elseif ($Languages -and $Languages -ne '') {
    $Languages -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }
} else {
    @()
}

# Non-interactive mode: set by npx launcher (KODELYTH_NONINTERACTIVE=1) or --yes flag
$NonInteractive = ($env:KODELYTH_NONINTERACTIVE -eq '1')

# -- Bundle handling (audience-tailored cheat sheets) -------------------------
if ($Bundle) {
    switch ($Bundle.ToLower()) {
        { $_ -in "indie-hacker","indie" } {
            $Bundle = "indie-hacker"
            $LangArray += @("typescript","python")
            Write-Host "Bundle: Indie Hacker -> ship-fast workflow + TS/Python" -ForegroundColor Cyan
        }
        { $_ -in "red-team","redteam","security" } {
            $Bundle = "red-team"
            $LangArray += @("typescript","python")
            Write-Host "Bundle: Red Team -> adversarial mindset + devil-mode crew" -ForegroundColor Cyan
        }
        { $_ -in "enterprise","compliance" } {
            $Bundle = "enterprise"
            $LangArray += @("typescript","java","python")
            Write-Host "Bundle: Enterprise -> compliance + audit + supply chain" -ForegroundColor Cyan
        }
        default {
            Write-Host "Unknown bundle: $Bundle" -ForegroundColor Red
            Write-Host "Available bundles: indie-hacker, red-team, enterprise"
            exit 1
        }
    }
}

# -- Banner --------------------------------------------------------------------
Write-Host ""
Write-Host "  Kodelyth ECC -- Production-grade AI coding agent toolkit" -ForegroundColor Cyan
Write-Host "  70 agents (8 devil-mode) | 194 skills | 97 commands | 22+ hooks | intent routing | local memory" -ForegroundColor Gray
Write-Host ""

# $PSScriptRoot is always the directory containing this .ps1 file,
# even when launched via Node's spawnSync (unlike $MyInvocation.MyCommand.Path).
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }

# -- Resolve Destination -------------------------------------------------------
$HomeDir = $env:USERPROFILE

switch ($Target) {
    "claude-home" {
        $Dest         = "$HomeDir\.claude"
        $AgentsDest   = "$Dest\agents"
        $SkillsDest   = "$Dest\skills"
        $CommandsDest = "$Dest\commands"
        $HooksDest    = "$Dest\hooks"
        $RulesDest    = "$Dest\rules"
    }
    "windsurf-project" {
        $Dest         = "$(Get-Location)\.windsurf"
        $AgentsDest   = "$Dest\agents"
        $SkillsDest   = "$Dest\skills"
        $CommandsDest = ""
        $HooksDest    = ""
        $RulesDest    = "$Dest\rules"
    }
    "windsurf-home" {
        $Dest         = "$HomeDir\.codeium\windsurf"
        $AgentsDest   = "$Dest\agents"
        $SkillsDest   = "$Dest\skills"
        $CommandsDest = ""
        $HooksDest    = ""
        $RulesDest    = "$Dest\rules"
    }
    "antigravity" {
        $Dest         = "$(Get-Location)\.agent"
        $AgentsDest   = "$Dest\skills"
        $SkillsDest   = ""
        $CommandsDest = "$Dest\workflows"
        $HooksDest    = ""
        $RulesDest    = "$Dest\rules"
    }
    "cursor-project" {
        $Dest         = "$(Get-Location)\.cursor"
        $AgentsDest   = ""
        $SkillsDest   = "$Dest\skills"
        $CommandsDest = ""
        $HooksDest    = ""
        $RulesDest    = "$Dest\rules"
    }
    "codex-home" {
        $Dest         = "$HomeDir\.codex"
        $AgentsDest   = "$Dest\agents"
        $SkillsDest   = "$Dest\skills"
        $CommandsDest = "$Dest\commands"
        $HooksDest    = ""
        $RulesDest    = "$Dest\rules"
    }
    "opencode" {
        $Dest         = "$(Get-Location)\.opencode"
        $AgentsDest   = ""
        $SkillsDest   = ""
        $CommandsDest = ""
        $HooksDest    = ""
        $RulesDest    = "$Dest\rules"
    }
    "cline" {
        $Dest         = "$(Get-Location)\.clinerules"
        $AgentsDest   = ""
        $SkillsDest   = ""
        $CommandsDest = ""
        $HooksDest    = ""
        $RulesDest    = $Dest
    }
    "roocode" {
        $Dest         = "$(Get-Location)\.roo"
        $AgentsDest   = "$Dest\agents"
        $SkillsDest   = "$Dest\skills"
        $CommandsDest = "$Dest\commands"
        $HooksDest    = ""
        $RulesDest    = "$Dest\rules"
    }
    "aider" {
        $Dest         = "$(Get-Location)\.aider-ecc"
        $AgentsDest   = "$Dest\agents"
        $SkillsDest   = "$Dest\skills"
        $CommandsDest = "$Dest\commands"
        $HooksDest    = ""
        $RulesDest    = "$Dest\rules"
    }
    "kimi" {
        $Dest         = "$(Get-Location)\.kimi"
        $AgentsDest   = "$Dest\agents"
        $SkillsDest   = "$Dest\skills"
        $CommandsDest = "$Dest\commands"
        $HooksDest    = ""
        $RulesDest    = "$Dest\rules"
    }
    "gemini-project" {
        $Dest         = "$(Get-Location)\.gemini"
        $AgentsDest   = "$Dest\agents"
        $SkillsDest   = "$Dest\skills"
        $CommandsDest = ""
        $HooksDest    = ""
        $RulesDest    = "$Dest\rules"
    }
    "gemini-home" {
        $Dest         = "$HomeDir\.gemini"
        $AgentsDest   = "$Dest\agents"
        $SkillsDest   = "$Dest\skills"
        $CommandsDest = ""
        $HooksDest    = ""
        $RulesDest    = "$Dest\rules"
    }
    default {
        Write-Host "Unknown target: $Target" -ForegroundColor Red
        Write-Host "Valid targets: claude-home, windsurf-project, windsurf-home, antigravity, cursor-project, codex-home, opencode, cline, roocode, aider, kimi, gemini-project, gemini-home"
        exit 1
    }
}

Write-Host "Install target: $Target" -ForegroundColor Yellow
Write-Host "Destination:    $Dest"
if ($LangArray.Count -gt 0) {
    Write-Host "Languages:      $($LangArray -join ', ')"
}
Write-Host ""

if (-not $NonInteractive) {
    $Confirm = Read-Host "Proceed with install? [Y/n]"
    if ($Confirm -and $Confirm -notmatch '^[Yy]$') {
        Write-Host "Install cancelled."
        exit 0
    }
}
Write-Host ""

# -- Dynamic Counts -----------------------------------------------------------
$AgentCount   = (Get-ChildItem -Path "$ScriptDir\agents"   -Filter "*.md" -File).Count
$SkillCount   = (Get-ChildItem -Path "$ScriptDir\skills"   -Recurse -Filter "SKILL.md" -File).Count
$CmdCount     = (Get-ChildItem -Path "$ScriptDir\commands" -Filter "*.md" -File).Count

# -- Helpers -------------------------------------------------------------------
function Install-Dir {
    param([string]$Src, [string]$Dest, [string]$Label)
    if (-not $Dest) { return }
    if (-not (Test-Path $Dest)) { New-Item -ItemType Directory -Path $Dest -Force | Out-Null }
    Copy-Item -Path "$Src\*" -Destination $Dest -Recurse -Force
    Write-Host "  [OK] $Label -> $Dest" -ForegroundColor Green
}

function Install-Flat {
    param([string]$Src, [string]$Dest, [string]$Label)
    if (-not $Dest) { return }
    if (-not (Test-Path $Dest)) { New-Item -ItemType Directory -Path $Dest -Force | Out-Null }
    Get-ChildItem -Path $Src -Recurse -Filter "*.md" | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination "$Dest\$($_.Name)" -Force
    }
    Write-Host "  [OK] $Label (flattened) -> $Dest" -ForegroundColor Green
}

# -- Install -------------------------------------------------------------------
Write-Host "Installing components..." -ForegroundColor Bold

switch ($Target) {
    "claude-home" {
        Install-Dir  "$ScriptDir\agents"   $AgentsDest   "Agents   (58)"
        Install-Dir  "$ScriptDir\skills"   $SkillsDest   "Skills   (187)"
        Install-Dir  "$ScriptDir\commands" $CommandsDest "Commands (79)"

        # Hooks
        if ($HooksDest) {
            if (-not (Test-Path $HooksDest)) { New-Item -ItemType Directory -Path $HooksDest -Force | Out-Null }
            Copy-Item "$ScriptDir\hooks\hooks.json" "$HooksDest\hooks.json" -Force
            Write-Host "  [OK] Hooks -> $HooksDest" -ForegroundColor Green
        }

        # Rules
        if (-not (Test-Path $RulesDest)) { New-Item -ItemType Directory -Path $RulesDest -Force | Out-Null }
        if (Test-Path "$ScriptDir\rules\common") {
            Copy-Item -Path "$ScriptDir\rules\common\*" -Destination $RulesDest -Recurse -Force
            Write-Host "  [OK] Rules (common) -> $RulesDest" -ForegroundColor Green
        }
        foreach ($lang in $LangArray) {
            if (Test-Path "$ScriptDir\rules\$lang") {
                $LangDest = "$RulesDest\$lang"
                if (-not (Test-Path $LangDest)) { New-Item -ItemType Directory -Path $LangDest -Force | Out-Null }
                Copy-Item -Path "$ScriptDir\rules\$lang\*" -Destination $LangDest -Recurse -Force
                Write-Host "  [OK] Rules ($lang) -> $LangDest" -ForegroundColor Green
            }
        }

        Copy-Item "$ScriptDir\CLAUDE.md" "$Dest\CLAUDE.md" -Force -ErrorAction SilentlyContinue
        Copy-Item "$ScriptDir\SOUL.md"   "$Dest\SOUL.md"   -Force -ErrorAction SilentlyContinue
        Write-Host "  [OK] CLAUDE.md + SOUL.md" -ForegroundColor Green
    }
    { $_ -in "windsurf-project","windsurf-home" } {
        Install-Dir  "$ScriptDir\agents"   $AgentsDest "Agents   ($AgentCount)"
        Install-Dir  "$ScriptDir\skills"   $SkillsDest "Skills   ($SkillCount)"
        Install-Flat "$ScriptDir\rules"    $RulesDest  "Rules"

        # Generate .windsurfrules from all common rules
        $WindsurfRulesFile = if ($Target -eq "windsurf-project") { "$(Get-Location)\.windsurfrules" } else { "$Dest\.windsurfrules" }
        $CommonRulesDir = "$ScriptDir\rules\common"
        if (Test-Path $CommonRulesDir) {
            $Combined = Get-ChildItem -Path $CommonRulesDir -Filter "*.md" | Sort-Object Name | ForEach-Object { Get-Content $_.FullName }
            $Combined | Out-File -FilePath $WindsurfRulesFile -Encoding UTF8
            Write-Host "  [OK] .windsurfrules generated -> $WindsurfRulesFile" -ForegroundColor Green
        }
    }
    "antigravity" {
        Install-Dir  "$ScriptDir\agents"   $AgentsDest   "Agents -> skills ($AgentCount)"
        Install-Dir  "$ScriptDir\commands" $CommandsDest "Commands -> workflows ($CmdCount)"
        Install-Flat "$ScriptDir\rules"    $RulesDest    "Rules"
    }
    "cursor-project" {
        Install-Flat "$ScriptDir\rules"    $RulesDest  "Rules"
        Install-Dir  "$ScriptDir\skills"   $SkillsDest "Skills ($SkillCount)"
    }
    "codex-home" {
        Install-Dir  "$ScriptDir\agents"   $AgentsDest   "Agents   ($AgentCount)"
        Install-Dir  "$ScriptDir\skills"   $SkillsDest   "Skills   ($SkillCount)"
        Install-Dir  "$ScriptDir\commands" $CommandsDest "Commands ($CmdCount)"
        Install-Flat "$ScriptDir\rules"    $RulesDest    "Rules"
    }
    "opencode" {
        Install-Flat "$ScriptDir\rules"    $RulesDest    "Rules"
    }
    "cline" {
        Install-Flat "$ScriptDir\rules"    $RulesDest    "Rules"
        Install-Flat "$ScriptDir\agents"   $RulesDest    "Agents (flattened)"
        Install-Flat "$ScriptDir\commands" $RulesDest    "Commands (flattened)"
    }
    "roocode" {
        Install-Dir  "$ScriptDir\agents"   $AgentsDest   "Agents   ($AgentCount)"
        Install-Dir  "$ScriptDir\skills"   $SkillsDest   "Skills   ($SkillCount)"
        Install-Dir  "$ScriptDir\commands" $CommandsDest "Commands ($CmdCount)"
        Install-Flat "$ScriptDir\rules"    $RulesDest    "Rules"
    }
    "aider" {
        Install-Dir  "$ScriptDir\agents"   $AgentsDest   "Agents   ($AgentCount)"
        Install-Dir  "$ScriptDir\skills"   $SkillsDest   "Skills   ($SkillCount)"
        Install-Dir  "$ScriptDir\commands" $CommandsDest "Commands ($CmdCount)"
        Install-Flat "$ScriptDir\rules"    $RulesDest    "Rules"
        $ConventionsFile = "$(Get-Location)\CONVENTIONS.md"
        if (-not (Test-Path $ConventionsFile)) {
            $aiderText = @'
# Project Conventions (Aider)

This project uses **Kodelyth ECC** for AI agent guidance.

Aider auto-loads this file. To bring full ECC context, run Aider with:

    aider --read .aider-ecc/rules/agent-intent-routing.md
    aider --read .aider-ecc/rules/coding-standards.md
    aider --read .aider-ecc/agents/debug-detective.md

Full catalog: `.aider-ecc/agents/`, `.aider-ecc/skills/`, `.aider-ecc/commands/`, `.aider-ecc/rules/`.

Powered by Kodelyth ECC -- github.com/sifxprime/kodelyth-ecc
'@
            $aiderText | Out-File -FilePath $ConventionsFile -Encoding UTF8
            Write-Host "  [OK] CONVENTIONS.md -> $ConventionsFile" -ForegroundColor Green
        } else {
            Write-Host "  [skip] CONVENTIONS.md exists -- not overwriting" -ForegroundColor Yellow
        }
    }
    "kimi" {
        Install-Dir  "$ScriptDir\agents"   $AgentsDest   "Agents   ($AgentCount)"
        Install-Dir  "$ScriptDir\skills"   $SkillsDest   "Skills   ($SkillCount)"
        Install-Dir  "$ScriptDir\commands" $CommandsDest "Commands ($CmdCount)"
        Install-Flat "$ScriptDir\rules"    $RulesDest    "Rules"
    }
    { $_ -in "gemini-project","gemini-home" } {
        Install-Dir  "$ScriptDir\agents"   $AgentsDest   "Agents   ($AgentCount)"
        Install-Dir  "$ScriptDir\skills"   $SkillsDest   "Skills   ($SkillCount)"
        Install-Flat "$ScriptDir\rules"    $RulesDest    "Rules"
        $GeminiFile = "$Dest\GEMINI.md"
        if (-not (Test-Path $GeminiFile)) {
            $geminiText = @'
# Kodelyth ECC -- Gemini CLI context

This project uses Kodelyth ECC -- 70 specialist agents, 194 skills, 97 commands, intent routing, and self-learning memory.

The full toolkit is installed under this directory:

- agents/ -- specialist subagents (debug-detective, security-reviewer, devil-mode crew)
- skills/ -- domain knowledge files
- rules/ -- always-on coding standards + intent routing rule

For more: github.com/sifxprime/kodelyth-ecc
'@
            $geminiText | Out-File -FilePath $GeminiFile -Encoding UTF8
            Write-Host "  [OK] GEMINI.md -> $GeminiFile" -ForegroundColor Green
        }
    }
}

# -- Install bundle cheat sheet (if -Bundle was set) ---------------------------
if ($Bundle -and (Test-Path "$ScriptDir\bundles\$Bundle.md")) {
    Copy-Item -Path "$ScriptDir\bundles\$Bundle.md" -Destination "$Dest\BUNDLE.md" -Force
    Write-Host "  [OK] Bundle cheat sheet ($Bundle) -> $Dest\BUNDLE.md" -ForegroundColor Green
}

# -- Write install state -------------------------------------------------------
$Version = if (Test-Path "$ScriptDir\VERSION") { Get-Content "$ScriptDir\VERSION" } else { "1.0.0" }
$StateFile = "$Dest\kodelyth-ecc-install-state.json"
$State = @{
    installed_by = "kodelyth-ecc"
    version      = $Version.Trim()
    target       = $Target
    bundle       = $Bundle
    installed_at = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    languages    = $LangArray
} | ConvertTo-Json
$State | Out-File -FilePath $StateFile -Encoding UTF8
Write-Host "  [OK] Install state -> $StateFile" -ForegroundColor Green

# -- Bundle-specific reminder --------------------------------------------------
if ($Bundle) {
    Write-Host ""
    switch ($Bundle) {
        "indie-hacker" {
            Write-Host "  Bundle: Indie Hacker is active." -ForegroundColor Cyan
            Write-Host "  Lead with: /project-launch (new) | /tdd | /devil-mode --pre-public (before going public)"
            Write-Host "  Read: $Dest\BUNDLE.md for the full ship-fast playbook."
        }
        "red-team" {
            Write-Host "  Bundle: Red Team is active." -ForegroundColor Red
            Write-Host "  Lead with: /devil-mode (4-agent sweep) | /devil-mode --all (full 8-agent crew)"
            Write-Host "  Read: $Dest\BUNDLE.md for the adversarial workflow playbook."
        }
        "enterprise" {
            Write-Host "  Bundle: Enterprise is active." -ForegroundColor Cyan
            Write-Host "  Lead with: /team-review (per-PR) | /pre-release (per-tag) | /devil-mode --pre-launch"
            Write-Host "  Read: $Dest\BUNDLE.md for the compliance + audit playbook."
        }
    }
}

# -- Done ----------------------------------------------------------------------
Write-Host ""
Write-Host "Kodelyth ECC installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Get started:"
switch ($Target) {
    "claude-home" {
        Write-Host "  1. Open Claude Code in any project"
        Write-Host "  2. Type: /kodelyth-quickstart"
        Write-Host "  3. Or:   use kodelyth-advisor"
    }
    { $_ -in "windsurf-project","windsurf-home" } {
        Write-Host "  1. Open the project in Windsurf"
        Write-Host "  2. Cascade auto-loads .windsurfrules on every session"
        Write-Host "  3. Try:  use kodelyth-advisor"
    }
    "cursor-project" {
        Write-Host "  1. Open the project in Cursor"
        Write-Host "  2. Rules and skills are now active in chat"
        Write-Host "  3. Try:  use kodelyth-advisor"
    }
    "codex-home" {
        Write-Host "  1. Restart Codex CLI (codex)"
        Write-Host "  2. All $AgentCount agents and $SkillCount skills are now available"
        Write-Host "  3. Try:  use kodelyth-advisor"
    }
    "antigravity" {
        Write-Host "  1. Open your project in Antigravity"
        Write-Host "  2. Agents are available as Skills"
        Write-Host "  3. Commands are available as Workflows"
    }
    "opencode" {
        Write-Host "  1. Open the project in OpenCode"
        Write-Host "  2. Rules in .opencode/rules/ are now loaded"
    }
    "cline" {
        Write-Host "  1. Open the project in VS Code with Cline"
        Write-Host "  2. .clinerules/ auto-loaded by Cline"
        Write-Host "  3. Ask: 'use debug-detective' or 'devil mode the codebase'"
    }
    "roocode" {
        Write-Host "  1. Open the project in VS Code with Roo Code"
        Write-Host "  2. Rules + agents auto-loaded from .roo/"
        Write-Host "  3. Ask: 'use kodelyth-advisor'"
    }
    "aider" {
        Write-Host "  1. CONVENTIONS.md created at project root"
        Write-Host "  2. Run: aider --read .aider-ecc/rules/agent-intent-routing.md"
        Write-Host "  3. Then describe your problem in plain words"
    }
    "kimi" {
        Write-Host "  1. Open the project with Kimi CLI"
        Write-Host "  2. Agents/skills/rules in .kimi/"
        Write-Host "  3. Ask: 'use kodelyth-advisor'"
    }
    { $_ -in "gemini-project","gemini-home" } {
        Write-Host "  1. Run Gemini CLI"
        Write-Host "  2. GEMINI.md auto-loaded from $Dest"
        Write-Host "  3. Ask: 'use debug-detective'"
    }
    default {
        Write-Host "  1. Restart your AI coding agent"
        Write-Host "  2. Agents, skills, and rules are now active"
    }
}
Write-Host ""
Write-Host "  Powered by Kodelyth" -ForegroundColor Cyan
Write-Host ""
