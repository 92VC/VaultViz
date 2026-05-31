# ADR-002 — Mosaic + vgplot comme moteur de rendu V1

| Champ | Valeur |
|---|---|
| Statut | **Amendé 2026-05-30 — moteur HYBRIDE** (push-down DuckDB invariant ; rendu vgplot + maison) |
| Date | 2026-05-28 (amendé 2026-05-30) |
| Source | [PRD.md §6.3](../../PRD.md#63-décisions-architecturales-clés-adrs-synthétisés) |
| Sponsor | DSI CPAM 92 + Data analyst lead |

## Contexte

Le moteur de visualisation doit (1) être déclaratif (spec JSON portable, versionnable Git), (2) coordonner nativement plusieurs vues (cross-filter, drill-down), (3) pousser les calculs dans DuckDB (push-down SQL — aligné avec ADR-001), (4) supporter des volumes de l'ordre de plusieurs centaines de Mo de Parquet.

Trois familles d'alternatives ont été évaluées : **Mosaic + vgplot** (UW IDL, IEEE VIS 2024), **Vega-Lite + VegaFusion** (serveur Rust), **Observable Plot** (très flexible mais coordonné manuellement).

## Décision

Moteur de rendu = **Mosaic** (UW IDL) + grammaire haut-niveau **vgplot**.

> **Amendement 2026-05-30 — principe retenu : moteur HYBRIDE.** Voir la section [« Principe retenu »](#principe-retenu--moteur-hybride-amendement-2026-05-30) en fin d'ADR. La décision d'origine (« tout Mosaic, repli Vega-Lite ») est conservée pour traçabilité mais **superséée** par le moteur hybride : push-down DuckDB invariant, rendu libre (vgplot là où il sert, rendu maison ailleurs).

## Conséquences

**Justification** :
- Architecture conçue dès l'origine pour DuckDB : les transformations (agrégations, binning, filtres) sont compilées en SQL et **poussées dans DuckDB**, pas exécutées côté JS. Aligné par construction avec ADR-001 (DuckDB natif).
- Cross-filter et coordination de vues sont des **primitives natives** (sélections partagées entre vues via un coordonnateur unique) — pas un assemblage de patterns à coder.
- Performance par ordre de grandeur supérieure à Vega-Lite sur les volumes cibles (papier IEEE VIS 2024 : *« Mosaic outperforms Vega, VegaFusion, and Observable Plot, typically by one or more orders of magnitude »*).
- Grammaire vgplot inspirée de Vega-Lite / ggplot / Observable Plot — courbe d'apprentissage modérée pour un auteur familier de ces outils.

**Caveat documenté** : les mainteneurs Mosaic signalent dans leur README que la lib n'est pas formellement « production-ready » à la date de rédaction (API encore mouvante). Mitigation :
- **Verrouiller la version** au démarrage du POC dans le lockfile et ne pas suivre `main`.
- Maintenir une **fine couche d'abstraction `viz-engine`** côté front pour isoler les appels Mosaic et permettre un repli sur Vega-Lite uniquement si Mosaic se révèle bloquant en POC (escalade I2 du V0).
- Re-tester à chaque mise à jour Mosaic en CI.

**Conséquence opérationnelle** :
- Le champ `engine` du `.vviz` vaut `"mosaic"` par défaut.
- Format de spec = vgplot (à confirmer en POC : JSON pur ou DSL à transformer en JSON via préprocesseur côté Rust, cf. §16 Q7).
- Versions Mosaic verrouillées en début de POC.
- Couche `src/viz-engine/` isole Mosaic du reste du front (compileur DSL→vgplot).

**Risque résiduel R-8** : si Mosaic se révèle bloquant en POC, repli sur Vega-Lite via le même DSL `.vviz`.

## Format spec — décision §16 Q7 (tranchée en B-033b)

**Décision** : la clé `spec` d'un `.vviz` est un **DSL VaultViz prétraité**,
pas du vgplot JSON brut. Le DSL est compilé en directives vgplot par
`src/viz-engine/` côté front (compileur TS).

**Justification** :

1. **Stabilité contractuelle face à R-8.** L'API vgplot bouge encore.
   En reposer le contrat publisher / consommateur sur un DSL stable
   contrôlé par VaultViz isole les `.vviz` d'auteurs des évolutions
   internes du moteur. Si on doit basculer sur Vega-Lite (repli R-8),
   on change uniquement le compileur — pas les `.vviz` du parc.

2. **Validation stricte possible.** Un DSL fermé (enum de `type`,
   `additionalProperties: false` sur les nœuds racines) permet une
   validation JSON Schema dure dès l'ouverture du fichier. Un JSON
   vgplot brut est par construction ouvert (toutes les options Plot.js
   acceptées) et donc difficile à sécuriser ou à signaler en erreur
   utilisateur claire.

3. **Surface d'attaque réduite.** Moins de portes = moins de risque
   d'injection JS / DOM dans le pipeline (cf. PRD §8 sécurité).
   `script`, `function`, `expression` dynamiques sont hors-DSL.

4. **Compatibilité avec un futur éditeur.** L'auteur écrit un DSL
   intelligible par revue Git (B-064) plutôt qu'un JSON vgplot
   verbeux ; un éditeur graphique (hors V0) peut produire du DSL
   sans devoir comprendre la grammaire vgplot.

**Conséquences** :

- `spec.engine` est un enum (V0 : `"mosaic"` uniquement). Repli
  `"vega-lite"` ajouté si R-8 se concrétise — même DSL, compileur
  alternatif.
- `spec.views` est un tableau de vues typées (`map_choropleth`, `bar`,
  `line`, `area`, `dot`, `table`, `kpi`, …) — voir `schema/vviz-v1.json`.
- Le compileur DSL → vgplot vit dans `src/viz-engine/` (déjà préparé en
  B-031). Sa V0 ne couvre que ce qui est démontré en Wave 3+ ;
  l'extension du DSL est versionnée par bumps mineurs de
  `vviz.version` après V1.

## Principe retenu — moteur hybride (amendement 2026-05-30)

À l'usage (Wave 3+, intégration design, cas DLI), la grammaire vgplot pure
s'est révélée **insuffisante ou de qualité moindre** sur plusieurs vues :
carte choroplèthe, camembert, courbes (line/area), KPI, barres classées et
appariées. Plutôt que de dégrader la qualité de visualisation pour rester
« 100 % Mosaic », ou de basculer entièrement sur Vega-Lite (repli R-8),
le projet retient un **moteur hybride**.

**Invariant unique (non négociable)** : **tout calcul est poussé dans DuckDB
natif** (push-down SQL). Aucune agrégation/filtre/binning n'est exécuté côté
JS. ADR-001 et ADR-003 restent strictement préservés. C'est ce qui définit
H4, pas la part de JS de rendu.

**Rendu libre** : le `type` d'une vue choisit son rendu :

| Rendu | Vues | Module |
|---|---|---|
| **vgplot / Mosaic** | `bar`, `plot` | `components/bar-chart.ts`, `components/plot-view.ts`, `viz-engine/mosaic-runtime.ts` |
| **maison (SVG d3-geo)** | `map_choropleth` | `components/map-view.ts` |
| **maison (DOM/SVG TS)** | `pie`, `line`, `area`, `dot`, `kpi`, barres classées/appariées, `table` | `components/{pie,line,…}-chart.ts`, `table-view.ts` |

Tous les rendus — y compris « maison » — obtiennent leurs données via
`fetchKV`/`fetchKV2` (SQL exécuté par DuckDB natif), donc le push-down est
identique quel que soit le moteur de dessin.

**Coordination cross-vues** : assurée par `src/viz-engine/view-mounter.ts`
(sélections VaultViz : `subscribeCrossFilter`, `createPointEmitter`,
`injectWhere`), **pas exclusivement** par le coordinateur Mosaic. Le
cross-filter par clic sur barre/secteur/département reste sub-seconde grâce
au push-down.

**Conséquences** :
- Le **volume de JS de rendu n'est plus un critère** (l'ancien No-Go
  « > 50 lignes JS métier » est retiré — cf. PRD §12.1 amendé). Le seul
  critère No-Go côté moteur est : *push-down DuckDB non préservé*.
- Le DSL `.vviz` reste stable : enrichir la liste des `type` de vues
  n'invalide pas les `.vviz` existants. `engine` reste `"mosaic"` (label
  historique ; le moteur réel est hybride).
- Vega-Lite (R-8) reste une option de repli **théorique**, non activée :
  le besoin de qualité est désormais couvert par le rendu maison.

## Références

- [Mosaic (UW IDL)](https://idl.uw.edu/mosaic/)
- [Mosaic GitHub](https://github.com/uwdata/mosaic)
- [Heer & Moritz (2024) — Mosaic IEEE TVCG](https://idl.cs.washington.edu/files/2024-Mosaic-TVCG.pdf)
- [PRD.md §6.3 ADR-002](../../PRD.md), [PRD.md §13 R-8](../../PRD.md)
- Décisions liées : [ADR-001 DuckDB natif](ADR-001-duckdb-natif.md), [ADR-003 Parquet + Arrow](ADR-003-parquet-arrow.md)
