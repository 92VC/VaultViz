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
  compileToMosaic,
  createRuntime,
  ensureSelection,
  type CompiledView,
  type RuntimeContext,
} from "./viz-engine/mosaic-runtime";
import { renderChoropleth } from "./components/map-view";
import { renderBarChart } from "./components/bar-chart";
import { renderTable } from "./components/table-view";
import {
  fetchDrill,
  onSelectionValue,
  type DrillQueryOptions,
} from "./viz-engine/drill-query";
import {
  renderErrorBanner,
} from "./components/error-banner";
import { loadVViz } from "./viz-engine/spec-loader";

type VVizErrorPayload = { kind: string; message: string };

const DEFAULT_VVIZ =
  (import.meta.env.VITE_VVIZ_DEFAULT as string | undefined) ??
  "./examples/effectifs_2026.vviz";

const HELP_HREF =
  "https://github.com/92VC/VaultViz/tree/main/docs/user"; // placeholder V0 (B-061)

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

async function resolveStartupPath(): Promise<string> {
  // Priorité 1 : commande Rust startup_path (argv[1] / VVIZ_DEFAULT / bundle resource)
  try {
    const resolved = await invoke<string | null>("startup_path");
    if (resolved) return resolved;
  } catch {
    // Si la commande n'existe pas (ancien binaire) on tombe sur le fallback build-time
  }
  // Priorité 2 : valeur figée au build (dev navigateur, override projet)
  return DEFAULT_VVIZ;
}

async function bootstrap(): Promise<void> {
  const root = document.getElementById("app");
  if (!root) return;

  const startupPath = await resolveStartupPath();

  // B-061 — pipeline unifié : read + JSON.parse + Ajv. Toute erreur peint
  // le bandeau (B-060) avec son kind exact et la liste des violations.
  const { doc: mainDoc, error: mainErr } = await loadVViz(startupPath);
  if (mainErr) {
    renderErrorBanner(root, mainErr, {
      onRetry: () => bootstrap(),
      helpHref: HELP_HREF,
    });
    return;
  }
  renderContent(root, startupPath, JSON.stringify(mainDoc, null, 2));

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

  // Démo B-041 / B-050 — cross-filter UC-3 + drill UC-1 piloté par
  // une spec `.vviz` déclarative (`examples/cross_filter_demo.vviz`).
  // `main.ts` ne fait que (1) lire le fichier, (2) compiler via le
  // runtime, (3) mounter chaque vue compilée. Toute la logique
  // Selection/predicate vit dans `viz-engine/`.
  await renderDashboardFromVviz(root, DEFAULT_PARQUET);
}

const DEFAULT_DASHBOARD_VVIZ =
  (import.meta.env.VITE_DASHBOARD_VVIZ as string | undefined) ??
  "./examples/cross_filter_demo.vviz";

/**
 * B-041 + B-050 — Dashboard piloté par un `.vviz` (spec déclarative).
 *
 * Pipeline :
 * 1. lit le `.vviz` via `read_vviz` (B-012)
 * 2. compile via `compileToMosaic()` (B-041) — résout les Selection et
 *    transforme les views DSL en plans Mosaic
 * 3. prépare la vue DuckDB `effectifs` qui matérialise la source
 * 4. itère sur `compiled.views` et mount le composant correspondant à
 *    chaque type (`map_choropleth`, `barY`, `table`) — aucun code de
 *    filtrage métier ici, juste du dispatch par type.
 *
 * Critère No-Go H4 (PRD §12.1) : le seul `if` métier ci-dessous est le
 * dispatch par `view.type` — ce n'est pas du filtrage de données, c'est
 * de la résolution polymorphique de composant. `grep -nE "\.filter\(|
 * if.*selection|forEach.*sel" src/main.ts` reste à 0.
 */
async function renderDashboardFromVviz(
  root: HTMLElement,
  parquetPath: string,
): Promise<void> {
  const section = document.createElement("section");
  section.className = "vv-vgplot-demo vv-dashboard";
  const h = document.createElement("h2");
  h.className = "vv-h2";
  h.textContent = "Dashboard .vviz — cross-filter + drill (B-041/B-050)";
  section.appendChild(h);
  const sub = document.createElement("p");
  sub.className = "vv-note";
  sub.textContent = `Spec : ${DEFAULT_DASHBOARD_VVIZ}`;
  section.appendChild(sub);
  root.appendChild(section);

  // 1. Lire + valider le .vviz via le pipeline B-061. En cas d'erreur,
  //    on peint le bandeau typé dans la section (et non dans `root`) pour
  //    ne pas écraser le rendu principal — la démo dashboard reste un
  //    best-effort.
  const { doc: loaded, error: loadErr } = await loadVViz(
    DEFAULT_DASHBOARD_VVIZ,
  );
  if (loadErr || !loaded) {
    const errMount = document.createElement("div");
    section.appendChild(errMount);
    renderErrorBanner(
      errMount,
      loadErr ?? {
        kind: "Io",
        path: DEFAULT_DASHBOARD_VVIZ,
        message: "doc indisponible",
      },
      { helpHref: HELP_HREF },
    );
    return;
  }
  const doc = loaded as unknown as Parameters<typeof compileToMosaic>[0];

  // 2. Compiler.
  const compiled = compileToMosaic(doc);

  // 3. Préparer la vue DuckDB de la source (sample.parquet : id/label/value
  //    + code_dept synthétique). En production, ce mapping viendra du
  //    DSL — `data.sources[].path` + projection automatique des colonnes
  //    référencées par les `views[].encoding`. Hors scope V0.
  const conn = createDuckConnector();
  try {
    await conn.query({
      type: "exec",
      sql: `
        CREATE OR REPLACE VIEW effectifs AS
        SELECT id,
               label,
               value,
               LPAD(CAST(((id % 96) + 1) AS VARCHAR), 2, '0') AS code_dept
        FROM read_parquet('${parquetPath}')
      `,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const note = document.createElement("p");
    note.className = "vv-note";
    note.textContent = `Dashboard indisponible (CREATE VIEW DuckDB) : ${msg}`;
    section.appendChild(note);
    return;
  }

  // 4. Layout container — flex pour hstack, block pour vstack.
  const layout = document.createElement("div");
  layout.className =
    compiled.layout === "hstack" ? "vv-hflex" : "vv-vstack";
  section.appendChild(layout);

  // 5. Précharger la métrique par dept pour la carte (1 query global).
  const dataByDept = await fetchDataByDept(conn, "effectifs", "code_dept");

  // 6. Mounter chaque vue compilée.
  for (const view of compiled.views) {
    const mount = document.createElement("div");
    mount.dataset.viewId = view.id;
    mount.className = `vv-view vv-view-${view.type}`;
    if (view.title) {
      const t = document.createElement("h3");
      t.className = "vv-h2";
      t.textContent = view.title;
      mount.appendChild(t);
    }
    layout.appendChild(mount);
    try {
      await mountView(view, mount, compiled.ctx, conn, dataByDept);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const note = document.createElement("p");
      note.className = "vv-note";
      note.textContent = `Vue "${view.id}" (${view.type}) indisponible : ${msg}`;
      mount.appendChild(note);
    }
  }
}

/**
 * Dispatch d'une vue compilée → composant adapté. Le seul `switch` du
 * fichier — équivalent à `Visitor` côté pattern. Aucune logique de
 * filtrage de données : tout passe par les Selection.
 */
async function mountView(
  view: CompiledView,
  mount: HTMLElement,
  ctx: RuntimeContext,
  conn: ReturnType<typeof createDuckConnector>,
  dataByDept: Map<string, number>,
): Promise<void> {
  const opts = (view.options ?? {}) as Record<string, unknown>;
  const w = typeof opts.width === "number" ? opts.width : undefined;
  const ht = typeof opts.height === "number" ? opts.height : undefined;

  if (view.type === "map_choropleth") {
    const mapMount = document.createElement("div");
    mount.appendChild(mapMount);
    const svg = renderChoropleth(mapMount, dataByDept, {
      width: w ?? 480,
      height: ht ?? 480,
    });
    if (view.emitsTo) {
      bindMapSelection(svg, ctx, {
        field: "code_dept",
        selectionName: view.emitsTo,
      });
    }
    return;
  }

  if (view.type === "barY" || view.type === "barX" || view.type === "bar") {
    const enc = (view.encoding ?? {}) as Record<string, unknown>;
    const xEnc = (enc.x ?? {}) as { field?: string };
    const xField = xEnc.field ?? "code_dept";
    renderBarChart(mount, {
      source: view.source,
      xField,
      filterSelectionName: view.filterSelectionName,
      ctx,
      width: w,
      height: ht,
      fill: typeof opts.fill === "string" ? (opts.fill as string) : undefined,
    });
    return;
  }

  if (view.type === "table") {
    const enc = (view.encoding ?? {}) as { columns?: string[] };
    const columns = Array.isArray(enc.columns)
      ? enc.columns
      : ["code_dept", "id", "label", "value"];
    const drillOpts: DrillQueryOptions = {
      table: view.source,
      field: "code_dept",
      columns,
      defaultOrder:
        typeof opts.defaultOrder === "string"
          ? (opts.defaultOrder as string)
          : "id",
      limit: typeof opts.limit === "number" ? opts.limit : 5000,
    };
    const initial = await fetchDrill(conn, drillOpts, null);
    if (!initial) {
      throw new Error("requête initiale en échec");
    }
    const tableApi = renderTable(mount, initial, {
      columns: columns.map((field) => ({ field })),
      visibleRows:
        typeof opts.visibleRows === "number" ? opts.visibleRows : 15,
      onSort: (field, dir) => {
        drillOpts.orderBy = { field, dir };
        const sel = view.filterSelectionName
          ? ctx.selections.get(view.filterSelectionName)
          : undefined;
        const code = sel?.active?.value;
        fetchDrill(
          conn,
          drillOpts,
          typeof code === "string" ? code : null,
        ).then((t) => t && tableApi.setData(t));
      },
    });
    if (view.filterSelectionName) {
      onSelectionValue(ctx, view.filterSelectionName, (code) => {
        fetchDrill(conn, drillOpts, code).then(
          (t) => t && tableApi.setData(t),
        );
      });
    }
    return;
  }

  const note = document.createElement("p");
  note.className = "vv-note";
  note.textContent = `Type de vue non supporté en V0 : ${view.type}`;
  mount.appendChild(note);
}

async function fetchDataByDept(
  conn: ReturnType<typeof createDuckConnector>,
  table: string,
  field: string,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    const t = (await conn.query({
      type: "arrow",
      sql: `SELECT "${field}" AS code, COUNT(*) AS n FROM "${table}" GROUP BY "${field}"`,
    })) as {
      numRows: number;
      get: (i: number) => { code: string; n: bigint | number } | null;
    } | null;
    if (t && t.numRows) {
      for (let i = 0; i < t.numRows; i++) {
        const r = t.get(i);
        if (!r) continue;
        out.set(String(r.code), Number(r.n));
      }
    }
  } catch {
    // silencieux — la carte rendra à 0
  }
  return out;
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
