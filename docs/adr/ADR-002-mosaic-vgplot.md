# ADR-002 — Mosaic + vgplot comme moteur de rendu V1

| Champ | Valeur |
|---|---|
| Statut | Accepté avec caveat (cf. R-8) |
| Date | 2026-05-28 |
| Source | [PRD.md §6.3](../../PRD.md#63-décisions-architecturales-clés-adrs-synthétisés) |
| Sponsor | DSI CPAM 92 + Data analyst lead |

## Contexte

Le moteur de visualisation doit (1) être déclaratif (spec JSON portable, versionnable Git), (2) coordonner nativement plusieurs vues (cross-filter, drill-down), (3) pousser les calculs dans DuckDB (push-down SQL — aligné avec ADR-001), (4) supporter des volumes de l'ordre de plusieurs centaines de Mo de Parquet.

Trois familles d'alternatives ont été évaluées : **Mosaic + vgplot** (UW IDL, IEEE VIS 2024), **Vega-Lite + VegaFusion** (serveur Rust), **Observable Plot** (très flexible mais coordonné manuellement).

## Décision

Moteur de rendu = **Mosaic** (UW IDL) + grammaire haut-niveau **vgplot**.

## Conséquences

**Justification** :
- Architecture conçue dès l'origine pour DuckDB : les transformations (agrégations, binning, filtres) sont compilées en SQL et **poussées dans DuckDB**, pas exécutées côté JS. Aligné par construction avec ADR-001 (DuckDB natif).
- Cross-filter et coordination de vues sont des **primitives natives** (sélections partagées entre vues via un coordonnateur unique) — pas un assemblage de patterns à coder.
- Performance par ordre de grandeur supérieure à Vega-Lite sur les volumes cibles (papier IEEE VIS 2024 : *« Mosaic outperforms Vega, VegaFusion, and Observable Plot, typically by one or more orders of magnitude »*).
- Grammaire vgplot inspirée de Vega-Lite / ggplot / Observable Plot — courbe d'apprentissage modérée pour un auteur familier de ces outils.

**Caveat documenté** : les mainteneurs Mosaic signalent dans leur README que la lib n'est pas formellement « production-ready » à la date de rédaction (API encore mouvante). Mitigation :
- **Verrouiller la version** au démarrage du POC dans le lockfile et ne pas suivre `main`.
- Maintenir une **fine couche d'abstraction `viz-engine`** côté front pour isoler les appels Mosaic et permettre un repli sur Vega-Lite uniquement si Mosaic se révèle bloquant en POC (escalade I2 du V0).
- Re-tester à chaque mise à jour Mosaic en CI.

**Conséquence opérationnelle** :
- Le champ `engine` du `.vviz` vaut `"mosaic"` par défaut.
- Format de spec = vgplot (à confirmer en POC : JSON pur ou DSL à transformer en JSON via préprocesseur côté Rust, cf. §16 Q7).
- Versions Mosaic verrouillées en début de POC.
- Couche `src/viz-engine/` isole Mosaic du reste du front (compileur DSL→vgplot).

**Risque résiduel R-8** : si Mosaic se révèle bloquant en POC, repli sur Vega-Lite via le même DSL `.vviz`.

## Versions verrouillées au POC (2026-05-28)

| Package | Version |
|---|---|
| `@uwdata/vgplot` | `0.26.0` |
| `@uwdata/mosaic-core` | `0.26.0` |
| `@uwdata/mosaic-sql` | `0.26.0` |

Source : `npm view <pkg> version` au 2026-05-28. Verrouillé via
`package-lock.json` (Wave 3 / B-030). Ne pas suivre `main` — revoir
manuellement à chaque montée. Mitigation R-8 : lockfile autoritatif.

## Checkpoint R-8 (2026-05-28)

API utilisée à ce stade dans `src/viz-engine` / `src/main.ts` :

- `vg.plot(...directives)` (vgplot)
- `vg.dot(data, channels)` (vgplot) — `data` peut être un `Array`,
  auquel cas `Mark.hasOwnData()` court-circuite `prepare()` /
  `query()` (inspection `node_modules/@uwdata/mosaic-plot/src/marks/Mark.js`)
- `vg.width(...)`, `vg.height(...)` (vgplot attributes)
- Planifié B-031 : `vg.coordinator().databaseConnector(<custom>)` +
  interface `Connector.query({ type, sql }) → Promise`

État au moment du POC : **API conforme au plan** sur le périmètre
testé (plot statique inline). À re-vérifier en B-031 pour
`databaseConnector` et `vg.from(table)`. Aucune divergence
nécessitant un repli Vega-Lite à ce stade.

## Références

- [Mosaic (UW IDL)](https://idl.uw.edu/mosaic/)
- [Mosaic GitHub](https://github.com/uwdata/mosaic)
- [Heer & Moritz (2024) — Mosaic IEEE TVCG](https://idl.cs.washington.edu/files/2024-Mosaic-TVCG.pdf)
- [PRD.md §6.3 ADR-002](../../PRD.md), [PRD.md §13 R-8](../../PRD.md)
- Décisions liées : [ADR-001 DuckDB natif](ADR-001-duckdb-natif.md), [ADR-003 Parquet + Arrow](ADR-003-parquet-arrow.md)
