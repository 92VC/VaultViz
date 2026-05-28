#!/usr/bin/env bash
# Génère un Parquet synthétique de taille cible (Mo) pour les benchs
# B-023 (50 Mo) et B-080 (300 Mo).
#
# Pourquoi un binaire Rust et pas le CLI `duckdb` ? Sur les dev box
# Fedora actuelles, le CLI n'est pas systématiquement installé, alors
# que le crate `duckdb` (cf. B-020) l'est dès qu'on a `cargo`. Avantage
# supplémentaire : format Parquet *strictement* identique au runtime.

set -euo pipefail

SIZE_MB="${1:-50}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${2:-${ROOT}/examples/synth_${SIZE_MB}mb.parquet}"

mkdir -p "$(dirname "$OUT")"

echo "[gen-synth-parquet.sh] taille cible : ${SIZE_MB} Mo → ${OUT}"
echo "[gen-synth-parquet.sh] compilation example gen_synth (peut prendre ~4 min première fois)…"

cd "$ROOT/src-tauri"
cargo build --release --example gen_synth >/dev/null

"$ROOT/src-tauri/target/release/examples/gen_synth" "$SIZE_MB" "$OUT"

echo "[gen-synth-parquet.sh] taille réelle : $(du -h "$OUT" | cut -f1)"
