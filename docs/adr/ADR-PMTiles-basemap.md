# ADR-PMTiles-basemap — Fond de carte PMTiles offline (§16 Q3)

| Champ | Valeur |
|---|---|
| Statut | **PROPOSITION — À CONFIRMER PAR LE PRODUCT OWNER** |
| Date | 2026-05-31 |
| Source | [PRD.md §9.1](../../PRD.md), [PRD.md §16 Q3](../../PRD.md), [ADR-009](ADR-009-maplibre-ign.md) |
| Auteur | Claude Code (B-101) |
| Décision produit | OUI — impacte taille MSI et expérience visuelle ; hors scope technique seul |

---

## Contexte

ADR-009 a statué sur MapLibre GL JS comme moteur carto V1, en réservant la décision du **fond de carte** à §16 Q3 du PRD : « OSM (PMTiles France ~50 Mo) ou IGN (licence Etalab 2.0) ».

La plomberie PMTiles est désormais implémentée (B-101) :
- protocole `pmtiles://` enregistré auprès de MapLibre (`Protocol` de `pmtiles@4`)
- `addPmtilesBasemap(map, path)` câblé dans `createBaseMap` (déclenché sur `load`)
- option `basemap?: string` dans `BaseMapOptions` — si absent, pas de fond (no-op)

Il reste à trancher : **quel fond embarquer par défaut dans le MSI V1 ?**

---

## Options évaluées

| Option | Taille estimée | Licence | Impact MSI §9.1 (<30 Mo) | Disponibilité offline |
|---|---|---|---|---|
| **A — OSM France via Protomaps** | ~50 Mo | ODbL | **DÉPASSE** — MSI > 30 Mo impossible | Oui (embarqué) |
| **B — IGN Etalab fond France (z0–9)** | ~15–25 Mo | Etalab 2.0 | Possible mais serré ; dépend du niveau max | Oui (embarqué) |
| **C — Fond départemental ultra-léger (z6–12, Île-de-France)** | ~2–5 Mo | OSM/ODbL ou IGN | Compatible §9.1 | Oui (embarqué) |
| **D — Aucun fond (reco V1)** | 0 Mo | — | Compatible §9.1 | ✓ |

### Détail des options

**A — OSM France PMTiles (~50 Mo)**
Source : Protomaps planet découpé France. Fournit un fond cartographique complet (routes, bâtiments, eau, végétation). Incompatible avec la cible MSI < 30 Mo (PRD §9.1). Ne peut être embarqué sans dérogation explicite au §9.1.

**B — IGN Etalab fond France (z0–9)**
Données IGN ADMIN EXPRESS simplifiées + fond OpenStreetMap Etalab (~15–25 Mo selon extraction et niveau de zoom max). Licence Etalab 2.0 (utilisation libre avec mention). Potentiellement compatible §9.1 si extraction restreinte (z0–9), mais fragilise la marge MSI. Nécessite un pipeline de construction dédié (non implémenté en B-101).

**C — Fond départemental ultra-léger**
PMTiles couvrant uniquement l'Île-de-France (ou les 92 CPAM) à z6–z12. Taille < 5 Mo. Compatible §9.1. Scope géographique réduit adapté à l'usage CPAM 92. Nécessite extraction ciblée.

**D — Aucun fond embarqué (recommandation V1)**
La carte affiche uniquement la choroplèthe départementale (TopoJSON IGN, B-110). Le fond est transparent. L'information métier (taux, effectifs, etc.) est portée par les couleurs de la choroplèthe — ce qui est l'essentiel pour les usages CPAM 92. Aucun fond PMTiles n'est embarqué ni requis.

---

## Recommandation technique (à confirmer par le PO)

**Recommandation : Option D — Aucun fond PMTiles embarqué par défaut en V1.**

Justifications :
1. **Contrainte §9.1 dure** : OSM France (~50 Mo) viole le budget MSI < 30 Mo. L'Option A est techniquement exclue sans dérogation §9.1.
2. **Besoin métier CPAM 92** : la choroplèthe départementale avec TopoJSON IGN (B-110, ~200 Ko) suffit pour les cas d'usage UC-1 à UC-4 décrits dans le PRD. Un fond routier ou bâtimentaire n'apporte pas de valeur analytique dans les dashboards métier décrits.
3. **Plomberie prête** : `addPmtilesBasemap` est câblé et fonctionnel. Un fond peut être branché sans modification de code, sur décision produit future ou déploiement spécifique (ex. fond départemental léger pour un usage carto poussé).
4. **Zéro risque de régression MSI** : pas de binaire à committer, pas de dépendance à un pipeline de construction externe.

---

## Décision

> **À CONFIRMER PAR LE PRODUCT OWNER.**

Cette décision est **produit, pas technique** : elle engage le périmètre visuel de l'outil et le budget MSI. Le product owner tranche en connaissance des options ci-dessus.

En l'absence de confirmation, la **valeur par défaut du code est Option D** (aucun fond, `basemap: undefined`).

---

## Conséquences si Option D confirmée

- Aucun fichier PMTiles à sourcer, stocker ou committer.
- Budget MSI préservé.
- La plomberie `pmtiles-source.ts` reste en place pour brancher un fond à la demande.
- Documentation : mentionner dans le guide auteur `.vviz` qu'un fond PMTiles local peut être fourni via `basemap: "./chemin/vers/fond.pmtiles"` dans les options de la vue carte.

## Conséquences si Option B ou C retenue

- Définir un pipeline de construction du fichier PMTiles (script dédié, reproductible).
- Mesurer la taille du MSI résultant et la comparer à §9.1.
- Si Option B : vérifier la licence Etalab 2.0 dans `ref/LICENSE.md`.
- Si dépassement §9.1 : amendement PRD requis avant intégration.

---

## Références

- [PRD.md §9.1 — Cible MSI < 30 Mo](../../PRD.md)
- [PRD.md §16 Q3 — Question ouverte fond carto](../../PRD.md)
- [ADR-009 — MapLibre GL JS + IGN](ADR-009-maplibre-ign.md)
- [ADR-008 — Local-first / zéro réseau](ADR-008-no-network.md)
- [Protomaps PMTiles](https://docs.protomaps.com/pmtiles/)
- [IGN Geoservices](https://geoservices.ign.fr/)
- [Licence Etalab 2.0](https://www.etalab.gouv.fr/licence-ouverte-open-licence)
- Story B-101 : plomberie PMTiles
- Story B-110 : pipeline TopoJSON IGN (dépendance pour la couche choroplèthe)
