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
  path: string;
}

/** Canal d'encoding (geo, color, x, y, value). */
export interface EncodingChannel {
  field?: string;
  aggregate?: "sum" | "avg" | "count" | "min" | "max" | "none";
  topology?: string;
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
  layout?: "vstack" | "hstack" | "grid";
  selections?: SelectionSpec[];
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
