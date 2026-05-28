# ADR-007 — Chemins UNC `//host/share/...` + scope FS Tauri explicite

| Champ | Valeur |
|---|---|
| Statut | Accepté (à valider H1 en POC) |
| Date | 2026-05-28 |
| Source | [PRD.md §6.3](../../PRD.md#63-décisions-architecturales-clés-adrs-synthétisés) |
| Sponsor | DSI CPAM 92, RSSI CPAM 92 |

## Contexte

Les données métier (Parquet, TopoJSON) sont posées sur un partage SMB CPAM accédé via UNC. Deux formes coexistent dans l'écosystème : `\\host\share\...` (Windows historique) et `//host/share/...` (POSIX-like, accepté par de nombreux outils). Certaines extensions DuckDB et certains parsers JSON Schema gèrent mal la forme antislash. Par ailleurs, Tauri 2 impose un scope FS explicite par capability — il faut y inclure le préfixe UNC retenu.

## Décision

Tous les chemins data dans les `.vviz` utilisent **`//host/share/...`** (double slash, séparateurs `/`). Le scope du plugin-fs Tauri est élargi en capabilities à **`//cpam92/share/**`** (ou équivalent par déploiement).

## Conséquences

**Justification** :
- Certaines extensions DuckDB parsent mal `\\host\share\...` ([issue duckdb-delta #183](https://github.com/duckdb/duckdb-delta/issues/183)).
- Tauri `FilePath` documente la conversion UNC, mais le scope glob doit l'inclure explicitement — **à valider en POC** (hypothèse H1).
- Forme `//host/share/...` portable entre outils (curl, Node, DuckDB, ajv).

**Conséquence opérationnelle** :
- Doc auteur de spec impose cette convention.
- Validation côté JSON Schema `.vviz` (pattern regex sur `path` : `^//[^/]+/.+`).
- En dev hors share : chemins relatifs `./...` autorisés ; lettres de lecteur mappées `[A-Z]:/...` autorisées en fallback.
- Scope FS paramétré via variables d'environnement (`VVIZ_HOST`, `VVIZ_SHARE`) pour chaque déploiement.
- Story B-011 (V0) : implémente le scope dans `capabilities/main.json`.
- Story B-012 (V0) : valide H1 en POC sur share réel CPAM (reporté à V1 si non disponible en V0, validation locale `./` en substitut).

## Références

- [Tauri capability scope](https://v2.tauri.app/security/capabilities/)
- [Tauri plugin-fs](https://v2.tauri.app/plugin/file-system/)
- [issue duckdb-delta #183](https://github.com/duckdb/duckdb-delta/issues/183)
- [PRD.md §6.3 ADR-007](../../PRD.md), [PRD.md §1.4 H1](../../PRD.md), [PRD.md §13 R-2](../../PRD.md)
- Décisions liées : [ADR-004 Tauri 2](ADR-004-tauri-2.md), [ADR-008 No network](ADR-008-no-network.md)
