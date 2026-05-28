# ADR-001 — DuckDB natif via `duckdb-rs`, pas WASM

| Champ | Valeur |
|---|---|
| Statut | Accepté |
| Date | 2026-05-28 |
| Source | [PRD.md §6.3](../../PRD.md#63-décisions-architecturales-clés-adrs-synthétisés) |
| Sponsor | DSI CPAM 92 |

## Contexte

VaultViz doit exécuter des requêtes analytiques (push-down SQL) sur des fichiers Parquet posés sur un partage SMB/UNC, depuis un poste Windows 11 cadre. Le moteur SQL doit être embarqué dans le binaire applicatif (pas de serveur), capable de gérer des volumes de plusieurs Go en mémoire vive, et compatible avec une architecture viz orientée push-down (cf. ADR-002).

Trois options ont été considérées : DuckDB **natif** (via `duckdb-rs` feature `bundled`, compilation statique en C++), DuckDB-**WASM** (transcompilé pour exécution dans la WebView2), ou un moteur tiers (SQLite, ClickHouse-local).

## Décision

Embarquer DuckDB en **natif** via le crate `duckdb-rs` avec feature `bundled` (compilation statique, aucune dépendance système).

## Conséquences

**Justification** :
- DuckDB-WASM ne peut **pas spiller sur disque** et reste mono-thread ; au-delà de quelques centaines de Mo en pratique, expérience dégradée. Source écosystème : [DuckDB-WASM discussions](https://github.com/duckdb/duckdb-wasm/discussions).
- DuckDB-WASM est **significativement plus lent** que natif sur Parquet (facteur observé ~4× sur cas courants). Référence : [discussions perf DuckDB](https://github.com/duckdb/duckdb/discussions).
- Le plafond mémoire WASM (4 Go en wasm32) est levable via memory64 dans les navigateurs récents, mais au prix d'une perte de performance et d'un support DuckDB-WASM non-default.
- Pour lire un partage SMB depuis WebView2, WASM doit passer par un bridge JS → coût IPC évitable. Natif lit le chemin UNC directement.

**Conséquence opérationnelle** :
- Pas de DuckDB-WASM en V1.
- WASM réétudié en V2 uniquement si un cas d'usage browser-only émerge.
- Le crate `duckdb-rs` doit être verrouillé dans `Cargo.lock` ; suivre la dernière minor stable au démarrage du POC.
- Taille binaire impactée (~30 Mo statique) — à surveiller vs cible MSI < 30 Mo (PRD §9.1).

## Références

- [crate `duckdb-rs`](https://crates.io/crates/duckdb)
- [DuckDB releases](https://duckdb.org/release_calendar)
- [PRD.md §6.3 ADR-001](../../PRD.md)
- Décisions liées : [ADR-003 Parquet + Arrow](ADR-003-parquet-arrow.md), [ADR-002 Mosaic](ADR-002-mosaic-vgplot.md)
