// B-121 — Bandeau de refresh non intrusif.
//
// Affiche une notification « Données mises à jour — Recharger » lorsque le
// watcher FS (B-120) signale un changement sur les fichiers Parquet.
//
// Règles produit :
// - AUCUN rechargement automatique (UC-5 explicite) : l'utilisateur DOIT cliquer.
// - Masqué au départ ; s'affiche uniquement sur appel explicite de `show()`.
// - « Ignorer » masque le bandeau pour la session, jusqu'au prochain `show()`.
//
// Visuel : bandeau fixe en bas de la zone `.stage`, non bloquant.
// Tokens CSS : --warn / --warn-soft (couleur info-update), --surface-1, --text-1.
//
// Accessibilité : `role="status"` (implique aria-live="polite") — notification
// non intrusive, pas d'alerte bloquante.
//
// Refs: B-121, CLAUDE.md §3 invariant UC-5.

/** Poignée retournée par {@link mountRefreshBanner} pour piloter le bandeau. */
export interface RefreshBannerHandle {
  /** Affiche le bandeau (notification de changement disponible). */
  show(): void;
}

/** Options de montage du bandeau de refresh. */
export interface RefreshBannerOptions {
  /**
   * Callback déclenché UNIQUEMENT sur clic du bouton « Recharger ».
   * N'est JAMAIS appelé automatiquement (invariant UC-5).
   */
  onReload: () => void;
}

/**
 * Monte le bandeau de refresh non intrusif dans `container`.
 *
 * Le bandeau est masqué par défaut (classe `.on` absente).
 * `handle.show()` le rend visible.
 * « Recharger » appelle `onReload` puis masque.
 * « Ignorer » masque sans appeler `onReload`.
 */
export function mountRefreshBanner(
  container: HTMLElement,
  opts: RefreshBannerOptions,
): RefreshBannerHandle {
  const REFRESH_ICON = `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 3v3.5H9.5"/><path d="M12.6 6.5A5 5 0 1 0 13 9"/></svg>`;

  const banner = document.createElement("div");
  banner.className = "refresh-banner";
  banner.setAttribute("role", "status");

  const msg = document.createElement("span");
  msg.className = "rb-msg";
  msg.textContent = "Données mises à jour";

  const reloadBtn = document.createElement("button");
  reloadBtn.type = "button";
  reloadBtn.className = "btn vv-rb-reload";
  reloadBtn.innerHTML = `${REFRESH_ICON}Recharger`;

  const dismissBtn = document.createElement("button");
  dismissBtn.type = "button";
  dismissBtn.className = "btn ghost vv-rb-dismiss";
  dismissBtn.textContent = "Ignorer";

  banner.append(msg, reloadBtn, dismissBtn);
  container.appendChild(banner);

  function hide(): void {
    banner.classList.remove("on");
  }

  reloadBtn.addEventListener("click", () => {
    hide();
    opts.onReload();
  });

  dismissBtn.addEventListener("click", () => {
    hide();
  });

  return {
    show(): void {
      banner.classList.add("on");
    },
  };
}
