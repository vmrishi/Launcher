#!/usr/bin/env bash
set -euo pipefail
cd /workspace/Launcher
# Use the existing isolated checkout. Do not create another Git worktree.
export XDG_CACHE_HOME=/workspace/.cache
export ELECTRON_CACHE=/workspace/.cache/electron
export electron_config_cache=/workspace/.cache/electron
export ELECTRON_BUILDER_CACHE=/workspace/.cache/electron-builder
export NODE_USE_ENV_PROXY=1
mkdir -p "$ELECTRON_CACHE" "$ELECTRON_BUILDER_CACHE"
npm ci --cache /workspace/.cache/npm
npm test
npm run build
