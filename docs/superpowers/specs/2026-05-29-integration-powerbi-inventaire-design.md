# Spec — Intégration du Power BI « Inventaire » dans VaultViz

| Métadonnée | Valeur |
|---|---|
| Date | 2026-05-29 |
| Statut | Design — pour relecture avant plan |
| Source | Note de reprise du rapport Power BI « Inventaire » (CPAM 92) |
| Branche | `feat/integration-powerbi` (depuis `feat/dashboard-tabs-crossfilter`) |
| Périmètre données | LOCAL gitignoré (`examples/DLI/`) — vraies immobilisations CPAM |

## 1. Objectif

Intégrer **l'intégralité du contenu** du rapport Power BI d'inventaire patrimonial (11 pages) dans le dashboard VaultViz `dli_inventaire.vviz`, de la manière la plus **ergonomique, pertinente et attractive**, **en conservant tout l'existant** (onglets Synthèse / Manquants / Financier, cross-filter, KPI, tables, couleurs déjà livrés).

Approche : **additive**. On étend le `.vviz` (nouveaux onglets/vues), on **refond le pipeline de prep** pour produire les métriques selon les **définitions du Power BI** (note de reprise), et on **fiabilise le rendu courbe** (prérequis de la page Activité).

## 2. Cadre de réconciliation (acquis du reverse-engineering)

- **Même source brute** que le PBI, mais le PBI applique des **règles de périmètre** non entièrement déductibles de nos 2 extractions.
- Reverse-engineering : la une CNAM (20 558 / 75 % / 97 %) **n'est pas reproductible exactement** ; l'écart de valeur scannée (62 % vs 97 %) se concentre sur **ordinateurs portables, logiciels, biens 2025 récents** (probable source IT complémentaire ou règle de périmètre côté PBI).
- **Décision (point 1 utilisateur)** : périmètre de référence = **celui de la note** (comptes CNAM listés, vision CNAM/totalité). Les indicateurs sont calculés sur **nos données disponibles** et **étiquetés « périmètre VaultViz »** tant que le mainteneur n'a pas confirmé les règles (cf. §9 questions ouvertes). On n'affiche **jamais** un « 97 % » non reproductible : on affiche le chiffre réellement calculé, libellé honnêtement.
- **Définitions adoptées** :
  - **Vision CNAM** = comptes `2184, 218333, 2154, 21831, 2155, 2182, 20531, 20532, 21813, 21814` (mobilier/matériel valorisé).
  - **Totalité** = tous enregistrements (y compris valeur nulle).
  - **Taux scanné (nombre)** = scannés ∩ Copernic / Copernic, sur le périmètre considéré.
  - **Taux valorisé** = Σ VALEUR_NETTE des scannés / Σ VALEUR_NETTE.
  - **Hors Copernic** = scannés sans clé Copernic ; **Réformé scanné** = scanné ∩ Copernic avec `DATE_SORTIE`.

## 3. Architecture cible — onglets

On **conserve** les 3 onglets actuels et on en **ajoute** pour couvrir les pages PBI. Deux **paramètres globaux** transverses :
- **Vision** : `CNAM` ⇆ `Totalité` (toggle ; restreint le périmètre comptable).
- **Gestion** : `43 / 58 / 85` (filtre).

| Onglet VaultViz | Pages PBI couvertes | Vues |
|---|---|---|
| **Synthèse** *(existant, recalé)* | 1. Accueil | KPI campagne (taux nb/valeur, Copernic, scannés, bureaux), manquants/bâtiment (émetteur), table synthèse |
| **Activité** *(nouveau)* | 2. Activitée | courbe cumulée scannés + barres scans/mois |
| **Bilan comptable** *(nouveau)* | 3-4. Bilan CNAM / complet | table par compte (8 colonnes : Nb Copernic, Valeur nette, Nb scanné, Taux, Valeur scannée, Manquants, Valeur manquants, Taux valorisé) |
| **Différence Copernic** *(nouveau)* | 5. difference Copernic | KPI (scannés, rapprochés, réformé, hors-Copernic), table hors-Copernic par type, table étiquettes hors-Copernic |
| **Parc** *(nouveau)* | 9. Patrimoine/année | barres par année de réception + table top articles |
| **Sites** *(nouveau)* | 8. Sites | barres appariées taux scanné vs taux valorisé par site |
| **Manquants** *(existant, étendu)* | 10. absent (+6/7 détail) | manquants par article + 2 périmètres (CNAM/totalité) + table détail |
| **Financier** *(existant)* | (transverse valeur) | valeur nette par compte / par bâtiment |
| **Recherche** *(nouveau, gap moteur)* | 7. recherche | multi-slicers (Compte/Type/Site/Gestion) + panneaux « scanné autre site » / « absent » |

Couverture estimée : **~90 %** du PBI. Pages non reproduites à l'identique : *detail site* (couvert par cross-filter bâtiment), *Bilan complet vide* (à clarifier mainteneur).

## 4. Refonte du pipeline de prep (`build_dashboard.py`)

Nouveau périmètre + nouvelles mesures, **un Parquet pré-agrégé par vue** (principe inchangé). Tables à produire :

- `dli_kpi` — 1 ligne (ou 1/vision) : taux nb, taux valorisé, Nb Copernic, Nb scannés, Nb bureaux, valeur nette, valeur scannée. *(KPI exacts via agrégat.)*
- `dli_compte` — par compte (vision CNAM/totalité) : les 8 colonnes du bilan.
- `dli_activite` — par **date** (cumul) et par **mois** (volume) : pour la page Activité. **Inclut `libelle`** (cross-filter).
- `dli_difference` — hors-Copernic par type ; table étiquettes hors-Copernic ; comptage réformé.
- `dli_parc_annee` — par année de réception (Nb) ; table top articles.
- `dli_site` — par site : taux scanné, taux valorisé (page Sites).
- `dli_manquants` — par article × {CNAM, totalité} (2 périmètres).
- Tables existantes (`dli_batiments`, `dli_assets`, `dli_articles`, `dli_comptes`, `dli_detail`, `dli_flux`) **conservées/ajustées** au nouveau périmètre.

Toutes portent `libelle` (clé de cross-filter) + un champ `vision` (CNAM/totalité) si pertinent.

## 5. Gaps moteur & décisions techniques

### 5.1 Courbe fiable (point 2 utilisateur) — **prérequis**
Le chemin `line`/`area` via le coordinator vgplot **rend vide** (non reproductible, non couvert par les exemples canoniques). **Décision** : créer un composant **bespoke `line-chart.ts`** (SVG : axes, polyligne, points, multi-séries par couleur), alimenté par `conn.query` **comme `ranked-bars`/`grouped-bars`** (chemin éprouvé, sous notre contrôle). Le `view-compiler` route `line`/`area` vers ce composant (au lieu de `plot-view`). Cross-filter via `filterField` + `injectWhere` (comme les autres vues bespoke). Tooltip custom (réutilise le mécanisme de `grouped-bars`). `dot` : différé.

### 5.2 Multi-slicers (page Recherche) — extension
Aujourd'hui : une seule sélection émettrice (le bâtiment). La page *recherche* exige **plusieurs slicers simultanés** (Compte + Type + Site + Gestion). **Décision** : extension du DSL — `spec.slicers: [{field, source, label}]` rendus en panneaux de cases à cocher, chacun émettant une clause `interval`/`in` dans une sélection partagée ; le moteur combine les clauses (AND). Panneaux « scanné sur autre site » / « absent » = tables filtrées sur la sélection croisée. **Wave dédiée** (la plus lourde).

### 5.3 Jauge → KPI
Pas de type `gauge`. La jauge « 17 K / 28 K » de l'accueil est rendue en **KPI** avec un pied « sur 28 K » (acceptable). Type `gauge` éventuel en option future.

### 5.4 Toggle Vision CNAM/Totalité & filtre Gestion
Paramètres globaux : soit via `spec.params` + slicers, soit deux jeux de sources préfixés. **Décision** : pré-agréger les deux visions dans les Parquet (colonne `vision`) + un slicer global `vision` (réutilise l'extension §5.2) ; Gestion = idem.

## 6. Découpage en WAVES (pour le plan subagent-driven)

- **Wave 0 — Socle données & définitions** (séquentiel, fondation) : refonte `build_dashboard.py` (périmètres CNAM/totalité, mesures taux/valeur, nouvelles tables §4) ; validation des chiffres vs note (étiquetés). *Bloque tout le reste.*
- **Wave 1 — Courbe bespoke** (§5.1) : composant `line-chart.ts` + route compiler + tests (TDD). *Bloque l'onglet Activité.*
- **Wave 2 — Pages reproductibles** (parallélisable, 1 sous-agent par onglet) : Bilan comptable, Parc, Sites, Différence Copernic, Activité, Manquants 2-périmètres. Chaque sous-agent : Parquet (déjà produits W0) + vues `.vviz` + validation schéma/compile.
- **Wave 3 — Multi-slicers & Recherche** (§5.2, le plus lourd) : extension DSL slicers + moteur + page Recherche + panneaux écart de localisation.
- **Wave 4 — Toggle Vision/Gestion** (§5.4) : paramètres globaux câblés sur toutes les vues.
- **Wave 5 — Intégration & validation** : assemblage `.vviz` final (tous onglets), `npm test`, lancement app + captures, recalage ergonomie.

Adversarial check à chaque wave : chiffres recalculés vs note + cohérence cross-filter + non-régression (`npm test` + exemples canoniques).

## 7. Mapping page-par-page (référence)

| Page PBI | Onglet | Vue(s) VaultViz | Reproductible |
|---|---|---|---|
| 1 Accueil | Synthèse | KPI + manquants/bât + table | ✅ (jauge→KPI) |
| 2 Activitée | Activité | line (cumul) + bar/mois | ✅ après W1 |
| 3-4 Bilan CNAM/complet | Bilan comptable | table 8 col. + toggle vision | ✅ |
| 5 difference Copernic | Différence | KPI + 2 tables | ✅ |
| 6 detail MB15 | (cross-filter) | sélection bâtiment | ✅ |
| 7 recherche | Recherche | multi-slicers + panneaux | ⚠️ W3 |
| 8 Sites | Sites | barres appariées taux | ✅ |
| 9 Patrimoine/année | Parc | bar/année + table | ✅ |
| 10 absent | Manquants | article + 2 périmètres | ✅ |
| 11 detail site | (cross-filter) | — | ⚠️ à confirmer |

## 8. Critères d'acceptation

- Tous les onglets existants **conservés et fonctionnels** (non-régression).
- Chaque page PBI reproductible a son équivalent VaultViz ; chiffres calculés sur nos données, **libellés « périmètre VaultViz »** là où non réconciliés avec le PBI.
- Courbe Activité rend **réellement** des données (composant bespoke).
- Cross-filter cohérent à travers les onglets ; toggle Vision/Gestion opérationnel.
- `.vviz` valide schéma + 100 % des vues compilent ; `npm test` + `cargo test` au vert.
- `examples/DLI/` reste gitignoré (données réelles).

## 9. Questions ouvertes — mainteneur du PBI (bloquantes pour réconciliation exacte)

1. Source de scan couvre-t-elle portables/IT/logiciels/véhicules ? Par quel export ? *(cause du 62 % vs 97 %.)*
2. Règle exacte « vision CNAM » (comptes ET/OU type_articles inclus/exclus).
3. Clé de jointure scan↔Copernic réellement utilisée.
4. Export Copernic consommé = `copernic_actif.xlsx` (réformés inclus) ou pré-filtré ? Fournir l'extraction + date.
5. Calcul exact `Total Valeur Scanne`.
6. Critère « hors Copernic » (1 085) vs « réformé scanné » (503) ; périmètre Copernic 43,23 K.
7. Explication des 4 volumes Copernic (22 K / 24 016 / 20 558 / 43,23 K).
8. Règle de valorisation manquants CNAM (53 K€) vs totalité (279 K€).
9. Pages « Bilan compta complet » (vide) et « detail site » (non capturée).

> En l'absence de réponses, la Wave 0 produit les chiffres **réellement calculables** ; la réconciliation fine est rejouée dès réception.
