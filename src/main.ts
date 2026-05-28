// VaultViz V0 — bootstrap front (I0/B-012)
//
// Au démarrage, on tente de lire un .vviz par défaut (env `VITE_VVIZ_DEFAULT`,
// fallback `./examples/effectifs_2026.vviz`). Le contenu JSON est pretty-printé
// dans une zone <pre>. Les erreurs (NotFound / Forbidden / Io / Invalid) sont
// affichées dans un bandeau lisible.
//
// Les composants UI riches (carte, table, cross-filter) arrivent en Wave 3+.
// B-061 ajoutera la validation JSON Schema et le routage erreur.

import { invoke } from "@tauri-apps/api/core";

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
}

bootstrap();
