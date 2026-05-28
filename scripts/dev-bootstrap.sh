#!/usr/bin/env bash
# VaultViz — dev environment bootstrap
# Idempotent. Re-runnable. Installs/checks tooling.
set -euo pipefail

echo "== VaultViz dev bootstrap =="

# Rust toolchain
if ! command -v rustup >/dev/null; then
    echo "ERREUR : rustup non installé. Voir https://rustup.rs/"
    exit 1
fi
rustup show active-toolchain

# Cargo tools
if ! command -v cargo-tauri >/dev/null && ! cargo tauri --version >/dev/null 2>&1; then
    echo "Installation tauri-cli…"
    cargo install --locked tauri-cli@^2.0
fi
if ! command -v cargo-audit >/dev/null; then
    echo "Installation cargo-audit…"
    cargo install --locked cargo-audit
fi

# Node / npm
if ! command -v npm >/dev/null; then
    echo "ERREUR : npm non installé."
    exit 1
fi

# Global npm tools
if ! command -v ajv >/dev/null; then
    echo "Installation ajv-cli…"
    npm install -g ajv-cli ajv-formats
fi

echo ""
echo "== Versions =="
rustc --version
cargo --version
cargo tauri --version
node --version
npm --version
ajv --version 2>/dev/null | head -1 || echo "ajv installé (version via 'ajv help')"

echo ""
echo "OK — environnement prêt."
