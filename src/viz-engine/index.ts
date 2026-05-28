// VaultViz viz-engine — couche d'abstraction Mosaic/vgplot.
//
// Cf. ADR-002 : on isole les appels Mosaic dans ce module pour permettre
// un repli sur Vega-Lite si Mosaic se révèle bloquant en POC (R-8).
//
// B-030 : versions Mosaic verrouillées dans `package-lock.json`,
// stub d'API et démo plot statique inline.
// B-031 : connector DuckDB natif (Tauri ↔ Arrow IPC).

export const VVIZ_ENGINE_VERSION = "v0-mosaic-stub";

export const MOSAIC_VERSIONS = {
  vgplot: "0.26.0",
  core: "0.26.0",
  sql: "0.26.0",
} as const;
