#!/usr/bin/env bash
set -euo pipefail

# Install this skill into Codex and/or Claude Code skill directories.
#
# Usage:
#   ./install.sh --codex
#   ./install.sh --claude
#   ./install.sh --all
#
# Notes:
# - Codex typically uses ~/.codex/skills/
# - Claude Code typically uses ~/.claude/skills/ (some setups also use ~/.config/claude/skills/)

HERE="$(cd "$(dirname "$0")" && pwd)"
SKILL_NAME="tanstack-suite"

want_codex=false
want_claude=false
want_all=false

for arg in "$@"; do
  case "$arg" in
    --codex) want_codex=true ;;
    --claude) want_claude=true ;;
    --all) want_all=true ;;
    -h|--help)
      echo "Usage: $0 [--codex|--claude|--all]"
      exit 0
      ;;
    *)
      echo "Unknown arg: $arg" >&2
      exit 1
      ;;
  esac
done

if $want_all; then
  want_codex=true
  want_claude=true
fi

if ! $want_codex && ! $want_claude; then
  echo "Nothing to do. Use --codex, --claude, or --all." >&2
  exit 1
fi

copy_skill() {
  local dest_root="$1"
  mkdir -p "$dest_root/$SKILL_NAME"
  # Copy everything except common build artifacts
  rsync -a --delete \
    --exclude ".git" \
    --exclude "node_modules" \
    --exclude "dist" \
    --exclude "build" \
    "$HERE/" "$dest_root/$SKILL_NAME/"
}

if $want_codex; then
  CODEX_DIR="$HOME/.codex/skills"
  echo "Installing to Codex: $CODEX_DIR/$SKILL_NAME"
  copy_skill "$CODEX_DIR"
fi

if $want_claude; then
  CLAUDE_DIR="$HOME/.claude/skills"
  echo "Installing to Claude Code: $CLAUDE_DIR/$SKILL_NAME"
  copy_skill "$CLAUDE_DIR"

  # Also try ~/.config/claude/skills if it exists
  ALT_CLAUDE_DIR="$HOME/.config/claude/skills"
  if [ -d "$ALT_CLAUDE_DIR" ]; then
    echo "Also installing to: $ALT_CLAUDE_DIR/$SKILL_NAME"
    copy_skill "$ALT_CLAUDE_DIR"
  fi
fi

echo "Done. Restart your agent so it re-indexes skills." 
