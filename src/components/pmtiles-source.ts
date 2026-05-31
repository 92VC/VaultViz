// B-101 — Plomberie PMTiles pour MapLibre GL JS.
//
// Ce module expose deux fonctions :
//   - registerPmtilesProtocol() : enregistre le protocole "pmtiles" auprès
//     de MapLibre (doit être appelé une fois avant d'ajouter une source).
//   - addPmtilesBasemap(map, pmtilesPath) : ajoute une source vectorielle
//     pmtiles:// et des layers de fond minimalistes, ou ne fait rien si
//     aucun chemin n'est fourni.
//
// Invariant I-2 : ZÉRO appel réseau.
// La source pmtiles:// pointe vers un chemin local (fichier sur le partage
// réseau local ou ressource embarquée dans src-tauri/resources/).
// Aucune URL de schéma réseau n'est construite dans ce module.
//
// Décision §16 Q3 (fond V1) : voir docs/adr/ADR-PMTiles-basemap.md.
// Par défaut, aucun fond PMTiles n'est embarqué (reco ADR = fond transparent
// + choroplèthe départementale suffisent pour V1 CPAM).

import * as maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";

// Garde module-level : le protocole n'est enregistré qu'une seule fois,
// même si registerPmtilesProtocol() est appelé plusieurs fois.
let _protocolRegistered = false;

/**
 * Enregistre le protocole "pmtiles" auprès de MapLibre GL JS.
 *
 * Idempotent : plusieurs appels successifs n'enregistrent qu'une seule fois.
 * Doit être appelé avant d'ajouter une source `pmtiles://`.
 *
 * @param protocol — Instance Protocol optionnelle (injection pour tests).
 *   Si non fournie, une nouvelle instance Protocol est créée.
 */
export function registerPmtilesProtocol(protocol?: Protocol): void {
  if (_protocolRegistered) return;
  const p = protocol ?? new Protocol();
  maplibregl.addProtocol("pmtiles", p.tile);
  _protocolRegistered = true;
}

/**
 * Expose la garde d'enregistrement pour les tests uniquement.
 * @internal
 */
export function _resetProtocolRegisteredForTests(): void {
  _protocolRegistered = false;
}

/**
 * Layers de fond minimalistes ajoutés quand un fichier PMTiles est fourni.
 *
 * Ces layers supposent un schéma de données vectoriel standard (OpenMapTiles).
 * Si le fond PMTiles fourni utilise un schéma différent, les layers peuvent
 * ne rien afficher — ce n'est pas une erreur, la carte reste fonctionnelle.
 */
const BASEMAP_LAYERS: maplibregl.LayerSpecification[] = [
  {
    id: "pmtiles-background",
    type: "background",
    paint: { "background-color": "#f8f4f0" },
  },
  {
    id: "pmtiles-water",
    type: "fill",
    source: "pmtiles-basemap",
    "source-layer": "water",
    paint: { "fill-color": "#aad3df" },
  },
  {
    id: "pmtiles-landuse",
    type: "fill",
    source: "pmtiles-basemap",
    "source-layer": "landuse",
    filter: ["==", "class", "residential"],
    paint: { "fill-color": "#e8e0d8" },
  },
  {
    id: "pmtiles-roads",
    type: "line",
    source: "pmtiles-basemap",
    "source-layer": "transportation",
    paint: {
      "line-color": "#ffffff",
      "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.5, 10, 2],
    },
  },
  {
    id: "pmtiles-boundaries",
    type: "line",
    source: "pmtiles-basemap",
    "source-layer": "boundary",
    filter: ["==", "admin_level", 4],
    paint: {
      "line-color": "#9e9e9e",
      "line-width": 0.8,
      "line-dasharray": [3, 2],
    },
  },
];

/**
 * Ajoute une source vectorielle PMTiles et des layers de fond minimalistes
 * à la carte MapLibre.
 *
 * Si `pmtilesPath` est vide ou absent, la fonction est un no-op :
 * la carte conserve son fond transparent + choroplèthe.
 *
 * @param map — Instance MapLibre déjà chargée (événement "load" déjà émis).
 * @param pmtilesPath — Chemin LOCAL vers le fichier .pmtiles, ex :
 *   - `./resources/basemap.pmtiles` (ressource embarquée Tauri)
 *   - `//serveur/partage/cartes/idf.pmtiles` (chemin UNC local)
 *   Ne jamais passer une URL http(s):// (invariant I-2).
 */
export function addPmtilesBasemap(
  map: maplibregl.Map,
  pmtilesPath: string | undefined,
): void {
  // No-op si aucun chemin fourni (comportement par défaut V1 — reco ADR).
  if (!pmtilesPath) return;

  // Enregistrement paresseux du protocole (idempotent).
  registerPmtilesProtocol();

  // Ajout de la source.
  map.addSource("pmtiles-basemap", {
    type: "vector",
    url: `pmtiles://${pmtilesPath}`,
  });

  // Ajout des layers de fond (insérés en premier = sous la choroplèthe).
  for (const layer of BASEMAP_LAYERS) {
    map.addLayer(layer);
  }
}
