# ADR-003 — Parquet comme format pivot, Arrow IPC pour transit

| Champ | Valeur |
|---|---|
| Statut | Accepté |
| Date | 2026-05-28 |
| Source | [PRD.md §6.3](../../PRD.md#63-décisions-architecturales-clés-adrs-synthétisés) |
| Sponsor | DSI + Publisher ETL |

## Contexte

Les données métier consommées par VaultViz transitent par un partage SMB/UNC et doivent être lues par DuckDB côté Rust, puis transmises à la WebView2 pour rendu Mosaic. Le format de stockage et le format de transit IPC sont deux décisions distinctes mais corrélées.

Alternatives évaluées : JSON, CSV, Parquet pour le stockage ; JSON, MessagePack, Arrow IPC pour le transit.

## Décision

Parquet (Snappy par défaut, ZSTD pour gros volumes archivés) est le **seul** format de données de production sur le share. **Arrow IPC** sert au transport Rust → WebView2.

## Conséquences

**Justification Parquet** :
- Compressé colonnaire ; supporte **predicate pushdown**, **column pruning**, **row group skipping** — gain de l'ordre de **deux ordres de grandeur** vs JSON sur scans analytiques selon les benchmarks publics (Spark, AWS Athena, etc.).
- JSON pour des données métier > 10 Mo est explicitement **banni** : overhead, pas de pushdown, parse mémoire prohibitive.

**Justification Arrow IPC** :
- Zero-décode côté JS via Arrow.js (Table reconstituée à partir d'un buffer binaire).
- Support natif côté DuckDB (`query_arrow()` retourne un RecordBatchReader).
- Pas de sérialisation JSON intermédiaire — économie CPU et RAM mesurable sur gros résultsets.

**Conséquence opérationnelle** :
- Le pipeline ETL publisher **doit** sortir du Parquet. Toute exception (CSV legacy) est traitée par **conversion en amont**, pas dans VaultViz.
- Pas de chargeur CSV dans VaultViz.
- Compression : Snappy par défaut ; ZSTD pour Parquet archivés > 200 Mo après compression (cf. PRD §7.2).
- Transit Rust↔JS : exclusivement bytes Arrow IPC (`Vec<u8>` → `Uint8Array` → `Table.from`).

## Références

- [Apache Arrow](https://arrow.apache.org/)
- [Apache Arrow releases](https://arrow.apache.org/release/)
- [Parquet format](https://parquet.apache.org/)
- [PRD.md §6.3 ADR-003](../../PRD.md), [PRD.md §7](../../PRD.md)
- Décisions liées : [ADR-001 DuckDB natif](ADR-001-duckdb-natif.md), [ADR-002 Mosaic](ADR-002-mosaic-vgplot.md)
