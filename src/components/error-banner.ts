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

export interface RenderErrorOpts {
  /** Callback déclenché par le bouton "Réessayer". */
  onRetry?: () => void;
  /** Lien optionnel vers la doc auteur (placeholder V0). */
  helpHref?: string;
}

/**
 * Rend le bandeau d'erreur dans `container` (remplace son contenu).
 *
 * Ne propage **jamais** d'erreur — son rôle est précisément d'absorber
 * tous les échecs amont. Le caller est libre de retenter via `onRetry`.
 */
export function renderErrorBanner(
  container: HTMLElement,
  err: ErrorPayload,
  opts: RenderErrorOpts = {},
): void {
  const copy = COPY[err.kind](err);
  const detailsHtml =
    err.details && err.details.length
      ? `<ul class="vv-error-details">${err.details
          .map((d) => `<li><code>${escapeHtml(d)}</code></li>`)
          .join("")}</ul>`
      : "";
  const helpHtml = opts.helpHref
    ? `<a href="${escapeAttr(opts.helpHref)}" class="vv-help" target="_blank" rel="noopener noreferrer">Aide</a>`
    : "";
  container.innerHTML = `
    <div class="vv-error" role="alert" data-kind="${escapeAttr(err.kind)}">
      <div class="vv-error-head">
        <strong>Erreur</strong>
        <span class="vv-error-kind">${escapeHtml(err.kind)}</span>
      </div>
      <p class="vv-error-msg">${escapeHtml(copy)}</p>
      ${detailsHtml}
      <div class="vv-error-actions">
        <button type="button" class="vv-retry">Réessayer</button>
        ${helpHtml}
      </div>
    </div>
  `;
  const btn = container.querySelector<HTMLButtonElement>(".vv-retry");
  if (btn && opts.onRetry) {
    btn.addEventListener("click", opts.onRetry);
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
