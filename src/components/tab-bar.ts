// Barre d'onglets internes au dashboard (navigation entre pages de vues).
//
// Pur DOM, idempotent. Chaque onglet est un bouton `.tab` ; l'onglet actif
// porte `data-active="true"`. Le clic invoque `onSelect(id)` — c'est
// l'appelant (dashboard) qui bascule les panneaux et met à jour l'état actif
// via `setActive`.

export interface TabDef {
  id: string;
  label: string;
}

export interface TabBarOpts {
  /** Id de l'onglet actif au montage. */
  active: string;
  /** Invoqué au clic sur un onglet (≠ actif courant inclus). */
  onSelect: (id: string) => void;
}

export interface TabBarHandle {
  /** Met à jour visuellement l'onglet actif (sans réémettre onSelect). */
  setActive(id: string): void;
}

export function renderTabBar(
  container: HTMLElement,
  tabs: TabDef[],
  opts: TabBarOpts,
): TabBarHandle {
  const bar = document.createElement("div");
  bar.className = "tab-bar";
  bar.setAttribute("role", "tablist");

  const buttons = new Map<string, HTMLButtonElement>();
  for (const t of tabs) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab";
    btn.textContent = t.label;
    btn.dataset.tab = t.id;
    btn.setAttribute("role", "tab");
    btn.dataset.active = String(t.id === opts.active);
    btn.addEventListener("click", () => opts.onSelect(t.id));
    buttons.set(t.id, btn);
    bar.appendChild(btn);
  }

  container.appendChild(bar);

  return {
    setActive(id: string): void {
      for (const [tid, btn] of buttons) btn.dataset.active = String(tid === id);
    },
  };
}
