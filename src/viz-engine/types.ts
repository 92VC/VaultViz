// Types du viz-engine VaultViz.
//
// Centralisés ici pour rester indépendants du moteur (Mosaic ou repli
// Vega-Lite, cf. R-8 / ADR-002). Les types DSL sont alignés sur
// `schema/vviz-v1.json` (B-033b).

import type { Table } from "apache-arrow";

/**
 * Source de données déclarée dans un `.vviz` — alias logique → chemin
 * (UNC `//host/share/...` ou relatif `./...`, cf. ADR-007).
 */
export interface VVizSource {
  name: string;
  /** Chemin du Parquet externe (share/dossier). Optionnel si `inline`. */
  path?: string;
  /**
   * Parquet embarqué (base64) → fichier `.vviz` AUTOPORTEUR : un seul
   * fichier, double-clic, aucune dépendance externe. Extrait au cache local
   * à l'ouverture (cf. source-loader). Modèle par défaut.
   */
  inline?: string;
}

/** Canal d'encoding (geo, color, x, y, value, delta, series). */
export interface EncodingChannel {
  field?: string;
  aggregate?: "sum" | "avg" | "count" | "min" | "max" | "none";
  topology?: string;
}

/**
 * Définition d'une colonne de table après normalisation (SP3). Une
 * colonne déclarée en simple `string` dans le `.vviz` est normalisée en
 * `{ field }`. Les colonnes riches portent label/align/format/badge.
 */
export interface ColumnDef {
  field: string;
  label?: string;
  align?: "num" | "text";
  format?: string;
  type?: "badge";
  badgeMap?: Record<string, string>;
}

/**
 * Définition d'une métrique alternative pour une carte choroplèthe
 * (SP3) — permet de basculer la mesure affichée sans changer la vue.
 */
export interface MetricDef {
  key: string;
  label: string;
  field: string;
  format?: string;
  aggregate?: "sum" | "avg" | "count" | "min" | "max";
  sql: string;
}

/** Type de vue supporté en V0 (cf. schema enum). */
export type ViewType =
  | "map_choropleth"
  | "bar"
  | "barX"
  | "barY"
  | "line"
  | "area"
  | "dot"
  | "pie"
  | "table"
  | "kpi";

/** Spec d'une vue dans `spec.views[]`. */
export interface ViewSpec {
  id: string;
  type: ViewType;
  source: string;
  title?: string;
  filterBy?: string;
  /**
   * Encoding ouvert (les composants connaissent leurs canaux). Une vue
   * `table` y passe `columns: string[]` ; les autres y passent des
   * EncodingChannel.
   */
  encoding?: Record<string, EncodingChannel | string[] | undefined>;
  options?: Record<string, unknown>;
}

/** Selection déclarée dans `spec.selections[]`. */
export interface SelectionSpec {
  id: string;
  kind: "single" | "interval" | "crossfilter";
}

/** Spec complète d'un .vviz. */
export interface VVizSpec {
  engine: "mosaic";
  layout?: "vstack" | "hstack" | "grid" | "dashboard";
  /**
   * Ratio des colonnes [principale, latérale] du layout `dashboard`.
   * Défaut [1.32, 1]. Réduire la principale (ex. carte) au profit des
   * vues de droite se déclare ici, dans le `.vviz` — pas en CSS.
   */
  gridRatio?: [number, number];
  selections?: SelectionSpec[];
  /** Onglets internes du dashboard (cf. tab-bar). Absent → page unique. */
  tabs?: { id: string; label: string }[];
  views: ViewSpec[];
}

/** Document `.vviz` parsé. */
export interface VVizDocument {
  $schema?: string;
  vviz: {
    version: "1.0";
    title: string;
    description?: string;
    author?: string;
    created?: string;
    updated?: string;
  };
  data: { sources: VVizSource[] };
  spec: VVizSpec;
}

/**
 * Format de retour demandé par Mosaic à un connector
 * (cf. `node_modules/@uwdata/mosaic-core/src/Coordinator.ts`).
 *
 * - `"arrow"` (défaut) : `Promise<Table>` (apache-arrow)
 * - `"json"` : `Promise<unknown[]>` (tableau d'objets)
 * - `"exec"` : `Promise<void>` (effet de bord uniquement)
 */
export type ConnectorQueryType = "arrow" | "json" | "exec";

export interface ConnectorQuery {
  type?: ConnectorQueryType;
  sql: string;
}

export type ConnectorResponse = Table | unknown[] | void;
