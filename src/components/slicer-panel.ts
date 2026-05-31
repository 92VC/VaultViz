// Composant maison (DOM) : panneau de cases à cocher pour un slicer.
// Chaque case correspond à une valeur distincte ; le callback `onChange`
// reçoit le tableau des valeurs cochées à chaque changement.
// Aucun appel réseau, aucune logique de filtrage JS (push-down DuckDB).

export interface SlicerPanelOptions {
  /** Label affiché en tête de panneau. */
  label: string;
  /** Valeurs disponibles (issues du DSL .vviz). */
  values: string[];
  /** Valeurs pré-cochées à l'initialisation. */
  selected: string[];
  /** Rappelé à chaque changement de sélection. */
  onChange: (selected: string[]) => void;
}

/**
 * Rend un panneau de cases à cocher dans `container`.
 * - Écrase le contenu existant de `container`.
 * - Un clic sur une case met à jour l'ensemble courant et appelle `onChange`.
 */
export function renderSlicerPanel(container: HTMLElement, opts: SlicerPanelOptions): void {
  container.innerHTML = "";
  container.classList.add("slicer-panel");

  const title = document.createElement("div");
  title.className = "slicer-panel__label";
  title.textContent = opts.label;
  container.appendChild(title);

  const current = new Set(opts.selected);

  for (const v of opts.values) {
    const row = document.createElement("label");
    row.className = "slicer-panel__row";

    const box = document.createElement("input");
    box.type = "checkbox";
    box.value = v;
    box.checked = current.has(v);

    box.addEventListener("change", () => {
      if (box.checked) current.add(v);
      else current.delete(v);
      opts.onChange([...current]);
    });

    const span = document.createElement("span");
    span.textContent = v;

    row.append(box, span);
    container.appendChild(row);
  }
}
