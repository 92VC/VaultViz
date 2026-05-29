// T3.6a (SP3) — Composant chip de filtre actif.
//
// Porté de `.filter-chip` (mockups/VaultViz/VaultViz.html ~131) et du
// comportement `setSelect`/`#filter-chip` (mockups/VaultViz/assets/app.js
// ~240-247) : le chip est caché par défaut et s'affiche (classe `on`) quand
// un filtre est posé, avec un bouton `.x` (icône close) qui réinitialise.
//
// CSS associé : `.filter-chip`/`.filter-chip.on`/`.filter-chip .x` dans
// `src/styles/components.css`. Pur DOM, sans dépendance externe.
//
// Refs: design-integration

import { icon } from "../ui/icons";

/** Poignée retournée par {@link mountFilterChip} pour piloter le chip. */
export interface FilterChipHandle {
  /**
   * Met à jour l'état du chip.
   *
   * @param label libellé du filtre actif (« Filtré : <label> ») ; `null`
   *   masque le chip.
   */
  set(label: string | null): void;
}

/** Options de montage du chip de filtre. */
export interface FilterChipOptions {
  /** Appelé lorsque l'utilisateur clique sur le bouton `.x`. */
  onClear: () => void;
}

/**
 * Monte un chip de filtre actif dans `container`.
 *
 * Le chip est caché par défaut ; {@link FilterChipHandle.set} l'affiche avec
 * le libellé fourni (échappé) et un bouton de réinitialisation.
 */
export function mountFilterChip(
  container: HTMLElement,
  opts: FilterChipOptions,
): FilterChipHandle {
  const chip = document.createElement("span");
  chip.className = "filter-chip";

  const text = document.createElement("span");

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "x";
  clear.setAttribute("aria-label", "Retirer le filtre");
  clear.innerHTML = icon("close");
  clear.addEventListener("click", () => opts.onClear());

  chip.append(text, clear);
  container.append(chip);

  return {
    set(label: string | null): void {
      if (label === null) {
        chip.classList.remove("on");
        text.textContent = "";
        return;
      }
      // textContent échappe le libellé (pas d'injection HTML).
      text.textContent = `Filtré : ${label}`;
      chip.classList.add("on");
    },
  };
}
