// Barre supérieure permanente : affiche le fichier `.vviz` courant et
// expose un bouton « Ouvrir un fichier .vviz... » qui invoque le
// callback fourni par le caller (qui ouvre lui-même le dialog Tauri).

export interface ToolbarOptions {
  onOpen: () => void;
  currentPath: string | null;
}

function shortName(path: string): string {
  const norm = path.replace(/\\/g, "/");
  const parts = norm.split("/");
  return parts[parts.length - 1] || path;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

export function renderToolbar(container: HTMLElement, opts: ToolbarOptions): void {
  const label = opts.currentPath ? shortName(opts.currentPath) : "Aucun fichier";
  const title = opts.currentPath ?? "Aucun fichier ouvert";
  container.innerHTML = `
    <header class="vv-toolbar" role="banner">
      <div class="vv-toolbar-brand">
        <strong>VaultViz</strong>
        <span class="vv-toolbar-version">V0</span>
      </div>
      <div class="vv-toolbar-file" title="${escapeAttr(title)}">
        <span class="vv-toolbar-label">Fichier :</span>
        <code>${escapeHtml(label)}</code>
      </div>
      <div class="vv-toolbar-actions">
        <button type="button" class="vv-open-btn">Ouvrir un fichier .vviz…</button>
      </div>
    </header>
  `;
  const btn = container.querySelector<HTMLButtonElement>(".vv-open-btn");
  if (btn) btn.addEventListener("click", () => opts.onOpen());
}
