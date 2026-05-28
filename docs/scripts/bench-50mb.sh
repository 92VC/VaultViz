#!/usr/bin/env bash
# Bench B-023 — exécute trois requêtes représentatives sur le Parquet
# synthétique 50 Mo et mesure :
#   - temps wall-clock par requête (côté binaire Rust, instant_to_instant)
#   - RAM peak (RSS) via `/usr/bin/time -v` sur le processus complet
#
# Pré-requis : `examples/synth_50mb.parquet` (généré par
# `docs/scripts/gen-synth-parquet.sh 50`).
#
# Sortie : log lisible piping-friendly, à archiver dans
# `docs/bench/run-50mb-linux-<YYYYMMDD>.log`.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PARQUET="${1:-${ROOT}/examples/synth_50mb.parquet}"

if [[ ! -f "$PARQUET" ]]; then
  echo "Fichier manquant : $PARQUET"
  echo "Lancer d'abord : docs/scripts/gen-synth-parquet.sh 50"
  exit 1
fi

cd "$ROOT/src-tauri"
echo "[bench-50mb.sh] compilation example bench_50mb…"
cargo build --release --example bench_50mb >/dev/null

BENCH_BIN="$ROOT/src-tauri/target/release/examples/bench_50mb"

echo "[bench-50mb.sh] === run /usr/bin/time -v ==="
/usr/bin/time -v "$BENCH_BIN" "$PARQUET"
