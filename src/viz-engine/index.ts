// VaultViz viz-engine — couche d'abstraction Mosaic/vgplot.
//
// Cf. ADR-002 : on isole les appels Mosaic dans ce module pour permettre
// un repli sur Vega-Lite si Mosaic se révèle bloquant en POC (R-8).
//
// B-030 : versions Mosaic verrouillées dans `package-lock.json`,
// stub d'API et démo plot statique inline.
// B-031 : connector DuckDB natif (Tauri ↔ Arrow IPC) enregistré sur le
// coordinator singleton Mosaic via `vg.coordinator().databaseConnector()`.

import * as vg from "@uwdata/vgplot";

import { createDuckConnector, type DuckConnector } from "./duck-connector";

export const VVIZ_ENGINE_VERSION = "v0-mosaic-stub";

export const MOSAIC_VERSIONS = {
  vgplot: "0.26.0",
  core: "0.26.0",
  sql: "0.26.0",
} as const;

let initialized = false;
let activeConnector: DuckConnector | null = null;

/**
 * Initialise le runtime Mosaic une seule fois — enregistre notre
 * connector DuckDB natif sur le coordinator singleton vgplot.
 *
 * Idempotent : appels multiples no-op après la première initialisation.
 *
 * À appeler **avant** tout `vg.plot(vg.from("table"), ...)` qui doit
 * push-down vers DuckDB. Les plots inline (Array) n'en ont pas besoin
 * (cf. B-030).
 */
export function initMosaicRuntime(): DuckConnector {
  if (initialized && activeConnector) return activeConnector;
  const connector = createDuckConnector();
  // `databaseConnector(db)` (overload) accepte tout objet conforme à
  // l'interface `Connector` Mosaic (méthode `query` retournant Promise).
  // Cast `unknown` pour contourner le typage strict mosaic-core qui
  // attend `Connector` exact, sachant que notre forme structurelle
  // est compatible.
  vg.coordinator().databaseConnector(connector as unknown as Parameters<
    ReturnType<typeof vg.coordinator>["databaseConnector"]
  >[0]);
  initialized = true;
  activeConnector = connector;
  return connector;
}

/**
 * Test-only : remet l'état d'initialisation à zéro. À ne pas utiliser
 * en runtime.
 */
export function _resetMosaicRuntimeForTests(): void {
  initialized = false;
  activeConnector = null;
}
