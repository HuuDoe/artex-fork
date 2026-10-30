#!/usr/bin/env bash
set -euo pipefail

# ARTEX fork — quick setup for a fresh machine.
# Handles: .env, Devin CLI install, docker-compose override, build & run.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

info()  { echo "[setup] $*"; }
die()   { echo "[setup] ERROR: $*" >&2; exit 1; }

# ── 1. .env ─────────────────────────────────────────────────────────────────

if [ ! -f .env ]; then
  info "Creating .env (edit afterward if needed)"
  cat > .env <<'EOF'
POSTGRES_PASSWORD=artex-local-2026

# LLM — configure via the web UI after first boot, or set here:
# OPENAI_API_KEY=sk-...
# ARTEX_LLM_PROVIDER=openai
# ARTEX_LLM_MODEL=claude-sonnet-4-20250514
# ARTEX_LLM_BASE_URL=https://api.openai.com/v1
EOF
  info ".env created — add your LLM API key before starting"
else
  info ".env already exists, skipping"
fi

# ── 2. Devin CLI ────────────────────────────────────────────────────────────

DEVIN_DATA="${XDG_DATA_HOME:-$HOME/.local/share}/devin"
DEVIN_CREDS="$DEVIN_DATA/credentials.toml"

if ! command -v devin &>/dev/null; then
  info "Installing Devin CLI..."
  curl -fsSL https://cli.devin.ai/install.sh | bash \
    || info "Auto-install failed. Visit https://devin.ai to install manually."
fi

if [ ! -f "$DEVIN_CREDS" ]; then
  info "Devin credentials not found at $DEVIN_CREDS"
  info "Run: devin login"
  info "This opens a browser for Devin Pro auth. After login, credentials.toml is created automatically."
  info ""
  read -rp "Press Enter after 'devin login' completes (or Ctrl+C to skip Devin)... "
fi

if [ -f "$DEVIN_CREDS" ]; then
  info "Devin credentials found at $DEVIN_CREDS"
else
  info "WARNING: No Devin credentials — Devin SWE-2 LLM profiles won't work"
fi

# ── 3. docker-compose.override.yml ──────────────────────────────────────────

if [ ! -f docker-compose.override.yml ]; then
  info "Creating docker-compose.override.yml from example"
  cp docker-compose.override.yml.example docker-compose.override.yml

  # Resolve Devin paths for this machine
  DEVIN_BIN_DIR="$DEVIN_DATA/cli/_versions/current/bin"
  if [ -d "$DEVIN_BIN_DIR" ]; then
    info "Devin CLI binary at $DEVIN_BIN_DIR"
  else
    info "WARNING: Devin CLI binary dir not found at $DEVIN_BIN_DIR"
    info "Set DEVIN_CLI_BIN in .env or fix the path in docker-compose.override.yml"
  fi
else
  info "docker-compose.override.yml already exists, skipping"
fi

# ── 4. Build ────────────────────────────────────────────────────────────────

info "Building ARTEX (this takes a few minutes on first run)..."
docker compose build

# ── 5. Start ────────────────────────────────────────────────────────────────

info "Starting ARTEX..."
docker compose up -d

info ""
info "ARTEX is starting up. Give it ~30s for postgres + migrations."
info "  Web UI:    http://localhost:8787"
info "  Login:     username=ARTEX  password=ARTEX"
info "  noVNC:     http://localhost:6080/vnc.html (headed browser viewing)"
info ""
info "Next steps:"
info "  1. Open http://localhost:8787, go to System > LLM Profiles"
info "  2. Add your LLM provider (OpenAI/Anthropic/Devin SWE-2)"
info "  3. Create a task and start pentesting"
