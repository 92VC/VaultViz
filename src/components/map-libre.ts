// B-100 — Wrapper MapLibre GL JS.
//
// Crée une carte de fond vide (style version 8 sans tuile réseau),
// centrée sur la France, avec contrôle de zoom/panorama.
//
// Invariant I-2 : ZÉRO appel réseau — le style est inline, pas d'URL.
// Le CSS MapLibre est chargé via src/styles/map.css (import local bundler).

import * as maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";

/** Options de création de la carte de fond. */
export interface BaseMapOptions {
  /** Conteneur DOM dans lequel injecter la carte (doit être non vide côté MapLibre). */
  container?: HTMLElement;
  /** Longitude/Latitude du centre. Défaut : [2.5, 46.5] (France). */
  center?: [number, number];
  /** Niveau de zoom initial. Défaut : 5. */
  zoom?: number;
}

/**
 * Crée une carte MapLibre GL JS de base dans `container`.
 *
 * Style minimal **vide** (version 8, `sources: {}`, `layers: []`) :
 * aucune tuile réseau n'est jamais chargée.
 *
 * Ajoute automatiquement un `NavigationControl` (boutons +/- et boussole).
 *
 * @returns L'instance `maplibregl.Map` créée.
 */
export function createBaseMap(
  container: HTMLElement,
  opts: BaseMapOptions = {},
): maplibregl.Map {
  const center: [number, number] = opts.center ?? [2.5, 46.5];
  const zoom: number = opts.zoom ?? 5;

  // Style minimal inline — AUCUNE URL réseau (invariant I-2).
  // `version: 8 as const` est nécessaire pour satisfaire StyleSpecification
  // qui attend le littéral `8`, pas le type `number`.
  const emptyStyle: StyleSpecification = {
    version: 8 as const,
    sources: {},
    layers: [],
  };

  const map = new maplibregl.Map({
    container,
    style: emptyStyle,
    center,
    zoom,
  });

  map.addControl(new maplibregl.NavigationControl());

  return map;
}
