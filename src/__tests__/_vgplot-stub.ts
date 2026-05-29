// Helper de test (NON exécuté comme suite — pas de suffixe `.test.ts`).
//
// Problème résolu : en happy-dom, sans Tauri, le coordinator singleton de
// Mosaic/vgplot retombe sur son `SocketConnector` par défaut
// (WebSocket ws://localhost:3000). Tout `vg.plot(...)` lance alors des
// requêtes async (field-info + données) en fire-and-forget qui rejettent
// « Socket closed » → rejets NON capturés, non déterministes selon
// l'ordonnancement vitest (pollution « N errors » bien que EXIT=0).
//
// Correctif CÔTÉ TEST uniquement : on enregistre sur le coordinator un
// connector stub qui RÉSOUT (au lieu de rejeter) — aucune requête réelle
// ne part, aucun rejet. Le code de production (`duck-connector.ts`) reste
// inchangé : en prod, une erreur DuckDB réelle doit toujours remonter.
//
// Forme du stub : satisfait l'interface `Connector` de mosaic-core
// (`query({ sql, type }) → Promise<Table | obj[] | void>`). Pour les
// requêtes `DESCRIBE` (field-info), on renvoie une Table Arrow décrivant
// une colonne factice (column_name / column_type / null) afin que
// `queryFieldInfo` ne lève pas hors de son try/catch. Pour les requêtes de
// données, une Table vide suffit (vgplot tolère 0 ligne).

import * as vg from "@uwdata/vgplot";
import { tableFromArrays } from "apache-arrow";

interface StubQuery {
  type?: "arrow" | "exec" | "json";
  sql?: string;
}

function stubConnector() {
  return {
    async query(q: StubQuery): Promise<unknown> {
      const sql = q.sql ?? "";
      if (q.type === "exec") return undefined;
      // Requête de métadonnées (field-info) : fournir une description de
      // colonne valide pour éviter un throw dans queryFieldInfo.
      if (/\bDESCRIBE\b|^\s*DESC\b/i.test(sql)) {
        const t = tableFromArrays({
          column_name: ["column"],
          column_type: ["DOUBLE"],
          null: ["YES"],
        });
        return q.type === "json" ? t.toArray() : t;
      }
      // Requête de données : Table vide (0 ligne).
      const empty = tableFromArrays({});
      return q.type === "json" ? empty.toArray() : empty;
    },
  };
}

/**
 * Enregistre un connector stub résolvant sur le coordinator vgplot
 * singleton. À appeler dans un `beforeAll` des suites qui montent des
 * marques vgplot (bar-chart, plot-view). Empêche toute requête réelle et
 * donc tout rejet « Socket closed ».
 */
export function installVgplotStubConnector(): void {
  const coord = vg.coordinator();
  coord.databaseConnector(stubConnector() as never);
  // Le coordinator Mosaic loggue par défaut sur `console`. Pendant la
  // queue async post-rendu (field-info + données), tout log émis APRÈS la
  // fin synchrone du test peut écrire via le RPC vitest `onUserConsoleLog`
  // au moment du teardown du worker → « EnvironmentTeardownError: Closing
  // rpc while onUserConsoleLog was pending » (rejet non capturé non
  // déterministe). On installe un logger silencieux (voidLogger via `null`)
  // pour supprimer ce trafic — ce sont des tests fumants qui ne valident
  // pas la sortie console. Le logger de production reste `console`.
  coord.logger(null);
}
