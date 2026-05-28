# Format `.vviz` — référence minimale V0

> Statut : **stub V0**. La spec auteur complète sera publiée en V1-8.

Un `.vviz` est un document JSON décrivant une visualisation ouvrable
dans VaultViz. Le schema canonique est `schema/vviz-v1.json` (validation
côté app via Ajv).

---

## Squelette minimal

```json
{
  "$schema": "https://vaultviz.fr/schema/v1.json",
  "vviz": {
    "version": "1.0",
    "title": "Mon dashboard"
  },
  "data": {
    "sources": [
      { "name": "ma_source", "path": "./donnees.parquet" }
    ]
  },
  "spec": {
    "engine": "mosaic",
    "views": [
      {
        "id": "v1",
        "type": "kpi",
        "source": "ma_source",
        "encoding": { "value": { "aggregate": "count" } }
      }
    ]
  }
}
```

---

## `data.sources[].path` — résolution des chemins

| Forme | Exemple | Résolution |
|---|---|---|
| UNC POSIX | `//host/share/data.parquet` | tel quel |
| Lecteur mappé Windows | `Z:/donnees.parquet` | tel quel |
| Absolu POSIX (dev) | `/tmp/x.parquet` | tel quel |
| Relatif au `.vviz` | `./x.parquet`, `../data/x.parquet`, `x.parquet` | résolu par rapport au dossier qui contient le `.vviz` (pas au répertoire courant du processus) |

Les schémes `http://`, `https://`, `ftp://`, `file://`, `data:`,
`javascript:` sont refusés au niveau du JSON Schema.

---

## Types de vues — V0

### `kpi`

```json
{
  "id": "k", "type": "kpi", "source": "src",
  "encoding": { "value": { "field": "n", "aggregate": "sum" } }
}
```

`aggregate` : `sum | avg | count | min | max`. `count` accepte d'omettre
`field` (équivaut à `COUNT(*)`).

### `bar` / `barX` / `barY`

```json
{
  "id": "b", "type": "barY", "source": "src",
  "encoding": {
    "x": { "field": "categorie" },
    "y": { "field": "valeur", "aggregate": "sum" }
  },
  "options": { "width": 480, "height": 280 }
}
```

`y.aggregate` défaut `count`. Si `count`, `y.field` peut être omis.

### `table`

```json
{
  "id": "t", "type": "table", "source": "src",
  "encoding": { "columns": ["col1", "col2", "col3"] },
  "options": {
    "limit": 5000,
    "visibleRows": 15,
    "filterField": "code_dept"
  }
}
```

Si `filterBy` (selection) + `filterField` sont posés, le clic d'une
vue émettrice re-query la table avec `WHERE filterField = '<valeur>'`.

### `map_choropleth`

```json
{
  "id": "m", "type": "map_choropleth", "source": "src",
  "encoding": {
    "geo": { "field": "code_dept" },
    "color": { "field": "effectif", "aggregate": "sum" }
  },
  "options": {
    "width": 560, "height": 560,
    "emitsTo": "dept_sel"
  }
}
```

Le fond de carte départemental France métropole (96 départements) est
embarqué. `geo.field` doit pointer vers un code département en
2 caractères (`"01"` à `"96"`).

**Cible V1-1 / V1-2** : remplacement par MapLibre GL JS + TopoJSON IGN
ADMIN EXPRESS pour communes et drill.

---

## Cross-filter (`spec.selections` + `view.filterBy`)

```json
{
  "spec": {
    "engine": "mosaic",
    "selections": [
      { "id": "dept_sel", "kind": "single" }
    ],
    "views": [
      {
        "id": "carte", "type": "map_choropleth", "source": "src",
        "encoding": { "geo": { "field": "code_dept" }, "color": { "field": "effectif", "aggregate": "sum" } },
        "options": { "emitsTo": "dept_sel" }
      },
      {
        "id": "kpi", "type": "kpi", "source": "src",
        "encoding": { "value": { "field": "effectif", "aggregate": "sum" } },
        "filterBy": "dept_sel"
      }
    ]
  }
}
```

- `selections[]` déclare l'identifiant + `kind` (`single` pour V0).
- Une vue **émet** en ajoutant `options.emitsTo: "<id>"` (carte choro).
- Les autres vues **filtrent** en ajoutant `filterBy: "<id>"`.
- Au clic, la selection est mise à jour ; les vues `filterBy` re-query
  DuckDB automatiquement (push-down SQL via mosaic-sql).

---

## Layout (`spec.layout`)

- `"vstack"` (défaut) : vues empilées verticalement.
- `"hstack"` : vues côte à côte.
- `"grid"` : grille (heuristique V0 — préciser en V1).

---

## Erreurs et validation

À l'ouverture d'un `.vviz` :

1. Lecture FS (capability Tauri). Erreur typée : `NotFound` / `Forbidden` / `Io`.
2. `JSON.parse`. Erreur typée : `Corrupt`.
3. Validation Ajv contre `schema/vviz-v1.json`. Erreur typée : `Invalid`
   avec liste de violations (`/spec/views/0/encoding/geo/field: must be string`).
4. Pour chaque vue : compilation DSL → SQL. Erreur affichée
   contextuellement dans le cadre de la vue.

Aucune stack trace n'est exposée à l'utilisateur. Logs détaillés dans
`%LOCALAPPDATA%\VaultViz\logs\YYYY-MM-DD.log`.

---

## Exemples livrés

| Fichier | Couvre |
|---|---|
| `examples/effectifs_2026.vviz` | KPI + bar + table (smoke sur `sample.parquet`) |
| `examples/demo_dept.vviz` | UC-1 + UC-3 carte choro + cross-filter (sur `demo_dept.parquet`) |

Le binaire `cargo run --release --example gen_demo_dept` régénère
`demo_dept.parquet` (4 ko, 96 deps × 8 catégories).
