// VaultViz V0 — bootstrap front (I0/B-012 → I1/B-022)
//
// Au démarrage :
// 1. on lit un `.vviz` par défaut (env `VITE_VVIZ_DEFAULT`, fallback
//    `./examples/effectifs_2026.vviz`) et on pretty-printe son JSON.
// 2. (B-022) on tente un `run_query` SQL sur un Parquet local pour démontrer
//    le pipeline DuckDB → Arrow IPC → JS Table. Affiche le COUNT en
//    dessous du pretty-print. Best-effort : si le Parquet n'existe pas
//    (cas dev déconnecté ou cible Tauri non lancée), on affiche le
//    message d'erreur typé sans casser le rendu principal.
//
// Les composants UI riches (carte, table virtualisée, cross-filter)
// arrivent en Wave 3+. B-061 ajoutera la validation JSON Schema.

import { invoke } from "@tauri-apps/api/core";
import { tableFromIPC } from "apache-arrow";
import * as vg from "@uwdata/vgplot";

import { VVIZ_ENGINE_VERSION, initMosaicRuntime } from "./viz-engine";
import { createDuckConnector } from "./viz-engine/duck-connector";
import {
  bindMapSelection,
  createRuntime,
  ensureSelection,
} from "./viz-engine/mosaic-runtime";
import { renderChoropleth } from "./components/map-view";
import { renderBarChart } from "./components/bar-chart";

type VVizErrorPayload = { kind: string; message: string };

const DEFAULT_VVIZ =
  (import.meta.env.VITE_VVIZ_DEFAULT as string | undefined) ??
  "./examples/effectifs_2026.vviz";

const ERROR_COPY: Record<string, (m: string) => string> = {
  NotFound: (m) => `Fichier .vviz introuvable. Vérifiez le chemin ou contactez le publisher. (${m})`,
  Forbidden: (m) => `Accès refusé par la politique de capability FS. (${m})`,
  Io: (m) => `Erreur d'entrée/sortie. (${m})`,
  Invalid: (m) => `Format invalide. (${m})`,
};

function renderError(container: HTMLElement, kind: string, message: string): void {
  const copy = (ERROR_COPY[kind] ?? ERROR_COPY.Io)(message);
  container.innerHTML = `
    <div class="vv-error" role="alert">
      <strong>Erreur :</strong>
      <span>${escapeHtml(copy)}</span>
    </div>
  `;
}

function renderContent(container: HTMLElement, path: string, content: string): void {
  let pretty = content;
  try {
    pretty = JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    // Pas du JSON valide : on affichera quand même brut, validation B-061
  }
  container.innerHTML = `
    <header class="vv-header">
      <h1>VaultViz</h1>
      <p class="vv-subtitle">V0 prototype — I0 squelette</p>
      <p class="vv-path">Fichier : <code>${escapeHtml(path)}</code></p>
    </header>
    <pre class="vv-content">${escapeHtml(pretty)}</pre>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * B-022 — démo Arrow IPC pipe.
 *
 * Lance un `run_query` sur un Parquet local (`examples/sample.parquet`,
 * cf. `gen_fixtures` en B-021) et affiche le résultat (COUNT + 5 premières
 * lignes en tableau HTML brut). Best-effort : toute erreur est rendue
 * sous forme de note grisée, le rendu principal du `.vviz` reste intact.
 *
 * **Notes** :
 * - Le buffer reçu par `invoke` est un `ArrayBuffer` (Tauri 2 ipc::Response).
 *   On le convertit en `Uint8Array` avant `tableFromIPC`.
 * - Aucune étape JSON.parse / stringify intermédiaire (cf. ADR-003).
 */
async function renderQueryDemo(root: HTMLElement, parquetPath: string): Promise<void> {
  const section = document.createElement("section");
  section.className = "vv-query-demo";
  section.innerHTML = `<h2>Démo DuckDB → Arrow IPC (B-022)</h2><p>chargement…</p>`;
  root.appendChild(section);

  try {
    // 1) COUNT(*)
    const countSql = `SELECT COUNT(*)::BIGINT AS n FROM read_parquet('${parquetPath}')`;
    const countBuf = await invoke<ArrayBuffer>("run_query", { sql: countSql });
    const countTable = tableFromIPC(new Uint8Array(countBuf));
    const countRow = countTable.get(0);
    const count = countRow ? Number(countRow.toArray()[0]) : 0;

    // 2) 5 premières lignes
    const previewSql = `SELECT * FROM read_parquet('${parquetPath}') LIMIT 5`;
    const previewBuf = await invoke<ArrayBuffer>("run_query", { sql: previewSql });
    const previewTable = tableFromIPC(new Uint8Array(previewBuf));

    const headers = previewTable.schema.fields.map((f) => escapeHtml(f.name));
    const rowsHtml: string[] = [];
    for (let i = 0; i < previewTable.numRows; i++) {
      const row = previewTable.get(i);
      if (!row) continue;
      const cells = row
        .toArray()
        .map((v: unknown) => `<td>${escapeHtml(String(v))}</td>`)
        .join("");
      rowsHtml.push(`<tr>${cells}</tr>`);
    }

    section.innerHTML = `
      <h2>Démo DuckDB → Arrow IPC (B-022)</h2>
      <p>Parquet : <code>${escapeHtml(parquetPath)}</code> — <strong>${count}</strong> lignes.</p>
      <table class="vv-preview">
        <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${rowsHtml.join("")}</tbody>
      </table>
    `;
  } catch (err: unknown) {
    const payload = err as VVizErrorPayload | string;
    const message =
      typeof payload === "object" && payload && "message" in payload
        ? (payload as VVizErrorPayload).message
        : String(err);
    section.innerHTML = `
      <h2>Démo DuckDB → Arrow IPC (B-022)</h2>
      <p class="vv-note">Démo indisponible : ${escapeHtml(message)}</p>
    `;
  }
}

const DEFAULT_PARQUET =
  (import.meta.env.VITE_PARQUET_DEMO as string | undefined) ??
  "./examples/sample.parquet";

async function bootstrap(): Promise<void> {
  const root = document.getElementById("app");
  if (!root) return;

  try {
    const content = await invoke<string>("read_vviz", { path: DEFAULT_VVIZ });
    renderContent(root, DEFAULT_VVIZ, content);
  } catch (err: unknown) {
    const payload = err as VVizErrorPayload | string;
    if (typeof payload === "object" && payload && "kind" in payload) {
      renderError(root, payload.kind, payload.message ?? "");
    } else {
      renderError(root, "Io", String(err));
    }
  }

  // Démo B-022 — best-effort, n'écrase pas le rendu principal.
  await renderQueryDemo(root, DEFAULT_PARQUET);

  // Démo B-030 — plot vgplot statique inline (sans coordinator).
  renderDemoPlot(root);

  // B-031 — initialise le coordinator Mosaic avec notre connector DuckDB
  // natif. Best-effort : si Tauri n'est pas dispo (dev navigateur pur),
  // l'init reste muette et la démo de query connectorisée affichera
  // une note d'indisponibilité.
  try {
    initMosaicRuntime();
  } catch (err) {
    console.warn("[VaultViz] init Mosaic runtime impossible :", err);
  }
  await renderConnectorDemo(root, DEFAULT_PARQUET);

  // Démo B-032 — carte choroplèthe France (UC-1 partiel).
  await renderDemoChoropleth(root, DEFAULT_PARQUET);

  // Démo B-041 — cross-filter UC-3 : carte + barres coordonnées via une
  // seule `vg.Selection` partagée par le runtime. Aucun JS de filtrage
  // métier ici, uniquement du câblage (createRuntime + renderXxx).
  await renderCrossFilterDashboard(root, DEFAULT_PARQUET);
}

/**
 * B-041 — Dashboard cross-filter UC-3 (carte ↔ barres).
 *
 * Câble une `vg.Selection` partagée entre la carte choroplèthe (émetteur
 * de clauses point au clic, cf. B-040) et un bar chart vgplot
 * (récepteur via `filterBy`). Au clic d'un département : le predicate
 * push-down est généré par mosaic-sql, le coordinator re-query DuckDB
 * via notre connector (B-031), le bar chart se ré-affiche.
 *
 * Aucune logique de filtrage métier dans ce fichier — uniquement du
 * câblage haut-niveau (création runtime, registration de la vue
 * DuckDB, render des deux composants). Critère No-Go H4 (PRD §12.1) :
 * vérifiable par `grep -nE "if.*selection|\\.filter\\(" src/main.ts`
 * → aucune occurrence métier (filtrages côté JS).
 */
async function renderCrossFilterDashboard(
  root: HTMLElement,
  parquetPath: string,
): Promise<void> {
  const section = document.createElement("section");
  section.className = "vv-vgplot-demo vv-dashboard";
  const h = document.createElement("h2");
  h.className = "vv-h2";
  h.textContent = "Dashboard cross-filter UC-3 — carte ↔ barres (B-041)";
  section.appendChild(h);
  const sub = document.createElement("p");
  sub.className = "vv-note";
  sub.textContent =
    "Clic département = filtre push-down vgplot → DuckDB. Re-clic = clear. Selection partagée via runtime Mosaic.";
  section.appendChild(sub);
  const row = document.createElement("div");
  row.className = "vv-hflex";
  section.appendChild(row);
  root.appendChild(section);

  // Préparer la vue DuckDB référencée par vg.from("effectifs").
  // Best-effort : si pas de Tauri en dev navigateur pur, on rend la
  // démo avec une note de fallback.
  const conn = createDuckConnector();
  try {
    await conn.query({
      type: "exec",
      sql: `
        CREATE OR REPLACE VIEW effectifs AS
        SELECT *,
               LPAD(CAST(((id % 96) + 1) AS VARCHAR), 2, '0') AS code_dept
        FROM read_parquet('${parquetPath}')
      `,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const note = document.createElement("p");
    note.className = "vv-note";
    note.textContent = `Dashboard cross-filter indisponible (Tauri requis) : ${msg}`;
    section.appendChild(note);
    return;
  }

  // Runtime partagé entre la carte et les barres.
  const ctx = createRuntime();
  ensureSelection(ctx, "dept_select", "single");

  // --- Carte (émetteur de clauses) ---
  const mapMount = document.createElement("div");
  mapMount.className = "vv-mapmount";
  row.appendChild(mapMount);

  const dataByDept = new Map<string, number>();
  try {
    const t = (await conn.query({
      type: "arrow",
      sql: `
        SELECT code_dept AS code, COUNT(*) AS n
        FROM effectifs
        GROUP BY code_dept
      `,
    })) as {
      numRows: number;
      get: (i: number) => { code: string; n: bigint | number } | null;
    } | null;
    if (t && t.numRows) {
      for (let i = 0; i < t.numRows; i++) {
        const r = t.get(i);
        if (!r) continue;
        dataByDept.set(String(r.code), Number(r.n));
      }
    }
  } catch {
    // bench muet — la carte reste affichée à 0
  }
  const svg = renderChoropleth(mapMount, dataByDept, { width: 480, height: 480 });
  bindMapSelection(svg, ctx, {
    field: "code_dept",
    selectionName: "dept_select",
  });

  // --- Bar chart (récepteur via filterBy) ---
  const barMount = document.createElement("div");
  barMount.className = "vv-barmount";
  row.appendChild(barMount);
  try {
    renderBarChart(barMount, {
      source: "effectifs",
      xField: "code_dept",
      filterSelectionName: "dept_select",
      ctx,
      width: 480,
      height: 320,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const note = document.createElement("p");
    note.className = "vv-note";
    note.textContent = `Bar chart indisponible : ${msg}`;
    barMount.appendChild(note);
  }
}

/**
 * B-032 — démo carte choroplèthe.
 *
 * Synthétise une métrique « COUNT par département » à partir du Parquet
 * de fixture (id % 96 → code département), puis rend une SVG D3
 * coloriée par valeur. Si la query échoue (pas de Tauri / pas de
 * Parquet), on rend quand même la carte avec valeurs à 0, pour
 * démontrer le fond cartographique.
 */
async function renderDemoChoropleth(
  root: HTMLElement,
  parquetPath: string,
): Promise<void> {
  const section = document.createElement("section");
  section.className = "vv-vgplot-demo";
  const h = document.createElement("h2");
  h.className = "vv-h2";
  h.textContent = "Carte choroplèthe France (B-032, UC-1 partiel)";
  section.appendChild(h);
  const sub = document.createElement("p");
  sub.className = "vv-note";
  sub.textContent =
    "Fond : IGN ADMIN EXPRESS / Etalab Licence Ouverte 2.0 (V0 simplifié).";
  section.appendChild(sub);
  const mapEl = document.createElement("div");
  mapEl.className = "vv-map";
  section.appendChild(mapEl);
  root.appendChild(section);

  const dataByDept = new Map<string, number>();
  try {
    const conn = createDuckConnector();
    const t = (await conn.query({
      type: "arrow",
      sql: `
        SELECT LPAD(CAST(((id % 96) + 1) AS VARCHAR), 2, '0') AS code,
               COUNT(*) AS n
        FROM read_parquet('${parquetPath}')
        GROUP BY 1
      `,
    })) as {
      numRows: number;
      get: (i: number) => { code: string; n: bigint | number } | null;
    } | null;
    if (t && t.numRows) {
      for (let i = 0; i < t.numRows; i++) {
        const row = t.get(i);
        if (!row) continue;
        dataByDept.set(String(row.code), Number(row.n));
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const note = document.createElement("p");
    note.className = "vv-note";
    note.textContent = `Données indisponibles, rendu fond seul : ${msg}`;
    section.insertBefore(note, mapEl);
  }
  const svg = renderChoropleth(mapEl, dataByDept, { width: 600, height: 600 });

  // B-040 — binding Selection sur la carte (clic dept = clause point).
  // Tout le JS de filtrage vit dans viz-engine/mosaic-runtime.ts ; ici
  // on ne fait que câbler.
  const ctx = createRuntime();
  ensureSelection(ctx, "dept_select", "single");
  bindMapSelection(svg, ctx, {
    field: "code_dept",
    selectionName: "dept_select",
  });
}

/**
 * B-031 — démo connector Mosaic.
 *
 * Passe par `createDuckConnector().query({ type: "arrow", sql })` plutôt
 * que par `invoke()` direct, pour démontrer que la même primitive (un
 * connector conforme à l'interface Mosaic) peut servir aussi bien aux
 * plots vgplot qu'à des requêtes ad-hoc côté app.
 */
async function renderConnectorDemo(
  root: HTMLElement,
  parquetPath: string,
): Promise<void> {
  const section = document.createElement("section");
  section.className = "vv-vgplot-demo";
  const h = document.createElement("h2");
  h.className = "vv-h2";
  h.textContent = "Démo connector Mosaic ↔ DuckDB (B-031)";
  section.appendChild(h);
  const body = document.createElement("p");
  body.textContent = "chargement…";
  section.appendChild(body);
  root.appendChild(section);

  try {
    const conn = createDuckConnector();
    const result = (await conn.query({
      type: "arrow",
      sql: `SELECT COUNT(*)::BIGINT AS n FROM read_parquet('${parquetPath}')`,
    })) as { numRows: number; get: (i: number) => { toArray(): unknown[] } | null };
    const row = result?.get(0);
    const n = row ? Number((row.toArray() as unknown[])[0]) : 0;
    body.textContent = `Connector OK — COUNT(*) = ${n.toLocaleString("fr-FR")} ligne(s).`;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    body.className = "vv-note";
    body.textContent = `Connector indisponible : ${msg}`;
  }
}

/**
 * B-030 — démo vgplot statique.
 *
 * Plot scatter `vg.dot` avec données inline (tableau d'objets). Le
 * code `Mark.hasOwnData()` (mosaic-plot) court-circuite `prepare()`
 * et `query()` quand `source` est un Array : aucun coordinator ni
 * connector requis pour ce cas. C'est la preuve que la chaîne
 * Mosaic est correctement intégrée dans le bundle Vite.
 *
 * Plus tard (B-031), un connector DuckDB natif sera enregistré sur
 * le coordinator pour que `vg.from("table_name")` push-down ses
 * requêtes vers Rust.
 *
 * Engine version : {@link VVIZ_ENGINE_VERSION}.
 */
function renderDemoPlot(root: HTMLElement): void {
  const section = document.createElement("section");
  section.className = "vv-vgplot-demo";
  const heading = document.createElement("h2");
  heading.className = "vv-h2";
  heading.textContent = "Démo vgplot statique (B-030)";
  const note = document.createElement("p");
  note.className = "vv-note";
  note.textContent = `engine: ${VVIZ_ENGINE_VERSION}`;
  section.append(heading, note);

  try {
    const data = [
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 3, y: 9 },
      { x: 4, y: 16 },
      { x: 5, y: 25 },
      { x: 6, y: 36 },
      { x: 7, y: 49 },
    ];
    const plot = vg.plot(
      vg.dot(data, { x: "x", y: "y", r: 6, fill: "steelblue" }),
      vg.width(400),
      vg.height(280),
    );
    section.appendChild(plot as Node);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const failure = document.createElement("p");
    failure.className = "vv-note";
    failure.textContent = `Plot vgplot indisponible : ${message}`;
    section.appendChild(failure);
  }
  root.appendChild(section);
}

bootstrap();
