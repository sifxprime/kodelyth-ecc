#!/usr/bin/env bash
# =============================================================================
# Kodelyth ECC — Installer
# Supports: Claude Code, Antigravity, Cursor, Windsurf, Codex, OpenCode
# Usage:
#   ./install.sh                              # Claude Code (default)
#   ./install.sh --target antigravity         # Google Antigravity (.agent/ in project)
#   ./install.sh --target cursor-project      # Cursor IDE (.cursor/ in project)
#   ./install.sh --target windsurf-project    # Windsurf (.windsurf/ + .windsurfrules)
#   ./install.sh --target windsurf-home       # Windsurf global (~/.codeium/windsurf/)
#   ./install.sh --target codex-home          # OpenAI Codex CLI (~/.codex/)
#   ./install.sh --target opencode            # OpenCode (.opencode/ in project)
# =============================================================================

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}${BOLD}"
cat << 'BANNER'
  ██╗  ██╗ ██████╗ ██████╗ ███████╗██╗  ██╗   ██╗████████╗██╗  ██╗
  ██║ ██╔╝██╔═══██╗██╔══██╗██╔════╝██║  ╚██╗ ██╔╝╚══██╔══╝██║  ██║
  █████╔╝ ██║   ██║██║  ██║█████╗  ██║   ╚████╔╝    ██║   ███████║
  ██╔═██╗ ██║   ██║██║  ██║██╔══╝  ██║    ╚██╔╝     ██║   ██╔══██║
  ██║  ██╗╚██████╔╝██████╔╝███████╗███████╗██║       ██║   ██║  ██║
  ╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝╚══════╝╚═╝       ╚═╝   ╚═╝  ╚═╝

    ███████╗ ██████╗ ██████╗
    ██╔════╝██╔════╝██╔════╝
    █████╗  ██║     ██║
    ██╔══╝  ██║     ██║
    ███████╗╚██████╗╚██████╗
    ╚══════╝ ╚═════╝ ╚═════╝
BANNER
echo -e "${RESET}"
echo -e "${RED}${BOLD}  ╔══════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${RED}${BOLD}  ║   DANGER LEVEL: GOD TIER    ·    NOT FOR JUNIOR DEVS        ║${RESET}"
echo -e "${RED}${BOLD}  ╚══════════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "${BOLD}  Kodelyth ECC — The most dangerous AI coding toolkit on the planet${RESET}"
echo -e "${CYAN}  70 specialist agents (8 devil-mode)  ·  194 skills  ·  97 commands  ·  22+ hooks  ·  intent routing  ·  compound memory${RESET}"
echo -e "${CYAN}  Any language  ·  Any framework  ·  Any scale  ·  300B-level quality${RESET}"
echo ""
echo -e "  github.com/sifxprime/kodelyth-ecc"
echo -e "  Powered by ${BOLD}Kodelyth${RESET}"
echo ""
echo -e "  ─────────────────────────────────────────────────────────────"
echo ""

# ── Resolve script location ───────────────────────────────────────────────────
# When piped via curl, BASH_SOURCE[0] is unbound — clone repo to a temp dir
SCRIPT_DIR_CANDIDATE="${BASH_SOURCE[0]:-}"
if [[ -z "$SCRIPT_DIR_CANDIDATE" ]] || [[ ! -f "$SCRIPT_DIR_CANDIDATE" ]]; then
  echo -e "${CYAN}  Detected: remote install via curl — cloning repo...${RESET}"
  if ! command -v git &>/dev/null; then
    echo -e "${RED}  Error: git is required. Install git and try again.${RESET}"
    exit 1
  fi
  _TMPDIR="$(mktemp -d)"
  trap 'rm -rf "$_TMPDIR"' EXIT
  git clone --depth=1 --quiet "https://github.com/sifxprime/kodelyth-ecc.git" "$_TMPDIR/kodelyth-ecc"
  echo -e "${GREEN}  Cloned.${RESET}"
  SCRIPT_DIR="$_TMPDIR/kodelyth-ecc"
else
  SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_DIR_CANDIDATE")" && pwd)"
fi
TARGET="claude-home"
LANGUAGE_MODULES=()
BUNDLE=""

# ── Parse Arguments ───────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="$2"
      shift 2
      ;;
    --target=*)
      TARGET="${1#--target=}"
      shift
      ;;
    typescript|python|golang|go|rust|java|kotlin|php|swift|cpp|csharp|dart|ruby|elixir)
      lang="$1"
      [[ "$lang" == "go" ]] && lang="golang"
      LANGUAGE_MODULES+=("$lang")
      shift
      ;;
    --bundle)
      case "$2" in
        indie-hacker|indie)
          BUNDLE="indie-hacker"
          LANGUAGE_MODULES+=("typescript" "python")
          echo -e "${CYAN}Bundle: Indie Hacker → ship-fast workflow + TS/Python${RESET}"
          ;;
        red-team|redteam|security)
          BUNDLE="red-team"
          LANGUAGE_MODULES+=("typescript" "python")
          echo -e "${CYAN}Bundle: Red Team → adversarial mindset + devil-mode crew${RESET}"
          ;;
        enterprise|compliance)
          BUNDLE="enterprise"
          LANGUAGE_MODULES+=("typescript" "java" "python")
          echo -e "${CYAN}Bundle: Enterprise → compliance + audit + supply chain${RESET}"
          ;;
        *)
          echo -e "${RED}Unknown bundle: $2${RESET}"
          echo "Available bundles: indie-hacker, red-team, enterprise"
          exit 1
          ;;
      esac
      shift 2
      ;;
    --bundle=*)
      bundle_val="${1#--bundle=}"
      case "$bundle_val" in
        indie-hacker|indie)
          BUNDLE="indie-hacker"
          LANGUAGE_MODULES+=("typescript" "python")
          echo -e "${CYAN}Bundle: Indie Hacker → ship-fast workflow + TS/Python${RESET}"
          ;;
        red-team|redteam|security)
          BUNDLE="red-team"
          LANGUAGE_MODULES+=("typescript" "python")
          echo -e "${CYAN}Bundle: Red Team → adversarial mindset + devil-mode crew${RESET}"
          ;;
        enterprise|compliance)
          BUNDLE="enterprise"
          LANGUAGE_MODULES+=("typescript" "java" "python")
          echo -e "${CYAN}Bundle: Enterprise → compliance + audit + supply chain${RESET}"
          ;;
        *)
          echo -e "${RED}Unknown bundle: $bundle_val${RESET}"
          echo "Available bundles: indie-hacker, red-team, enterprise"
          exit 1
          ;;
      esac
      shift
      ;;
    --profile)
      case "$2" in
        nextjs|next)
          LANGUAGE_MODULES+=("typescript")
          echo -e "${CYAN}Profile: Next.js → typescript rules${RESET}"
          ;;
        python-api)
          LANGUAGE_MODULES+=("python")
          echo -e "${CYAN}Profile: Python API → python rules${RESET}"
          ;;
        fullstack)
          LANGUAGE_MODULES+=("typescript" "python" "golang")
          echo -e "${CYAN}Profile: Fullstack → typescript + python + golang rules${RESET}"
          ;;
        mobile)
          LANGUAGE_MODULES+=("kotlin" "swift")
          echo -e "${CYAN}Profile: Mobile → kotlin + swift rules${RESET}"
          ;;
        backend)
          LANGUAGE_MODULES+=("golang" "python" "java")
          echo -e "${CYAN}Profile: Backend → golang + python + java rules${RESET}"
          ;;
        *)
          echo -e "${RED}Unknown profile: $2${RESET}"
          echo "Available profiles: nextjs, python-api, fullstack, mobile, backend"
          exit 1
          ;;
      esac
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [--target TARGET] [--profile PROFILE] [language...]"
      echo ""
      echo "Targets:"
      echo "  claude-home         Claude Code global install (default)"
      echo "  antigravity         Google Antigravity (.agent/ in project)"
      echo "  cursor-project      Cursor IDE (.cursor/ in project)"
      echo "  windsurf-project    Windsurf IDE (.windsurf/ + .windsurfrules in project)"
      echo "  windsurf-home       Windsurf IDE global (~/.codeium/windsurf/)"
      echo "  codex-home          OpenAI Codex CLI (~/.codex/)"
      echo "  opencode            OpenCode (.opencode/ in project)"
      echo "  cline               Cline VS Code agent (.clinerules/ in project)"
      echo "  roocode             Roo Code agent (.roo/ in project)"
      echo "  aider               Aider terminal agent (.aider-ecc/ + CONVENTIONS.md)"
      echo "  kimi                Kimi Code (.kimi/ in project)"
      echo "  gemini-project      Gemini CLI — project (.gemini/ in project)"
      echo "  gemini-home         Gemini CLI — global (~/.gemini/)"
      echo ""
      echo "Bundles (audience-tailored — installs everything + curated cheat sheet):"
      echo "  --bundle indie-hacker  Solo founders / SaaS — ship fast, validate, harden"
      echo "  --bundle red-team      Security engineers — devil-mode crew + adversarial workflows"
      echo "  --bundle enterprise    Compliance / audit teams — SBOM, license, supply chain"
      echo ""
      echo "Profiles (pre-built language bundles):"
      echo "  --profile nextjs      TypeScript + React + Next.js"
      echo "  --profile python-api  Python + Django/FastAPI"
      echo "  --profile fullstack   TypeScript + Python + Go"
      echo "  --profile mobile      Kotlin + Swift"
      echo "  --profile backend     Go + Python + Java"
      echo ""
      echo "Languages (manual, installs language-specific rules):"
      echo "  typescript  python  golang  rust  java  kotlin  php  swift  cpp  dart  ruby  elixir"
      echo ""
      echo "Examples:"
      echo "  ./install.sh"
      echo "  ./install.sh --profile nextjs"
      echo "  ./install.sh --profile fullstack"
      echo "  ./install.sh --target antigravity --profile python-api"
      echo "  ./install.sh --target windsurf-project typescript"
      echo "  ./install.sh --target cursor-project typescript"
      exit 0
      ;;
    \#*)
      # zsh passes inline comments as literal args; skip them and everything after
      break
      ;;
    *)
      echo -e "${RED}Unknown argument: $1${RESET}"
      exit 1
      ;;
  esac
done

# ── Resolve Destination ───────────────────────────────────────────────────────
HOME_DIR="$HOME"
WINDSURFRULES_DEST=""  # only set for windsurf targets

case "$TARGET" in
  claude-home)
    DEST="$HOME_DIR/.claude"
    AGENTS_DEST="$DEST/agents"
    SKILLS_DEST="$DEST/skills"
    COMMANDS_DEST="$DEST/commands"
    HOOKS_DEST="$DEST/hooks"
    RULES_DEST="$DEST/rules"
    INSTALL_MODE="user"
    ;;
  antigravity)
    DEST="$(pwd)/.agent"
    AGENTS_DEST="$DEST/skills"
    SKILLS_DEST=""
    COMMANDS_DEST="$DEST/workflows"
    HOOKS_DEST=""
    RULES_DEST="$DEST/rules"
    INSTALL_MODE="project"
    ;;
  cursor-project)
    DEST="$(pwd)/.cursor"
    AGENTS_DEST=""
    SKILLS_DEST="$DEST/skills"
    COMMANDS_DEST=""
    HOOKS_DEST=""
    RULES_DEST="$DEST/rules"
    INSTALL_MODE="project"
    ;;
  codex-home)
    DEST="$HOME_DIR/.codex"
    AGENTS_DEST="$DEST/agents"
    SKILLS_DEST="$DEST/skills"
    COMMANDS_DEST="$DEST/commands"
    HOOKS_DEST=""
    RULES_DEST="$DEST/rules"
    INSTALL_MODE="user"
    ;;
  windsurf-project)
    DEST="$(pwd)/.windsurf"
    AGENTS_DEST="$DEST/agents"
    SKILLS_DEST="$DEST/skills"
    COMMANDS_DEST=""
    HOOKS_DEST=""
    RULES_DEST="$DEST/rules"
    WINDSURFRULES_DEST="$(pwd)/.windsurfrules"
    INSTALL_MODE="project"
    ;;
  windsurf-home)
    DEST="$HOME_DIR/.codeium/windsurf"
    AGENTS_DEST="$DEST/agents"
    SKILLS_DEST="$DEST/skills"
    COMMANDS_DEST=""
    HOOKS_DEST=""
    RULES_DEST="$DEST/rules"
    WINDSURFRULES_DEST="$DEST/.windsurfrules"
    INSTALL_MODE="user"
    ;;
  opencode)
    DEST="$(pwd)/.opencode"
    AGENTS_DEST=""
    SKILLS_DEST=""
    COMMANDS_DEST=""
    HOOKS_DEST=""
    RULES_DEST="$DEST/rules"
    INSTALL_MODE="project"
    ;;
  cline)
    # Cline (VS Code AI agent) reads markdown rules from .clinerules/
    DEST="$(pwd)/.clinerules"
    AGENTS_DEST=""
    SKILLS_DEST=""
    COMMANDS_DEST=""
    HOOKS_DEST=""
    RULES_DEST="$DEST"
    INSTALL_MODE="project"
    ;;
  roocode)
    # Roo Code (VS Code AI agent, Cline fork) reads from .roo/
    DEST="$(pwd)/.roo"
    AGENTS_DEST="$DEST/agents"
    SKILLS_DEST="$DEST/skills"
    COMMANDS_DEST="$DEST/commands"
    HOOKS_DEST=""
    RULES_DEST="$DEST/rules"
    INSTALL_MODE="project"
    ;;
  aider)
    # Aider (terminal pair-programmer) reads from CONVENTIONS.md and .aider-ecc/
    DEST="$(pwd)/.aider-ecc"
    AGENTS_DEST="$DEST/agents"
    SKILLS_DEST="$DEST/skills"
    COMMANDS_DEST="$DEST/commands"
    HOOKS_DEST=""
    RULES_DEST="$DEST/rules"
    INSTALL_MODE="project"
    ;;
  kimi)
    # Kimi Code (Moonshot CLI agent) reads from .kimi/
    DEST="$(pwd)/.kimi"
    AGENTS_DEST="$DEST/agents"
    SKILLS_DEST="$DEST/skills"
    COMMANDS_DEST="$DEST/commands"
    HOOKS_DEST=""
    RULES_DEST="$DEST/rules"
    INSTALL_MODE="project"
    ;;
  gemini-project)
    # Gemini CLI reads GEMINI.md + .gemini/
    DEST="$(pwd)/.gemini"
    AGENTS_DEST="$DEST/agents"
    SKILLS_DEST="$DEST/skills"
    COMMANDS_DEST=""
    HOOKS_DEST=""
    RULES_DEST="$DEST/rules"
    INSTALL_MODE="project"
    ;;
  gemini-home)
    # Gemini CLI global install
    DEST="$HOME_DIR/.gemini"
    AGENTS_DEST="$DEST/agents"
    SKILLS_DEST="$DEST/skills"
    COMMANDS_DEST=""
    HOOKS_DEST=""
    RULES_DEST="$DEST/rules"
    INSTALL_MODE="user"
    ;;
  *)
    echo -e "${RED}Unknown target: $TARGET${RESET}"
    echo "Valid targets: claude-home, antigravity, cursor-project, windsurf-project, windsurf-home, codex-home, opencode, cline, roocode, aider, kimi, gemini-project, gemini-home"
    exit 1
    ;;
esac

# ── Summary ───────────────────────────────────────────────────────────────────
echo -e "${BOLD}Install target:${RESET} ${CYAN}$TARGET${RESET}"
echo -e "${BOLD}Destination:${RESET}    $DEST"
if [[ ${#LANGUAGE_MODULES[@]} -gt 0 ]]; then
  echo -e "${BOLD}Languages:${RESET}      ${LANGUAGE_MODULES[*]}"
fi
echo ""

# ── Confirm ───────────────────────────────────────────────────────────────────
if [[ -e /dev/tty ]]; then
  read -r -p "$(echo -e "${YELLOW}Proceed with install? [Y/n] ${RESET}")" CONFIRM </dev/tty
  CONFIRM="${CONFIRM:-Y}"
else
  CONFIRM="Y"
  echo -e "${CYAN}  Non-interactive environment — proceeding automatically.${RESET}"
fi
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Install cancelled."
  exit 0
fi
echo ""

# ── Helpers ───────────────────────────────────────────────────────────────────
install_dir() {
  local src="$1"
  local dest="$2"
  local label="$3"

  if [[ -z "$dest" ]]; then
    return
  fi

  mkdir -p "$dest"
  local count=0

  if [[ -d "$src" ]]; then
    cp -r "$src"/. "$dest/"
    count=$(find "$dest" -maxdepth 1 -name "*.md" | wc -l | tr -d ' ')
  fi

  echo -e "  ${GREEN}✓${RESET} $label ${BLUE}(→ $dest)${RESET}"
}

install_flat() {
  # Flattens all .md files from a directory tree into a single destination
  local src="$1"
  local dest="$2"
  local label="$3"

  if [[ -z "$dest" ]]; then
    return
  fi

  mkdir -p "$dest"
  local count=0

  find "$src" -name "*.md" | while read -r f; do
    cp "$f" "$dest/$(basename "$f")"
    ((count++)) || true
  done

  echo -e "  ${GREEN}✓${RESET} $label ${BLUE}(→ $dest, flattened)${RESET}"
}

install_hooks() {
  local src="$SCRIPT_DIR/hooks/hooks.json"
  local dest="$1"

  if [[ -z "$dest" ]] || [[ ! -f "$src" ]]; then
    return
  fi

  mkdir -p "$dest"
  cp "$src" "$dest/hooks.json"
  echo -e "  ${GREEN}✓${RESET} Hooks ${BLUE}(→ $dest/hooks.json)${RESET}"
}

# Generate a single .windsurfrules file from all common rule .md files
generate_windsurfrules() {
  local rules_src="$1"
  local dest_file="$2"
  {
    echo "# Kodelyth ECC — AI Coding Rules"
    echo "# Auto-generated by kodelyth-ecc installer — do not edit manually"
    echo "# https://github.com/sifxprime/kodelyth-ecc"
    echo ""
    if [[ -d "$rules_src/common" ]]; then
      for f in "$rules_src/common"/*.md; do
        [[ -f "$f" ]] || continue
        echo ""
        echo "---"
        echo "## $(basename "$f" .md)"
        echo ""
        cat "$f"
      done
    fi
  } > "$dest_file"
  echo -e "  ${GREEN}✓${RESET} .windsurfrules ${BLUE}(→ $dest_file)${RESET}"
}

# ── Dynamic Counts ────────────────────────────────────────────────────────────
AGENT_COUNT=$(find "$SCRIPT_DIR/agents" -maxdepth 1 -name "*.md" | wc -l | tr -d ' ')
SKILL_COUNT=$(find "$SCRIPT_DIR/skills" -mindepth 2 -maxdepth 2 -name "SKILL.md" | wc -l | tr -d ' ')
CMD_COUNT=$(find "$SCRIPT_DIR/commands" -maxdepth 1 -name "*.md" | wc -l | tr -d ' ')

# ── Install ───────────────────────────────────────────────────────────────────
echo -e "${BOLD}Installing components...${RESET}"
echo ""

case "$TARGET" in
  claude-home)
    install_dir  "$SCRIPT_DIR/agents"   "$AGENTS_DEST"   "Agents   ($AGENT_COUNT)"
    install_dir  "$SCRIPT_DIR/skills"   "$SKILLS_DEST"   "Skills   ($SKILL_COUNT)"
    install_dir  "$SCRIPT_DIR/commands" "$COMMANDS_DEST" "Commands ($CMD_COUNT)"
    install_hooks                       "$HOOKS_DEST"
    # Rules: install common + selected languages
    mkdir -p "$RULES_DEST"
    if [[ -d "$SCRIPT_DIR/rules/common" ]]; then
      cp -r "$SCRIPT_DIR/rules/common"/. "$RULES_DEST/"
      echo -e "  ${GREEN}✓${RESET} Rules (common) ${BLUE}(→ $RULES_DEST)${RESET}"
    fi
    for lang in "${LANGUAGE_MODULES[@]+"${LANGUAGE_MODULES[@]}"}"; do
      if [[ -d "$SCRIPT_DIR/rules/$lang" ]]; then
        mkdir -p "$RULES_DEST/$lang"
        cp -r "$SCRIPT_DIR/rules/$lang"/. "$RULES_DEST/$lang/"
        echo -e "  ${GREEN}✓${RESET} Rules ($lang) ${BLUE}(→ $RULES_DEST/$lang)${RESET}"
      fi
    done
    # Copy CLAUDE.md and SOUL.md to destination
    cp "$SCRIPT_DIR/CLAUDE.md" "$DEST/CLAUDE.md" 2>/dev/null || true
    cp "$SCRIPT_DIR/SOUL.md"   "$DEST/SOUL.md"   2>/dev/null || true
    echo -e "  ${GREEN}✓${RESET} CLAUDE.md + SOUL.md"
    ;;

  antigravity)
    # Agents → .agent/skills/
    install_dir  "$SCRIPT_DIR/agents"   "$AGENTS_DEST"   "Agents → skills  ($AGENT_COUNT)"
    # Commands → .agent/workflows/
    install_dir  "$SCRIPT_DIR/commands" "$COMMANDS_DEST" "Commands → workflows ($CMD_COUNT)"
    # Rules → .agent/rules/ (flattened)
    install_flat "$SCRIPT_DIR/rules"    "$RULES_DEST"    "Rules (flattened)"
    # Kodelyth skills → .agent/rules/ (flattened — Antigravity has no skills system)
    # These become always-on context so agents can reference them without slash commands
    for skill_dir in kodelyth-quickstart smart-debug git-mastery observability; do
      skill_file="$SCRIPT_DIR/skills/$skill_dir/SKILL.md"
      if [[ -f "$skill_file" ]]; then
        cp "$skill_file" "$RULES_DEST/$skill_dir.md"
        echo -e "  ${GREEN}✓${RESET} Skill (→ rules): $skill_dir ${BLUE}(Antigravity compat)${RESET}"
      fi
    done
    ;;

  cursor-project)
    install_flat "$SCRIPT_DIR/rules"    "$RULES_DEST"    "Rules (flattened)"
    install_dir  "$SCRIPT_DIR/skills"   "$SKILLS_DEST"   "Skills ($SKILL_COUNT)"
    ;;

  codex-home)
    install_dir  "$SCRIPT_DIR/agents"   "$AGENTS_DEST"   "Agents   ($AGENT_COUNT)"
    install_dir  "$SCRIPT_DIR/skills"   "$SKILLS_DEST"   "Skills   ($SKILL_COUNT)"
    install_dir  "$SCRIPT_DIR/commands" "$COMMANDS_DEST" "Commands ($CMD_COUNT)"
    install_flat "$SCRIPT_DIR/rules"    "$RULES_DEST"    "Rules (flattened)"
    ;;

  windsurf-project|windsurf-home)
    install_dir  "$SCRIPT_DIR/agents"  "$AGENTS_DEST"  "Agents   ($AGENT_COUNT)"
    install_dir  "$SCRIPT_DIR/skills"  "$SKILLS_DEST"  "Skills   ($SKILL_COUNT)"
    install_flat "$SCRIPT_DIR/rules"   "$RULES_DEST"   "Rules (flattened)"
    generate_windsurfrules "$SCRIPT_DIR/rules" "$WINDSURFRULES_DEST"
    ;;

  opencode)
    install_flat "$SCRIPT_DIR/rules"    "$RULES_DEST"    "Rules (flattened)"
    ;;

  cline)
    # Cline reads everything in .clinerules/ as markdown — flatten the lot
    install_flat "$SCRIPT_DIR/rules"    "$RULES_DEST"    "Rules (flattened)"
    install_flat "$SCRIPT_DIR/agents"   "$RULES_DEST"    "Agents (flattened → rules)"
    install_flat "$SCRIPT_DIR/commands" "$RULES_DEST"    "Commands (flattened → rules)"
    ;;

  roocode)
    install_dir  "$SCRIPT_DIR/agents"   "$AGENTS_DEST"   "Agents   ($AGENT_COUNT)"
    install_dir  "$SCRIPT_DIR/skills"   "$SKILLS_DEST"   "Skills   ($SKILL_COUNT)"
    install_dir  "$SCRIPT_DIR/commands" "$COMMANDS_DEST" "Commands ($CMD_COUNT)"
    install_flat "$SCRIPT_DIR/rules"    "$RULES_DEST"    "Rules (flattened)"
    ;;

  aider)
    install_dir  "$SCRIPT_DIR/agents"   "$AGENTS_DEST"   "Agents   ($AGENT_COUNT)"
    install_dir  "$SCRIPT_DIR/skills"   "$SKILLS_DEST"   "Skills   ($SKILL_COUNT)"
    install_dir  "$SCRIPT_DIR/commands" "$COMMANDS_DEST" "Commands ($CMD_COUNT)"
    install_flat "$SCRIPT_DIR/rules"    "$RULES_DEST"    "Rules (flattened)"
    # Aider integration: write a CONVENTIONS.md at project root that points to .aider-ecc/
    CONVENTIONS_FILE="$(pwd)/CONVENTIONS.md"
    if [[ ! -f "$CONVENTIONS_FILE" ]]; then
      cat > "$CONVENTIONS_FILE" <<'AIDER_EOF'
# Project Conventions (Aider)

This project uses **Kodelyth ECC** for AI agent guidance.

Aider auto-loads this file. To bring full ECC context into your session:

```bash
aider --read .aider-ecc/rules/agent-intent-routing.md \
      --read .aider-ecc/rules/coding-standards.md \
      --read .aider-ecc/rules/self-improvement-workflow.md
```

For a specialist agent, also read its file:

```bash
aider --read .aider-ecc/agents/debug-detective.md
aider --read .aider-ecc/agents/security-reviewer.md
aider --read .aider-ecc/agents/prompt-injection-hunter.md
```

Full catalog: `.aider-ecc/agents/`, `.aider-ecc/skills/`, `.aider-ecc/commands/`, `.aider-ecc/rules/`.

Powered by Kodelyth ECC — github.com/sifxprime/kodelyth-ecc
AIDER_EOF
      echo -e "  ${GREEN}✓${RESET} CONVENTIONS.md ${BLUE}(→ $CONVENTIONS_FILE)${RESET}"
    else
      echo -e "  ${YELLOW}·${RESET} CONVENTIONS.md exists — not overwriting (manually add: --read .aider-ecc/rules/agent-intent-routing.md)"
    fi
    ;;

  kimi)
    install_dir  "$SCRIPT_DIR/agents"   "$AGENTS_DEST"   "Agents   ($AGENT_COUNT)"
    install_dir  "$SCRIPT_DIR/skills"   "$SKILLS_DEST"   "Skills   ($SKILL_COUNT)"
    install_dir  "$SCRIPT_DIR/commands" "$COMMANDS_DEST" "Commands ($CMD_COUNT)"
    install_flat "$SCRIPT_DIR/rules"    "$RULES_DEST"    "Rules (flattened)"
    ;;

  gemini-project|gemini-home)
    install_dir  "$SCRIPT_DIR/agents"   "$AGENTS_DEST"   "Agents   ($AGENT_COUNT)"
    install_dir  "$SCRIPT_DIR/skills"   "$SKILLS_DEST"   "Skills   ($SKILL_COUNT)"
    install_flat "$SCRIPT_DIR/rules"    "$RULES_DEST"    "Rules (flattened)"
    # Gemini CLI integration: write a GEMINI.md at the install location
    GEMINI_FILE="$DEST/GEMINI.md"
    if [[ ! -f "$GEMINI_FILE" ]]; then
      cat > "$GEMINI_FILE" <<'GEMINI_EOF'
# Kodelyth ECC — Gemini CLI context

This project uses Kodelyth ECC — 70 specialist agents, 194 skills, 97 commands, intent routing, and self-learning memory.

The full toolkit is installed under this directory:

- `agents/` — specialist subagents (debug-detective, security-reviewer, devil-mode crew)
- `skills/` — domain knowledge files
- `rules/` — always-on coding standards + intent routing rule

The `agent-intent-routing.md` rule maps plain-language requests to the right specialist. Read `agents/<name>.md` to invoke a specialist explicitly.

For more: github.com/sifxprime/kodelyth-ecc
GEMINI_EOF
      echo -e "  ${GREEN}✓${RESET} GEMINI.md ${BLUE}(→ $GEMINI_FILE)${RESET}"
    fi
    ;;
esac

# ── Install bundle cheat sheet (if --bundle was set) ──────────────────────────
if [[ -n "$BUNDLE" ]] && [[ -f "$SCRIPT_DIR/bundles/$BUNDLE.md" ]]; then
  cp "$SCRIPT_DIR/bundles/$BUNDLE.md" "$DEST/BUNDLE.md"
  echo -e "  ${GREEN}✓${RESET} Bundle cheat sheet (${BOLD}$BUNDLE${RESET}) ${BLUE}(→ $DEST/BUNDLE.md)${RESET}"
fi

# ── Write install state ───────────────────────────────────────────────────────
VERSION="$(cat "$SCRIPT_DIR/VERSION" 2>/dev/null || echo "1.0.0")"
STATE_FILE="$DEST/kodelyth-ecc-install-state.json"
cat > "$STATE_FILE" <<EOF
{
  "installed_by": "kodelyth-ecc",
  "version": "$VERSION",
  "target": "$TARGET",
  "bundle": "$BUNDLE",
  "installed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "languages": $(printf '%s\n' "${LANGUAGE_MODULES[@]+"${LANGUAGE_MODULES[@]}"}" | jq -R . | jq -s . 2>/dev/null || echo "[]")
}
EOF
echo -e "  ${GREEN}✓${RESET} Install state ${BLUE}(→ $STATE_FILE)${RESET}"

# ── Bundle-specific reminder ──────────────────────────────────────────────────
if [[ -n "$BUNDLE" ]]; then
  echo ""
  case "$BUNDLE" in
    indie-hacker)
      echo -e "${BOLD}${CYAN}  Bundle: Indie Hacker is active.${RESET}"
      echo "  Lead with: /project-launch (new) • /tdd • /devil-mode --pre-public (before going public)"
      echo "  Read: $DEST/BUNDLE.md for the full ship-fast playbook."
      ;;
    red-team)
      echo -e "${BOLD}${RED}  Bundle: Red Team is active.${RESET}"
      echo "  Lead with: /devil-mode (4-agent sweep) • /devil-mode --all (full 8-agent crew)"
      echo "  Read: $DEST/BUNDLE.md for the adversarial workflow playbook."
      ;;
    enterprise)
      echo -e "${BOLD}${CYAN}  Bundle: Enterprise is active.${RESET}"
      echo "  Lead with: /team-review (per-PR) • /pre-release (per-tag) • /devil-mode --pre-launch"
      echo "  Read: $DEST/BUNDLE.md for the compliance + audit playbook."
      ;;
  esac
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "  ─────────────────────────────────────────────────────────────"
echo ""
echo -e "${GREEN}${BOLD}  ARMED AND OPERATIONAL.${RESET}"
echo ""

case "$TARGET" in
  claude-home)
    echo -e "${BOLD}  Claude Code — what to do now:${RESET}"
    echo ""
    echo "  Open any project in Claude Code, then:"
    echo ""
    echo "    use kodelyth-advisor       ← not sure where to start"
    echo "    use pair-programmer        ← before writing anything"
    echo "    use debug-detective        ← when a bug won't die"
    echo "    use ux-reviewer            ← after touching any UI"
    echo "    /kodelyth-quickstart       ← full onboarding guide"
    echo ""
    echo "  Intent routing is god-tier — describe your problem in plain words"
    echo "  and the right specialist agent is auto-suggested."
    ;;
  antigravity)
    echo -e "${BOLD}  Google Antigravity — what to do now:${RESET}"
    echo ""
    echo "  Open your project in Antigravity."
    echo "  18 rules loaded automatically — ECC is already running."
    echo ""
    echo "  Model stack (approved):"
    echo "    Gemini 3.1 Pro (Low)       ← daily coding, components, APIs"
    echo "    Gemini 3.1 Pro (High)      ← hard bugs, architecture"
    echo "    Claude Sonnet 4.6          ← agent behavior, deep reasoning"
    echo "    Claude Opus 4.6            ← last resort, maximum power"
    echo ""
    echo "  Agents — call by name:"
    echo "    use kodelyth-advisor       ← direction"
    echo "    use pair-programmer        ← before coding"
    echo "    use debug-detective        ← root cause"
    echo "    use ux-reviewer            ← UI/UX review"
    echo "    use api-guardian           ← API contract check"
    ;;
  cursor-project)
    echo -e "${BOLD}  Cursor — what to do now:${RESET}"
    echo ""
    echo "  Open your project in Cursor."
    echo "  Rules are active. Agents available in .cursor/skills/"
    echo "    use kodelyth-advisor"
    ;;
  windsurf-project|windsurf-home)
    RULE_COUNT=$(find "$SCRIPT_DIR/rules/common" -maxdepth 1 -name "*.md" ! -name "agent-intent-routing.md" | wc -l | tr -d ' ')
    echo -e "${BOLD}  Windsurf — what to do now:${RESET}"
    echo ""
    echo "  Open your project in Windsurf (Cascade)."
    echo "  .windsurfrules is active — $RULE_COUNT coding rules + intent routing loaded automatically."
    echo "  Agents available in .windsurf/agents/"
    echo ""
    echo "    use kodelyth-advisor       ← not sure where to start"
    echo "    use debug-detective        ← trace any bug to root cause"
    echo "    use ux-reviewer            ← after touching any UI"
    echo "    use api-guardian           ← API contract protection"
    ;;
  cline)
    echo -e "${BOLD}  Cline (VS Code) — what to do now:${RESET}"
    echo ""
    echo "  Open the project in VS Code with Cline installed."
    echo "  Cline auto-loads .clinerules/ — all 70 agents, rules, and commands as markdown context."
    echo "    Ask: 'use debug-detective'  /  'review my code'  /  'devil mode the codebase'"
    ;;
  roocode)
    echo -e "${BOLD}  Roo Code — what to do now:${RESET}"
    echo ""
    echo "  Open the project in VS Code with Roo Code."
    echo "  Rules, agents, skills, commands installed under .roo/"
    echo "    Ask: 'use kodelyth-advisor' or 'use debug-detective'"
    ;;
  aider)
    echo -e "${BOLD}  Aider — what to do now:${RESET}"
    echo ""
    echo "  CONVENTIONS.md created at project root — Aider auto-reads it."
    echo "  Full ECC toolkit under .aider-ecc/"
    echo ""
    echo "  Recommended startup:"
    echo "    aider --read .aider-ecc/rules/agent-intent-routing.md \\"
    echo "          --read .aider-ecc/rules/coding-standards.md"
    echo ""
    echo "  Then describe your problem in plain words; intent routing fires."
    ;;
  kimi)
    echo -e "${BOLD}  Kimi Code — what to do now:${RESET}"
    echo ""
    echo "  Open the project with Kimi CLI."
    echo "  Rules, agents, skills, commands installed under .kimi/"
    echo "    Ask: 'use kodelyth-advisor'"
    ;;
  gemini-project|gemini-home)
    echo -e "${BOLD}  Gemini CLI — what to do now:${RESET}"
    echo ""
    if [[ "$TARGET" == "gemini-project" ]]; then
      echo "  Project install at .gemini/ + GEMINI.md auto-loaded by Gemini CLI."
    else
      echo "  Global install at ~/.gemini/ + GEMINI.md auto-loaded by Gemini CLI."
    fi
    echo "  Agents in agents/, skills in skills/, rules in rules/"
    echo "    Ask: 'use debug-detective' or 'use kodelyth-advisor'"
    ;;
  *)
    echo -e "${BOLD}  What to do now:${RESET}"
    echo "  Restart your AI agent. Rules, agents, and skills are live."
    echo "    use kodelyth-advisor"
    ;;
esac

echo ""
echo -e "  ─────────────────────────────────────────────────────────────"
echo -e "  ${CYAN}${BOLD}Kodelyth ECC v$(cat "$SCRIPT_DIR/VERSION" 2>/dev/null || echo "1.1.0")${RESET}  ·  github.com/sifxprime/kodelyth-ecc"
echo -e "  Powered by ${BOLD}Kodelyth${RESET}"
echo ""
