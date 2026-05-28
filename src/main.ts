// VaultViz V0 — bootstrap front (interpréteur réel .vviz).
//
// Flux :
//   1. resolveStartupPath() (argv / VVIZ_DEFAULT / bundle resource)
//   2. Toolbar permanente avec bouton "Ouvrir un fichier .vviz..."
//   3. Si Some(path) au boot → openVViz(path), sinon welcome
//   4. openVViz(path) :
//        - read_vviz + parse + Ajv (spec-loader)
//        - loadSources : CREATE VIEW par source du .vviz
//        - pour chaque view : compileView + mountCompiledView
//
// Plus aucune démo hardcodée. Le .vviz ouvert pilote intégralement le
// rendu (paths, fields, agrégats, layout, selections).

import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

import { loadVViz } from "./viz-engine/spec-loader";
import { loadSources } from "./viz-engine/source-loader";
import { compileView } from "./viz-engine/view-compiler";
import { mountCompiledView } from "./viz-engine/view-mounter";
import { vvizDir } from "./viz-engine/path-resolver";
import { createDuckConnector } from "./viz-engine/duck-connector";
import { createRuntime, ensureSelection } from "./viz-engine/mosaic-runtime";
import { initMosaicRuntime } from "./viz-engine";

import { renderToolbar } from "./components/toolbar";
import { renderWelcome } from "./components/welcome";
import { renderErrorBanner, fromVVizError } from "./components/error-banner";

const HELP_HREF = "https://github.com/92VC/VaultViz/tree/main/docs/user";

let toolbarHost: HTMLElement | null = null;
let contentHost: HTMLElement | null = null;
let currentPath: string | null = null;

function refreshToolbar(): void {
  if (!toolbarHost) return;
  renderToolbar(toolbarHost, {
    onOpen: () => {
      pickAndOpen().catch((err) => console.error("[VaultViz] dialog error", err));
    },
    currentPath,
  });
}

async function pickAndOpen(): Promise<void> {
  const picked = await openDialog({
    title: "Ouvrir un fichier .vviz",
    filters: [{ name: "VaultViz spec", extensions: ["vviz"] }],
    multiple: false,
    directory: false,
  });
  if (typeof picked === "string") {
    await openVViz(picked);
  }
}

async function openVViz(path: string): Promise<void> {
  currentPath = path;
  refreshToolbar();
  if (!contentHost) return;

  contentHost.innerHTML = `<p class="vv-note">Chargement de ${escapeText(path)}…</p>`;

  // 1. Read + parse + validate
  const { doc, error } = await loadVViz(path);
  if (error || !doc) {
    renderErrorBanner(
      contentHost,
      error ?? fromVVizError({ kind: "Io", message: "doc indisponible" }, path),
      {
        onRetry: () => openVViz(path),
        helpHref: HELP_HREF,
      },
    );
    return;
  }

  // 2. Init runtime Mosaic (idempotent — best-effort hors Tauri)
  try {
    initMosaicRuntime();
  } catch (err) {
    console.warn("[VaultViz] init Mosaic indisponible :", err);
  }
  const ctx = createRuntime();
  for (const s of doc.spec.selections ?? []) {
    ensureSelection(ctx, s.id, s.kind);
  }

  // 3. Charger les sources DuckDB depuis doc.data.sources[]
  const conn = createDuckConnector();
  try {
    await loadSources(conn, doc, vvizDir(path));
  } catch (err) {
    renderErrorBanner(
      contentHost,
      {
        kind: "Io",
        path,
        message: `Chargement des sources : ${(err as Error).message}`,
      },
      { onRetry: () => openVViz(path), helpHref: HELP_HREF },
    );
    return;
  }

  // 4. Rendu : titre + description + grid des vues
  contentHost.innerHTML = "";
  const title = document.createElement("h1");
  title.className = "vv-doc-title";
  title.textContent = doc.vviz.title;
  contentHost.appendChild(title);
  if (doc.vviz.description) {
    const sub = document.createElement("p");
    sub.className = "vv-doc-sub";
    sub.textContent = doc.vviz.description;
    contentHost.appendChild(sub);
  }

  const layout = document.createElement("div");
  layout.className = `vv-layout vv-layout-${doc.spec.layout ?? "vstack"}`;
  contentHost.appendChild(layout);

  for (const v of doc.spec.views) {
    const frame = document.createElement("section");
    frame.className = `vv-view-frame vv-view-${v.type}`;
    frame.dataset.viewId = v.id;
    if (v.title) {
      const h = document.createElement("h2");
      h.className = "vv-view-title";
      h.textContent = v.title;
      frame.appendChild(h);
    }
    const mount = document.createElement("div");
    mount.className = "vv-view-mount";
    frame.appendChild(mount);
    layout.appendChild(frame);

    try {
      const compiled = compileView(v);
      await mountCompiledView(compiled, mount, ctx, conn);
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      const note = document.createElement("p");
      note.className = "vv-note vv-note-error";
      note.textContent = `Vue "${v.id}" (${v.type}) : ${msg}`;
      mount.appendChild(note);
    }
  }
}

async function resolveStartupPath(): Promise<string | null> {
  // Garde-fou : si l'IPC ne répond pas en 2 s, on bascule sur welcome
  // au lieu de bloquer indéfiniment sur une page blanche.
  try {
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
    const r = await Promise.race([
      invoke<string | null>("startup_path"),
      timeout,
    ]);
    return typeof r === "string" && r.length > 0 ? r : null;
  } catch (err) {
    console.warn("[VaultViz] startup_path indisponible :", err);
    return null;
  }
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function bootstrap(): Promise<void> {
  const root = document.getElementById("app");
  if (!root) return;
  root.innerHTML = `
    <div class="vv-toolbar-host"></div>
    <div class="vv-content-host"></div>
  `;
  toolbarHost = root.querySelector(".vv-toolbar-host");
  contentHost = root.querySelector(".vv-content-host");
  refreshToolbar();

  const startupPath = await resolveStartupPath();
  if (startupPath) {
    await openVViz(startupPath);
  } else if (contentHost) {
    renderWelcome(contentHost, {
      onOpen: () => {
        pickAndOpen().catch((err) =>
          console.error("[VaultViz] dialog error", err),
        );
      },
    });
  }
}

bootstrap();
