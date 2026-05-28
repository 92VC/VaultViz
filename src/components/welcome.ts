// Écran d'accueil affiché tant qu'aucun .vviz n'a été ouvert.
// Bouton CTA principal qui appelle `onOpen` (le caller ouvre le dialog).

export interface WelcomeOptions {
  onOpen: () => void;
}

export function renderWelcome(container: HTMLElement, opts: WelcomeOptions): void {
  container.innerHTML = `
    <section class="vv-welcome">
      <h1>VaultViz</h1>
      <p class="vv-welcome-sub">Visualiseur local de fichiers <code>.vviz</code></p>
      <button type="button" class="vv-welcome-open">Ouvrir un fichier .vviz…</button>
      <p class="vv-welcome-hint">
        Astuce : tu peux aussi double-cliquer un <code>.vviz</code> dans l'Explorateur Windows.
      </p>
    </section>
  `;
  const btn = container.querySelector<HTMLButtonElement>(".vv-welcome-open");
  if (btn) btn.addEventListener("click", () => opts.onOpen());
}
