# ADR-009 — Cartographie MapLibre GL JS + TopoJSON IGN ADMIN EXPRESS COG

| Champ | Valeur |
|---|---|
| Statut | Accepté (cible V1 ; V0 = TopoJSON statique simplifié) |
| Date | 2026-05-28 |
| Source | [PRD.md §6.2 et §15 (récap ADRs)](../../PRD.md) |
| Sponsor | Métier + Référent géo |

## Contexte

VaultViz doit rendre des cartes choroplèthes interactives (zoom, pan, drill-down) à l'échelle départementale (V0) puis communale (V1+). Trois familles d'options : (1) D3 SVG pur (simple, peu coûteux, mais limité au zoom statique), (2) **MapLibre GL JS** (WebGL, vector tiles, interaction riche), (3) Leaflet (raster classique).

Le référentiel géographique français de référence est l'**IGN ADMIN EXPRESS COG** (édition trimestrielle, licence Etalab 2.0 — utilisation libre y compris commerciale, avec mention).

## Décision

Cartographie V1 = **MapLibre GL JS** + référentiel géographique = **IGN ADMIN EXPRESS COG simplifiée**, convertie en TopoJSON (quantization ~5 %).

En V0, rendu statique SVG/D3 avec TopoJSON France simplifié (sourcé Etalab) embarqué — substitut le temps que MapLibre soit intégré en V1-1.

## Conséquences

**Justification** :
- MapLibre GL JS : projet OSS (fork OpenSourceLibre du Mapbox v1 pré-licence propriétaire), maintenance active, WebGL performant, support PMTiles natif.
- IGN ADMIN EXPRESS COG : référentiel administratif français officiel, mis à jour trimestriellement, licence Etalab 2.0 = utilisation libre y compris commerciale avec mention.
- TopoJSON (vs GeoJSON) : compression topologique, fichier ~10× plus petit, lecture rapide D3/MapLibre.

**Conséquence opérationnelle** :
- V1-1 (B-100/B-101) : intégration MapLibre + PMTiles offline (choix OSM vs IGN à trancher §16 Q3 PRD).
- V1-2 (B-110) : pipeline conversion IGN → TopoJSON simplifié, reproductible via `scripts/build-geo.sh`.
- Licence Etalab 2.0 mentionnée dans `ref/LICENSE.md` et UI « À propos ».
- V0 : utiliser une simplification temporaire (ex. gregoiredavid/france-geojson) en attendant pipeline IGN officiel.
- Taille MSI surveillée (cible < 30 Mo, cf. PRD §9.1).

## Références

- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/)
- [PMTiles](https://protomaps.com/docs/pmtiles)
- [IGN ADMIN EXPRESS](https://geoservices.ign.fr/adminexpress)
- [Licence Etalab 2.0](https://www.etalab.gouv.fr/licence-ouverte-open-licence)
- [PRD.md §6.2](../../PRD.md), [PRD.md §15 ADR-009](../../PRD.md), [PRD.md §16 Q3](../../PRD.md)
- Décisions liées : [ADR-011 Export PDF V1](ADR-011-export-pdf-v1.md)
