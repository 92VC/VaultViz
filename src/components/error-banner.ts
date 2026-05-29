// B-060 — Bandeau d'erreur typé avec bouton "Réessayer".
//
// Composant UI unique pour afficher toute erreur utilisateur — qu'elle
// vienne d'un retour Tauri (`VVizError` sérialisé `{kind, message}`,
// cf. `src-tauri/src/error.rs`) ou d'une validation côté front
// (`Invalid` via Ajv en B-061).
//
// Règles produit :
// - **pas de stack trace** exposée à l'utilisateur final ;
// - copy francisée, action explicite (Réessayer / Aide),
// - distingue 5 catégories : NotFound / Forbidden / Corrupt / Invalid / Io.
//
// Refs PRD : §8.3 logs, UC-6 ; ADR-008 ; CLAUDE.md §3 invariant I-2.

export type ErrorKind = "NotFound" | "Forbidden" | "Corrupt" | "Invalid" | "Io";

export interface ErrorPayload {
  kind: ErrorKind;
  /** Chemin attendu — affiché à l'utilisateur pour qu'il puisse vérifier. */
  path: string;
  /** Détail technique court (sans stack). Ex. message Ajv ou IO error. */
  message?: string;
  /** Liste de violations (typiquement erreurs JSON Schema en `Invalid`). */
  details?: string[];
}

const COPY: Record<ErrorKind, (p: ErrorPayload) => string> = {
  NotFound: (p) =>
    `Fichier introuvable : ${p.path}. Vérifiez le chemin ou contactez le publisher du dashboard.`,
  Forbidden: (p) =>
    `Accès refusé par la politique de capability FS pour : ${p.path}. Le partage est-il monté et le scope FS configuré ?`,
  Corrupt: (p) =>
    `Fichier corrompu ou format inattendu : ${p.path}. Le publisher est-il à jour ?`,
  Invalid: (p) =>
    `Spec .vviz invalide : ${p.path}. ${p.message ?? "Vérifiez la structure JSON."}`,
  Io: (p) =>
    `Erreur d'entrée/sortie : ${p.path}.${p.message ? " " + p.message : ""}`,
};

/** Titre court francisé par catégorie (`.e-title` de la maquette). */
const TITLE: Record<ErrorKind, string> = {
  NotFound: "Fichier introuvable",
  Forbidden: "Accès refusé",
  Corrupt: "Fichier corrompu",
  Invalid: "Schéma invalide — le fichier ne respecte pas la spec .vviz",
  Io: "Erreur d'entrée/sortie",
};

export interface RenderErrorOpts {
  /** Callback déclenché par le bouton "Réessayer". */
  onRetry?: () => void;
  /** Callback déclenché par le bouton "Annuler" (retour accueil). */
  onHome?: () => void;
  /** Lien vers la doc auteur affiché sur le bouton "Documentation". */
  docHref?: string;
  /**
   * Alias rétro-compatible de `docHref` (callers historiques B-060).
   * @deprecated utiliser `docHref`.
   */
  helpHref?: string;
}

/**
 * Rend le bandeau d'erreur dans `container` (remplace son contenu).
 *
 * Visuel conforme à la maquette (`.errbar` : icône warning, titre adapté
 * au `kind`, message, chemin, actions Annuler/Documentation/Réessayer, et
 * liste `.violations` si `details[]` présent).
 *
 * Ne propage **jamais** d'erreur — son rôle est précisément d'absorber
 * tous les échecs amont. Le caller est libre de retenter via `onRetry`.
 */
export function renderErrorBanner(
  container: HTMLElement,
  err: ErrorPayload,
  opts: RenderErrorOpts = {},
): void {
  const title = TITLE[err.kind];
  const msg = COPY[err.kind](err);
  const docHref = opts.docHref ?? opts.helpHref;

  const warnIcon = `<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 2.5L20 18.5H2z"/><path d="M11 9v4M11 15.5v.3"/></svg>`;
  const docIcon = `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M6 3H3.5v9.5h9V10"/><path d="M9 3h4v4M13 3L7.5 8.5"/></svg>`;
  const retryIcon = `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 3v3.5H9.5"/><path d="M12.6 6.5A5 5 0 1 0 13 9"/></svg>`;

  const docHtml = docHref
    ? `<a class="btn vv-doc" href="${escapeAttr(docHref)}" target="_blank" rel="noopener noreferrer">${docIcon}Documentation</a>`
    : "";

  const violationsHtml =
    err.details && err.details.length
      ? `<div class="violations">${err.details
          .map(
            (d) =>
              `<div class="viol"><span class="vmsg"><code>${escapeHtml(d)}</code></span></div>`,
          )
          .join("")}</div>`
      : "";

  container.innerHTML = `
    <div class="errbar on" role="alert" data-kind="${escapeAttr(err.kind)}">
      <div class="errbar-head">
        <div class="e-ico">${warnIcon}</div>
        <div class="e-body">
          <div class="e-title">${escapeHtml(title)}</div>
          <div class="e-msg">${escapeHtml(msg)}</div>
          <span class="e-path">${escapeHtml(err.path)}</span>
        </div>
        <div class="e-actions">
          <button type="button" class="btn ghost vv-home">Annuler</button>
          ${docHtml}
          <button type="button" class="btn danger vv-retry">${retryIcon}Réessayer</button>
        </div>
      </div>
      ${violationsHtml}
    </div>
  `;

  const retryBtn = container.querySelector<HTMLButtonElement>(".vv-retry");
  if (retryBtn && opts.onRetry) {
    retryBtn.addEventListener("click", opts.onRetry);
  }
  const homeBtn = container.querySelector<HTMLButtonElement>(".vv-home");
  if (homeBtn && opts.onHome) {
    homeBtn.addEventListener("click", opts.onHome);
  }
}

/**
 * Normalise un payload d'erreur reçu de Tauri (`VVizError` Rust sérialisé
 * via `#[serde(tag="kind", content="message")]` en `{kind, message}`)
 * vers le type front `ErrorPayload`. Tout payload inconnu est mappé en
 * `Io` (catégorie générique non-stack-trace).
 */
export function fromVVizError(payload: unknown, path: string): ErrorPayload {
  if (payload && typeof payload === "object" && "kind" in payload) {
    const obj = payload as { kind?: unknown; message?: unknown };
    const kind = isErrorKind(obj.kind) ? obj.kind : "Io";
    const message =
      typeof obj.message === "string" ? obj.message : undefined;
    return { kind, path, message };
  }
  return { kind: "Io", path, message: String(payload) };
}

function isErrorKind(v: unknown): v is ErrorKind {
  return (
    v === "NotFound" ||
    v === "Forbidden" ||
    v === "Corrupt" ||
    v === "Invalid" ||
    v === "Io"
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
