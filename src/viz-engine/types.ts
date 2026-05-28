// Types du viz-engine VaultViz.
//
// Centralisés ici pour rester indépendants du moteur (Mosaic ou repli
// Vega-Lite, cf. R-8 / ADR-002).

import type { Table } from "apache-arrow";

/**
 * Source de données déclarée dans un `.vviz` — alias logique → chemin
 * (UNC `//host/share/...` ou relatif `./...`, cf. ADR-007).
 */
export interface VVizSource {
  name: string;
  path: string;
}

/**
 * Document `.vviz` parsé. La spec sera resserrée en B-033 (DSL VaultViz).
 */
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
  spec: Record<string, unknown>;
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
