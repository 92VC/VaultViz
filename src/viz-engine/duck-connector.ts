// B-031 — Connector Mosaic ↔ DuckDB natif.
//
// Implémente l'interface `Connector` de `@uwdata/mosaic-core`
// (cf. node_modules/@uwdata/mosaic-core/src/Coordinator.ts et
// docs/api/core/connectors.md du repo Mosaic) :
//
//   Connector.query({ sql, type, ...opts }) → Promise<Table | obj[] | void>
//
// Sous le capot, on appelle la commande Tauri `run_query` (B-022) qui
// renvoie un buffer Arrow IPC stream (cf. ADR-003 — pas de JSON
// intermédiaire). On décode avec `apache-arrow.tableFromIPC` puis on
// renvoie un objet Table (type "arrow") ou un tableau d'objets via
// `.toArray()` (type "json"). Pour "exec", on ignore la réponse.
//
// Cette couche n'enregistre pas elle-même le connector sur le
// coordinator : c'est `initMosaicRuntime()` dans `./index.ts` qui le
// fait, pour rester contrôlable depuis les tests.

import { invoke } from "@tauri-apps/api/core";
import { tableFromIPC, type Table } from "apache-arrow";

import type {
  ConnectorQuery,
  ConnectorResponse,
} from "./types";

export interface DuckConnector {
  query: (q: ConnectorQuery) => Promise<ConnectorResponse>;
}

/**
 * Normalise la réponse `invoke<...>("run_query", ...)` en `Uint8Array`.
 *
 * - Tauri 2 renvoie en théorie un `ArrayBuffer` côté JS (via
 *   `InvokeResponseBody::Raw`), mais selon la version et la sérialisation
 *   IPC effective, le moteur Vite a pu nous retourner un `Uint8Array`
 *   ou — fallback `serde` — un `number[]`. On accepte les trois.
 */
function toBytes(raw: Uint8Array | ArrayBuffer | number[]): Uint8Array {
  if (raw instanceof Uint8Array) return raw;
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  return new Uint8Array(raw);
}

/**
 * Construit un `DuckConnector` qui satisfait l'interface Mosaic.
 *
 * Le connector est sans état — `invoke` est appelé à chaque `query()`.
 * Le `AppState` Rust côté back gère la connexion DuckDB partagée
 * (cf. B-021 / `src-tauri/src/duck.rs`).
 */
export function createDuckConnector(): DuckConnector {
  return {
    async query(q: ConnectorQuery): Promise<ConnectorResponse> {
      const type = q.type ?? "arrow";

      if (type === "exec") {
        // Effet de bord : on attend l'exécution mais on ne décode rien.
        await invoke<Uint8Array | number[] | ArrayBuffer>("run_query", {
          sql: q.sql,
        });
        return undefined;
      }

      const raw = await invoke<Uint8Array | number[] | ArrayBuffer>(
        "run_query",
        { sql: q.sql },
      );
      const bytes = toBytes(raw);
      const table: Table = tableFromIPC(bytes);

      if (type === "json") {
        return table.toArray() as unknown[];
      }
      return table;
    },
  };
}
