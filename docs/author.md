# VaultViz — Guide auteur de spec `.vviz`

> Version 1.0 · Public : data analysts · Schéma de référence : `schema/vviz-v1.json`

---

## 1. Anatomie d'un fichier `.vviz`

Un `.vviz` est un fichier **JSON** structuré en trois blocs obligatoires : `vviz`, `data`, `spec`.

```json
{
  "$schema": "./vviz-v1.json",
  "vviz": {
    "version": "1.0",
    "title":   "Mon tableau de bord",
    "author":  "Mehdi D.",
    "created": "2026-01-15"
  },
  "data": {
    "sources": [
      { "name": "ma_source", "inline": "<base64 Parquet>" }
    ]
  },
  "spec": {
    "engine": "mosaic",
    "layout": "vstack",
    "views": [
      {
        "id":     "v1",
        "type":   "kpi",
        "source": "ma_source",
        "encoding": { "value": { "aggregate": "count" } }
      }
    ]
  }
}
```

### Bloc `vviz` — métadonnées

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `version` | `"1.0"` | Oui | Version du format (constante) |
| `title` | string | Oui | Titre du dashboard (1–200 car.) |
| `description` | string | Non | Description longue (max 2 000 car.) |
| `author` | string | Non | Auteur |
| `created` / `updated` | date ISO | Non | `YYYY-MM-DD` |

### Bloc `data.sources[]` — sources de données

Chaque source a un `name` (identifiant SQL alphanumérique) et **soit** `inline`, soit `path` :

| Champ | Description |
|-------|-------------|
| `name` | Alias logique : `[a-zA-Z_][a-zA-Z0-9_]{0,63}` |
| `inline` | Parquet encodé en base64 → fichier autoporteur (recommandé, cf. §4) |
| `path` | Chemin vers un Parquet externe sur share/disque (cf. §4) |

### Bloc `spec` — spécification de visualisation

| Champ | Requis | Description |
|-------|--------|-------------|
| `engine` | Oui | `"mosaic"` (seule valeur V1) |
| `layout` | Non | `"vstack"` (défaut) · `"hstack"` · `"grid"` · `"dashboard"` |
| `gridRatio` | Non | Layout `dashboard` : ratio `[principale, latérale]`, ex. `[1.32, 1]` |
| `views[]` | Oui | Liste des vues (1–32) |
| `tabs[]` | Non | Onglets du dashboard |
| `selections[]` | Non | Déclaration des selections cross-filter |
| `slicers[]` | Non | Filtres multi-valeurs (cases à cocher) |

---

## 2. Référence des types de vues

### Champs communs à toutes les vues

| Champ | Requis | Description |
|-------|--------|-------------|
| `id` | Oui | Identifiant unique dans le document : `[a-zA-Z_][a-zA-Z0-9_]{0,63}` |
| `type` | Oui | Type de vue (voir liste ci-dessous) |
| `source` | Oui | Référence à `data.sources[].name` |
| `title` | Non | Titre affiché au-dessus de la vue |
| `filterBy` | Non | ID d'une `spec.selections[]` — reçoit le cross-filter |
| `encoding` | Selon type | Mapping champ ↔ canal visuel |
| `options` | Non | Options de rendu (largeur, hauteur, format…) |

### `kpi` — indicateur clé

Affiche une valeur agrégée, avec delta optionnel.

```json
{
  "id": "kpi_agents",
  "type": "kpi",
  "source": "effectifs",
  "title": "Total agents",
  "encoding": {
    "value": { "field": "nb_agents", "aggregate": "sum" },
    "delta": { "field": "variation", "aggregate": "sum" }
  },
  "options": {
    "format": ",.0f",
    "foot": "au 1er janvier",
    "icon": "users",
    "deltaUnit": "%",
    "region": "kpi"
  }
}
```

`encoding.value` et `encoding.delta` acceptent : `field` (string) + `aggregate` (`sum`|`avg`|`count`|`min`|`max`). `count` n'exige pas de `field`.

### `bar` / `barX` / `barY` — histogramme

Les trois alias sont équivalents ; `barY` est idiomatique (barres verticales).

```json
{
  "id": "bar_dept",
  "type": "barY",
  "source": "effectifs",
  "title": "Agents par département",
  "encoding": {
    "x": { "field": "code_dept" },
    "y": { "field": "nb_agents", "aggregate": "sum" }
  },
  "options": {
    "width": 600,
    "height": 280,
    "sort": "DESC",
    "valueLabels": true,
    "format": ",.0f"
  }
}
```

**Options spéciales :**

| Option | Description |
|--------|-------------|
| `sort` | `"DESC"` (défaut) ou `"ASC"` — classe les barres par valeur |
| `orderByKey` | `true` → trie par la clé (ex. mois chronologiques) |
| `valueLabels` | `true` → affiche la valeur sur chaque barre |
| `format` | Format d4 de la valeur (ex. `",.0f"`, `".1%"`) |
| `compareField` | Nom d'un second champ → bascule en barres groupées |
| `seriesLabels` | `["label1", "label2"]` — étiquettes des deux séries groupées |
| `filterField` | Champ de filtre reçu depuis une selection |

### `line` / `area` / `dot` — séries temporelles et nuages

```json
{
  "id": "courbe_mensuelle",
  "type": "line",
  "source": "dossiers",
  "title": "Dossiers traités",
  "encoding": {
    "x":      { "field": "mois" },
    "y":      { "field": "nb_dossiers", "aggregate": "sum" },
    "series": { "field": "type_dossier" }
  },
  "options": { "width": 800, "height": 300 }
}
```

`encoding.series.field` permet de tracer plusieurs courbes (une par valeur distincte du champ). `area` ajoute un remplissage sous la courbe. `dot` trace un nuage de points.

### `pie` — camembert

```json
{
  "id": "repartition",
  "type": "pie",
  "source": "effectifs",
  "title": "Répartition par statut",
  "encoding": {
    "x": { "field": "statut" },
    "y": { "field": "nb_agents", "aggregate": "sum" }
  },
  "options": { "format": ",.0f" }
}
```

`encoding.x.field` = dimension catégorielle (les tranches). `encoding.y.field` = mesure.

### `table` — tableau de données

```json
{
  "id": "tableau_dossiers",
  "type": "table",
  "source": "dossiers",
  "title": "Dossiers en cours",
  "encoding": {
    "columns": [
      "id_dossier",
      "nom_assure",
      { "field": "statut",   "label": "Statut", "type": "badge", "badgeMap": { "EN_COURS": "blue", "CLOS": "green" } },
      { "field": "montant",  "label": "Montant", "align": "num", "format": ",.2f" }
    ]
  },
  "options": {
    "search": true,
    "visibleRows": 20,
    "filterField": "code_dept"
  }
}
```

`encoding.columns` accepte des **strings** simples ou des **objets** `ColumnDef` :

| Champ | Description |
|-------|-------------|
| `field` | Nom de colonne dans la source |
| `label` | En-tête affiché (défaut = `field`) |
| `align` | `"num"` (droite) ou `"text"` (gauche, défaut) |
| `format` | Format d4 (ex. `",.2f"`) |
| `type` | `"badge"` → colore selon `badgeMap` |
| `badgeMap` | `{ "VALEUR": "couleur" }` |

### `map_choropleth` — carte choroplèthe

```json
{
  "id": "carte_dept",
  "type": "map_choropleth",
  "source": "effectifs",
  "title": "Effectifs par département",
  "encoding": {
    "geo":   { "field": "code_dept" },
    "color": { "field": "nb_agents", "aggregate": "sum" }
  },
  "options": {
    "width": 560,
    "height": 560,
    "region": "main",
    "emitsTo": "dept_sel"
  }
}
```

`encoding.geo.field` doit contenir des codes département 2 caractères (`"01"`–`"96"`). Le fond de carte France métropole est embarqué dans l'application.

**Options spéciales :**

| Option | Description |
|--------|-------------|
| `emitsTo` | ID d'une `spec.selections[]` — émet au clic sur un département |
| `metrics` | Tableau de métriques alternatives (voir ci-dessous) |

**Métriques alternatives** (`options.metrics`) :

```json
"options": {
  "metrics": [
    { "key": "agents",   "label": "Agents",   "field": "nb_agents",   "aggregate": "sum", "format": ",.0f" },
    { "key": "dossiers", "label": "Dossiers", "field": "nb_dossiers", "aggregate": "sum", "format": ",.0f" }
  ]
}
```

Permet de basculer la mesure coloriée via un sélecteur dans la vue, sans créer plusieurs cartes.

---

## 3. Onglets, selections et slicers

### Onglets (`spec.tabs[]`)

Permettent de regrouper les vues par page. Chaque vue est rattachée à un onglet via `options.tab`.

```json
"tabs": [
  { "id": "vue_globale",   "label": "Vue globale" },
  { "id": "vue_detail",    "label": "Détail par département" }
],
"views": [
  { "id": "v1", "type": "kpi", ..., "options": { "tab": "vue_globale" } },
  { "id": "v2", "type": "table", ..., "options": { "tab": "vue_detail" } }
]
```

Un KPI peut naviguer vers un onglet au clic : `"options": { "navigateTo": "vue_detail" }`.

Sans `tabs`, toutes les vues s'affichent sur une page unique.

### Selections cross-filter (`spec.selections[]`)

Permet à une vue **d'émettre** un filtre que d'autres vues **reçoivent** automatiquement.

```json
"selections": [
  { "id": "dept_sel", "kind": "single" }
],
"views": [
  {
    "id": "carte", "type": "map_choropleth", ...,
    "options": { "emitsTo": "dept_sel" }
  },
  {
    "id": "kpi", "type": "kpi", ...,
    "filterBy": "dept_sel"
  }
]
```

| Champ `kind` | Description |
|---|---|
| `single` | Un seul élément sélectionnable (valeur exacte) |
| `interval` | Plage de valeurs (bornes min/max) |
| `crossfilter` | Filtre bidirectionnel entre vues |

La vue émettrice déclare `options.emitsTo: "<id selection>"`.
Les vues réceptrices déclarent `filterBy: "<id selection>"`.

### Slicers — filtres multi-valeurs (`spec.slicers[]`)

Cases à cocher permettant de filtrer plusieurs valeurs simultanément (combinées en AND).

```json
"slicers": [
  {
    "id":    "filtre_statut",
    "field": "statut",
    "source":"dossiers",
    "label": "Statut du dossier",
    "kind":  "in",
    "scope": "tab"
  }
]
```

| Champ | Requis | Description |
|-------|--------|-------------|
| `id` | Oui | Identifiant unique |
| `field` | Oui | Champ de filtre dans la source |
| `source` | Oui | Source de données pour lister les valeurs |
| `label` | Non | Libellé affiché |
| `kind` | Non | `"in"` (défaut) — filtre par appartenance à un ensemble |
| `scope` | Non | `"tab"` (défaut) ou `"global"` — portée du filtre |

`scope: "global"` applique le slicer à toutes les vues du document ; `scope: "tab"` (défaut) ne filtre que les vues de l'onglet actif.

---

## 4. Mode autoporteur (inline) vs externe (path)

### Autoporteur — `inline` (recommandé)

Le Parquet est embarqué **en base64** dans le `.vviz`. Le fichier se suffit à lui-même : un double-clic suffit, sans dépendance au partage réseau.

```json
"data": {
  "sources": [
    { "name": "effectifs", "inline": "UEFSMQ==" }
  ]
}
```

Pour créer un fichier autoporteur, utilisez le script `examples/DLI/embed.py` (encode un `.parquet` en base64 et génère le `.vviz` correspondant).

### Externe — `path`

Le Parquet réside sur le share réseau. VaultViz surveille le fichier et affiche la bannière de rechargement si celui-ci change.

```json
"data": {
  "sources": [
    { "name": "effectifs", "path": "//datasrv01/partage/rh/effectifs_2026.parquet" }
  ]
}
```

**Convention de chemin (ADR-007)** :

| Forme | Exemple | Notes |
|-------|---------|-------|
| UNC POSIX | `//host/share/dossier/fichier.parquet` | Recommandé — séparateurs `/` |
| Lecteur mappé | `Z:/donnees/fichier.parquet` | Fallback accepté |
| Relatif au `.vviz` | `./donnees.parquet` | Pratique pour les démos locales |

> Interdits : `http://`, `https://`, `ftp://`, `file://`, `data:`, `javascript:` — refusés par le schéma.

---

## 5. Exemples canoniques complets

### Exemple 1 — Carte choroplèthe avec cross-filter

```json
{
  "$schema": "./vviz-v1.json",
  "vviz": {
    "version": "1.0",
    "title": "Effectifs par département",
    "author": "Mehdi D.",
    "created": "2026-01-15"
  },
  "data": {
    "sources": [
      {
        "name": "effectifs",
        "path": "//datasrv01/partage/rh/effectifs_2026.parquet"
      }
    ]
  },
  "spec": {
    "engine": "mosaic",
    "layout": "dashboard",
    "selections": [
      { "id": "dept_sel", "kind": "single" }
    ],
    "views": [
      {
        "id": "carte",
        "type": "map_choropleth",
        "source": "effectifs",
        "title": "Effectifs par département",
        "encoding": {
          "geo":   { "field": "code_dept" },
          "color": { "field": "nb_agents", "aggregate": "sum" }
        },
        "options": {
          "width": 560,
          "height": 560,
          "region": "main",
          "emitsTo": "dept_sel"
        }
      },
      {
        "id": "kpi_total",
        "type": "kpi",
        "source": "effectifs",
        "title": "Total agents",
        "encoding": {
          "value": { "field": "nb_agents", "aggregate": "sum" }
        },
        "filterBy": "dept_sel",
        "options": {
          "region": "kpi",
          "format": ",.0f",
          "icon": "users"
        }
      }
    ]
  }
}
```

### Exemple 2 — Série temporelle (line + area)

```json
{
  "$schema": "./vviz-v1.json",
  "vviz": {
    "version": "1.0",
    "title": "Évolution mensuelle des dossiers",
    "author": "Mehdi D.",
    "created": "2026-01-15"
  },
  "data": {
    "sources": [
      {
        "name": "dossiers",
        "path": "//datasrv01/partage/stats/dossiers_mensuels.parquet"
      }
    ]
  },
  "spec": {
    "engine": "mosaic",
    "layout": "vstack",
    "views": [
      {
        "id": "courbe",
        "type": "line",
        "source": "dossiers",
        "title": "Dossiers traités par mois",
        "encoding": {
          "x": { "field": "mois" },
          "y": { "field": "nb_dossiers", "aggregate": "sum" }
        },
        "options": {
          "width": 800,
          "height": 300
        }
      },
      {
        "id": "surface",
        "type": "area",
        "source": "dossiers",
        "title": "Cumul (zone)",
        "encoding": {
          "x": { "field": "mois" },
          "y": { "field": "nb_dossiers", "aggregate": "sum" }
        },
        "options": {
          "width": 800,
          "height": 200
        }
      }
    ]
  }
}
```

### Exemple 3 — Tableau de données

```json
{
  "$schema": "./vviz-v1.json",
  "vviz": {
    "version": "1.0",
    "title": "Détail des dossiers en cours",
    "author": "Mehdi D.",
    "created": "2026-01-15"
  },
  "data": {
    "sources": [
      {
        "name": "dossiers",
        "path": "//datasrv01/partage/stats/dossiers_en_cours.parquet"
      }
    ]
  },
  "spec": {
    "engine": "mosaic",
    "layout": "vstack",
    "views": [
      {
        "id": "tableau",
        "type": "table",
        "source": "dossiers",
        "title": "Dossiers en cours",
        "encoding": {
          "columns": [
            "id_dossier",
            "nom_assure",
            "date_depot",
            "statut",
            "code_dept"
          ]
        },
        "options": {
          "search": true,
          "visibleRows": 20
        }
      }
    ]
  }
}
```

---

## 6. Validation en VS Code

Le schéma `vviz-v1.json` permet la complétion automatique et la détection d'erreurs dans VS Code (extension **JSON Language Support**, incluse par défaut).

### Option A — référence relative (recommandée)

Posez `vviz-v1.json` dans le même dossier que votre `.vviz` et référencez-le :

```json
{ "$schema": "./vviz-v1.json", ... }
```

Le fichier `schema/vviz-v1.json` est livré avec l'application dans `%ProgramFiles%\VaultViz\schema\vviz-v1.json`.

### Option B — chemin absolu installé

```json
{
  "$schema": "C:/Program Files/VaultViz/schema/vviz-v1.json",
  ...
}
```

> Ajustez le chemin si l'installation est dans un dossier personnalisé.

### Option C — `jsonValidation` dans `.vscode/settings.json`

Pour valider tous les `.vviz` du workspace sans modifier chaque fichier :

```json
{
  "json.schemas": [
    {
      "fileMatch": ["*.vviz"],
      "url": "./schema/vviz-v1.json"
    }
  ]
}
```

Placez `vviz-v1.json` à la racine de votre workspace (ou ajustez `url`).

---

## 7. Ressources

| Ressource | Chemin |
|-----------|--------|
| Schéma JSON de référence | `schema/vviz-v1.json` (installé dans `%ProgramFiles%\VaultViz\schema\`) |
| Exemple autoporteur DLI | `examples/DLI/dli_inventaire_autoporteur.vviz` |
| Script d'embarquement Parquet | `examples/DLI/embed.py` |
| Doc format V0 (référence antérieure) | `docs/user/format-vviz.md` |
