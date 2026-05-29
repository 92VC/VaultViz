// Splash de chargement à étapes (T2.6 / SP2).
// Repris de `.loader` dans la maquette (l-file, lbar, l-steps).
// Pur DOM, aucune dépendance Tauri, aucune temporisation hardcodée :
// l'appelant pilote progress/step au fil du pipeline loadVViz.

// Étapes réelles mappables sur le pipeline loadVViz par l'appelant.
export const LOAD_STEPS: string[] = [
  "Lecture du fichier…",
  "Parsing JSON…",
  "Validation du schéma…",
  "Indexation…",
  "Rendu des vues…",
];

export interface LoaderStartOptions {
  name: string;
  size?: string;
}

export interface LoaderHandle {
  /** Affiche le loader, remet la barre à 0 et renseigne le nom/taille du fichier. */
  start(opts: LoaderStartOptions): void;
  /** Met la largeur de la barre de progression (0..100, clampé). */
  setProgress(pct: number): void;
  /** Met le texte de l'étape courante. */
  setStep(label: string): void;
  /** Bascule en état « ✓ prêt » et passe la barre à 100 %. */
  done(): void;
  /** Masque le loader. */
  hide(): void;
}

const FILE_ICON = `<svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M5 2h5l3 3v11H5z"/><path d="M10 2v3h3"/></svg>`;

export function mountLoader(el: HTMLElement): LoaderHandle {
  el.innerHTML = `
    <div class="loader" style="display:none">
      <div class="l-file">
        <div class="l-ico">${FILE_ICON}</div>
        <div>
          <div class="l-name"></div>
          <div class="l-sz"></div>
        </div>
      </div>
      <div class="lbar"><i></i></div>
      <div class="l-steps"></div>
    </div>
  `;

  const root = el.querySelector<HTMLElement>(".loader")!;
  const name = el.querySelector<HTMLElement>(".l-name")!;
  const size = el.querySelector<HTMLElement>(".l-sz")!;
  const bar = el.querySelector<HTMLElement>(".lbar i")!;
  const steps = el.querySelector<HTMLElement>(".l-steps")!;

  const setProgress = (pct: number): void => {
    const clamped = Math.max(0, Math.min(100, pct));
    bar.style.width = `${clamped}%`;
  };

  return {
    start(opts: LoaderStartOptions): void {
      name.textContent = opts.name;
      size.textContent = opts.size ?? "";
      steps.textContent = LOAD_STEPS[0];
      setProgress(0);
      root.style.display = "flex";
    },
    setProgress,
    setStep(label: string): void {
      steps.textContent = label;
    },
    done(): void {
      setProgress(100);
      steps.innerHTML = "<b>✓ prêt</b>";
    },
    hide(): void {
      root.style.display = "none";
    },
  };
}
