// VaultViz — écran d'accueil (home).
//
// T2.3 (Wave 2, SP2) : hero (logo + titre Vault·Viz + tagline), dropzone
// (clic → dialog natif), et liste des fichiers récents.
//
// Source visuelle : `.home` dans mockups/VaultViz/VaultViz.html (home-hero,
// dropzone, recents) + classes CSS associées de mockups/VaultViz/assets/styles.css
// (.home, .home-hero, .dropzone, .recents, .recent, .recent-list…).
//
// Le composant code contre les contrats déjà mergés :
//   - src/services/recents.ts  : listRecents(), clearRecents(), RecentItem
//   - src/services/file-open.ts: openViaDialog()
//   - src/ui/icons.ts          : icon()
//
// Le vrai glisser-déposer de fichier (onFileDrop) est câblé au niveau du shell ;
// ici on ne gère QUE le retour visuel `.hot` au survol (dragenter/dragover).
//
// Refs: design-integration

import { listRecents, clearRecents, type RecentItem } from "../services/recents";
import { openViaDialog } from "../services/file-open";
import { icon } from "../ui/icons";

/** Options de montage de l'écran d'accueil. */
export interface HomeOptions {
  /** Appelé avec le chemin du .vviz à ouvrir (récent cliqué, ou dialog). */
  onOpenPath: (path: string) => void;
}

/** Poignée renvoyée par {@link mountHome}. */
export interface HomeHandle {
  /** Recharge la liste des récents (re-query + reconstruction complète). */
  refresh(): Promise<void>;
}

/** Échappe le texte injecté en HTML (titres/chemins issus du store). */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Monte l'écran d'accueil dans `el`.
 *
 * Rend la coquille statique (hero + dropzone + liste vide) de façon
 * synchrone, puis déclenche un premier `refresh()` en tâche de fond
 * (fire-and-forget) pour peupler les récents. La signature reste
 * synchrone ; en test, `await handle.refresh()` avant toute assertion
 * sur la liste.
 */
export function mountHome(el: HTMLElement, opts: HomeOptions): HomeHandle {
  el.innerHTML = `
    <div class="home">
      <div class="home-hero">
        <svg class="home-logo" viewBox="0 0 32 32" fill="none">
          <rect x="2.5" y="2.5" width="27" height="27" rx="8" fill="var(--accent)"/>
          <path d="M9 10l4.6 12h0.2L18.4 10" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
          <rect x="20.5" y="9.5" width="2.7" height="13" rx="1.3" fill="#fff" opacity=".9"/>
        </svg>
        <h1>Vault<span class="v">Viz</span></h1>
        <p class="tag">Vos dashboards data-viz, pilotés par un simple fichier. Local, instantané, sans cloud.</p>
      </div>

      <div class="dropzone" data-home-dropzone>
        <span class="dz-icon">${icon("drop")}</span>
        <div class="dz-cta">
          <div class="big">Glissez un fichier <span class="mono" style="color:var(--accent)">.vviz</span> ici</div>
          <div class="sub">ou parcourez votre disque</div>
        </div>
        <button type="button" class="tbtn primary" data-home-open style="height:38px;padding:0 18px;font-size:var(--fs-sm)">
          <span class="dz-open-icon">${icon("open")}</span>
          Ouvrir un fichier .vviz
        </button>
      </div>

      <div class="recents">
        <div class="recents-head">
          <span class="lbl">Fichiers récents</span>
          <button type="button" class="clr" data-home-clear>Effacer</button>
        </div>
        <div class="recent-list" data-home-list></div>
        <div class="empty-recents" data-home-empty style="display:none">Aucun fichier récent — ouvrez un <span class="mono">.vviz</span> pour démarrer.</div>
      </div>
    </div>
  `;

  const dropzone = el.querySelector<HTMLElement>("[data-home-dropzone]");
  const openBtn = el.querySelector<HTMLButtonElement>("[data-home-open]");
  const clearBtn = el.querySelector<HTMLButtonElement>("[data-home-clear]");
  const list = el.querySelector<HTMLElement>("[data-home-list]");
  const empty = el.querySelector<HTMLElement>("[data-home-empty]");

  // Récents courants, conservés en closure : la résolution du clic se
  // fait par index (data-i) pour ne jamais réinjecter un chemin UNC dans
  // le HTML/les attributs.
  let items: RecentItem[] = [];

  // --- Ouverture via dialog natif (clic dropzone ou bouton) ---
  async function openDialog(): Promise<void> {
    const picked = await openViaDialog();
    if (picked) opts.onOpenPath(picked);
  }

  if (dropzone) {
    dropzone.addEventListener("click", () => {
      void openDialog();
    });
    // Retour visuel uniquement : `.hot` au survol. Le vrai drop fichier
    // est géré par le shell via onFileDrop (file-open.ts).
    (["dragenter", "dragover"] as const).forEach((ev) =>
      dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        dropzone.classList.add("hot");
      }),
    );
    (["dragleave", "drop"] as const).forEach((ev) =>
      dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        dropzone.classList.remove("hot");
      }),
    );
  }

  // Le bouton est dans la dropzone (clic propagé) ; on stoppe la
  // propagation pour éviter un double déclenchement.
  if (openBtn) {
    openBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      void openDialog();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      void (async () => {
        await clearRecents();
        await refresh();
      })();
    });
  }

  function renderList(): void {
    if (!list || !empty) return;
    if (items.length === 0) {
      list.innerHTML = "";
      list.style.display = "none";
      empty.style.display = "block";
      return;
    }
    list.style.display = "";
    empty.style.display = "none";
    list.innerHTML = items
      .map((r, i) => {
        const broken = r.broken === true;
        const ricon = broken ? icon("warning") : icon("file");
        const right = broken
          ? '<span class="rbadge">⚠ Schéma invalide</span>'
          : "";
        return `
          <button type="button" class="recent ${broken ? "broken" : ""}" data-i="${i}">
            <span class="ricon">${ricon}</span>
            <span class="rmeta">
              <span class="rname">${esc(r.title)}</span>
              <span class="rpath">${esc(r.path)}</span>
            </span>
            <span class="rright">${right}</span>
          </button>`;
      })
      .join("");

    list.querySelectorAll<HTMLButtonElement>(".recent").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-i"));
        const r = items[i];
        if (r) opts.onOpenPath(r.path);
      });
    });
  }

  async function refresh(): Promise<void> {
    items = await listRecents();
    renderList();
  }

  // Premier peuplement en tâche de fond (la signature reste synchrone).
  void refresh();

  return { refresh };
}
