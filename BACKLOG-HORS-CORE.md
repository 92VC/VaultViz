# VaultViz — Backlog hors cœur applicatif

| Métadonnée | Valeur |
|---|---|
| Version | 1.0 |
| Date | 2026-05-31 |
| Lien | Ce fichier est le complément de `BACKLOG.md` (cœur applicatif V1 terminé) |

---

## À propos de ce fichier

Ce fichier suit les travaux **hors cœur applicatif VaultViz**, regroupés en deux catégories :

- **(A) Jalons externes** — actes de la DSI, du sponsor ou du terrain (déploiement parc, retours pilotes, décision Go/No-Go). Ces items sont **hors scope produit** au sens d'ADR-005 : VaultViz livre le MSI signable et le dossier de handoff ; la signature, le déploiement MECM et la décision organisationnelle relèvent de la DSI/sponsor.
- **(B) Contenu cas d'usage — DLI/Power BI** — authoring d'UN dashboard précis (immobilisations CPAM 92, épopée V1-7). Ce contenu *consomme* l'application mais n'est pas du développement du moteur VaultViz. Les données réelles (`examples/DLI/`) sont gitignorées.

Le développement du cœur VaultViz (45 stories, toutes terminées) est tracé dans `BACKLOG.md`.

---

## 0. Tableau de bord hors-core

| Catégorie | Stories | À faire `[ ]` | En cours `[~]` | Terminé `[x]` | Bloqué `[!]` |
|---|---|---|---|---|---|
| A. Jalons externes (DSI/terrain) | 4 | 4 | 0 | 0 | 0 |
| B. Contenu cas d'usage DLI/Power BI | 6 | 3 | 0 | 3 | 0 |
| **Total** | **10** | **7** | **0** | **3** | **0** |

---

## A. Jalons externes (DSI / sponsor / terrain)

> Ces stories représentent des actes extérieurs au développement produit : signature de code (DSI), déploiement parc MECM/Intune (DSI), collecte de retours terrain (pilotes cadres), et décision organisationnelle Go/No-Go V1 (Sponsor + DSI + RSSI). VaultViz produit les artefacts de handoff nécessaires ; la suite relève de la DSI/sponsor.
>
> **Artefacts de handoff produits côté projet** : `docs/deploy.md`, `docs/handoff/mecm-pilot-package.md`, `docs/handoff/feedback-collection.md`, `docs/adr/ADR-V1-GoNoGo-template.md`.

### B-150 — [ ] Coordonner avec la DSI la signature production du MSI

- **Itération** : V1-6
- **Livrable** : MSI signé par la DSI, validé, déployable
- **Critères d'acceptation** :
  - [ ] Procédure DSI documentée dans `docs/deploy.md` (côté projet, point de jonction)
  - [ ] MSI signé par la DSI à partir d'un artefact CI propre
  - [ ] Test installation sur poste protégé AppLocker
  - [ ] Cycle d'itération clair : nouvelle version CI → nouveau MSI signé en N jours max
- **Dépendances** : B-220 (design intégré), B-072 (test V0 réussi)
- **PRD** : ADR-005, §16 Q2
- **Complexité** : S (côté dev) ; M (côté DSI, hors scope produit)
- **Blocage potentiel** : `[!]` si refus DSI ou délais incompatibles

### B-180 — [ ] Déploiement MECM/Intune sur 10–20 postes pilotes

- **Itération** : V1-9
- **Livrable** : MSI signé poussé sur un panel de 10 à 20 cadres CPAM 92
- **Critères d'acceptation** :
  - [ ] Push silencieux validé par la DSI
  - [ ] Postes pilotes identifiés (cf. §16 Q5)
  - [ ] Communication aux pilotes : email + 1 page user (B-170)
  - [ ] Hotline / canal de retour identifié
- **Dépendances** : B-150, B-170
- **PRD** : §16 Q5
- **Complexité** : M
- **Blocage potentiel** : `[!]` si direction sponsor non identifiée

### B-181 — [ ] Collecte retours terrain pilotes

- **Itération** : V1-9
- **Livrable** : rapport quantitatif + qualitatif des retours pilotes
- **Critères d'acceptation** :
  - [ ] Métriques : taux d'installation autonome, taux d'ouverture autonome, durée moyenne d'usage
  - [ ] Verbatim qualitatifs : 5 retours minimum
  - [ ] Liste des frictions UX
  - [ ] Liste des bugs reproductibles
  - [ ] Critères §12.2 mesurés (≥ 80 % autonomie ?)
- **Dépendances** : B-180
- **PRD** : §12.2, H5
- **Complexité** : M

### B-190 — [ ] Décision Go/No-Go V1 → déploiement large

- **Itération** : V1-10
- **Livrable** : décision tracée + plan de déploiement (ou plan correctif)
- **Critères d'acceptation** :
  - [ ] Tous les critères §12.2 évalués
  - [ ] Décision motivée signée Sponsor DSI + RSSI
  - [ ] Si Go : plan de push parc large
  - [ ] Si No-Go : itération V1' identifiée
- **Dépendances** : B-181
- **PRD** : §12.2
- **Complexité** : M

---

## B. Contenu cas d'usage — DLI / Power BI

> **Premier vrai test de production.** Reprise intégrale du rapport Power BI « Inventaire » (11 pages, immobilisations CPAM 92) dans un `.vviz` **autoporteur** (`examples/DLI/dli_inventaire_autoporteur.vviz`). C'est le vecteur qui valide en conditions réelles l'**autoporteur** (ADR-003 amendé) et le **moteur hybride** (ADR-002 amendé). Spec de référence : [`docs/superpowers/specs/2026-05-29-integration-powerbi-inventaire-design.md`](docs/superpowers/specs/2026-05-29-integration-powerbi-inventaire-design.md) (Waves W0→W5).
>
> **Découpage app-core vs métier** : les capacités moteur génériques (rendu maison, slicers) sont tracées en **V1-E (B-250/B-251)** dans `BACKLOG.md`. Les stories ci-dessous ne contiennent que de la **consommation** (déclaration dans le `.vviz`) + du **contenu DLI** (données, périmètres, libellés). Aucune logique moteur n'y est ajoutée.
>
> **Périmètre données** : `examples/DLI/` reste **gitignoré** (vraies immobilisations CPAM). Réconciliation fine des chiffres avec le PBI : voir §9 questions ouvertes de la spec — les indicateurs sont **étiquetés « périmètre VaultViz »** tant que le mainteneur n'a pas confirmé les règles ; ce n'est **pas** un blocage (chiffres réellement calculables produits, réconciliation rejouée à réception).

### B-240 — [x] W0 — Socle données & définitions (pipeline de prep)

- **Itération** : V1-7 / W0
- **Livrable** : `examples/DLI/build_dashboard.py` produisant un Parquet pré-agrégé par vue selon les définitions du PBI (vision CNAM/totalité, taux nb/valeur)
- **Critères d'acceptation** :
  - [x] 17 sources pré-agrégées embarquées (`assets`, `bilan_cnam`, `parc_annee`, `sites`, `diff_*`, `activite`, …)
  - [x] Chiffres calculés sur les données disponibles, étiquetés « périmètre VaultViz » là où non réconciliés
- **Dépendances** : B-220
- **PRD** : ADR-003 (autoporteur), §7
- **Complexité** : L

### B-241 — [x] W1 — Onglet Activité DLI (consomme le line-chart générique)

- **Itération** : V1-7 / W1
- **Livrable** : onglet « Activité scan » du `.vviz` DLI (courbe cumulée + barres/mois), déclaré en `type: area`/`line`, **consommant** le composant générique B-250.
- **Critères d'acceptation** :
  - [x] L'onglet rend réellement des données (vgplot rendait vide → composant maison générique B-250)
  - [x] Cross-filter via `filterField` + `injectWhere`
- **Dépendances** : B-250 (composant générique), B-240 (table `activite`)
- **PRD** : spec DLI §5.1
- **Complexité** : S (consommation)
- **Notes** : la *construction* du composant line/area est désormais tracée en app-core (**B-250**) ; ici, seule la déclaration DLI subsiste. `dot` différé.

### B-242 — [x] W2 — Pages reproductibles (onglets)

- **Itération** : V1-7 / W2
- **Livrable** : onglets Bilan comptable, Parc/année, Sites, Différence Copernic, Activité scan, Manquants étendu
- **Critères d'acceptation** :
  - [x] 8 onglets, 29 vues (kpi/barX/bar/table/pie/area) dans le `.vviz` autoporteur
  - [x] `.vviz` valide le schéma ; cross-filter cohérent ; `npm test` au vert (318)
- **Dépendances** : B-241
- **PRD** : §3-9 mapping spec
- **Complexité** : L

### B-243 — [ ] W3 — Page Recherche DLI (consomme les slicers multi)

- **Itération** : V1-7 / W3
- **Livrable** : onglet « Recherche » du `.vviz` DLI (page 7 du PBI) — **déclaration** des slicers Compte / Type / Site / Gestion + panneaux « scanné sur autre site » / « absent ».
- **Critères d'acceptation** :
  - [ ] Les 4 slicers déclarés dans le `.vviz` via `spec.slicers` (mécanisme **B-251**), combinés en AND
  - [ ] Panneaux « autre site » / « absent » = tables filtrées sur la sélection croisée
  - [ ] **Aucune logique moteur ajoutée ici** — pure déclaration + contenu DLI
  - [ ] L'exemple `.vviz` valide le schéma ; `npm test` au vert
- **Dépendances** : B-251 (mécanisme slicers), B-242
- **PRD** : spec DLI §5.2, mapping page 7
- **Complexité** : M
- **Notes** : le **contenu** (champs Compte/Type/Site/Gestion, données) est DLI ; le **mécanisme** est app-core (B-251). Actuellement `slicers: 0` dans le `.vviz`.

### B-244 — [ ] W4 — Toggle Vision/Gestion DLI (consomme le slicer global)

- **Itération** : V1-7 / W4
- **Livrable** : bascule **Vision** `CNAM ⇆ Totalité` + filtre **Gestion** `43 / 58 / 85` du dashboard DLI, déclarés comme **slicer global** (mécanisme B-251).
- **Contexte (métier, pas moteur)** : « Vision CNAM » et « Totalité » sont des **périmètres comptables définis par le rapport PBI source** (liste de comptes, cf. spec §2), **pas** des concepts VaultViz. Le mécanisme de slicer global est générique (B-251) ; seul le **contenu** (colonnes, comptes, valeurs Gestion) est DLI.
- **Critères d'acceptation** :
  - [ ] **Prep (B-240)** : colonnes `vision` (CNAM/totalité) et `gestion` présentes dans les sources concernées ; sinon ajout dans `build_dashboard.py` + régénération de l'autoporteur.
  - [ ] **Déclaration** : un `spec.slicers` `scope:"global"` sur `vision` (toggle) et `gestion` (segment), câblé sur toutes les vues.
  - [ ] **Cohérence** : changer Vision recalcule KPI/tables/graphes de tous les onglets selon le périmètre.
  - [ ] **Honnêteté** : libellés « périmètre VaultViz » maintenus tant que la réconciliation PBI (spec §9) n'est pas confirmée.
  - [ ] `npm test` au vert ; cohérence avec les sélections locales (bâtiment, slicers Recherche).
- **Dépendances** : B-251 (slicer global), B-240 (colonnes `vision`/`gestion`)
- **PRD** : spec DLI §5.4
- **Complexité** : M

### B-245 — [ ] W5 — Intégration finale, recalage ergonomie & validation terrain

- **Itération** : V1-7 / W5
- **Livrable** : assemblage du `.vviz` autoporteur **final** (tous onglets W2 + Recherche W3 + paramètres globaux W4), recalage ergonomique pour approcher la maquette/le PBI, et validation de bout en bout.
- **Critères d'acceptation** :
  - [ ] **Couverture** : ~90 % du PBI reproduit (pages 1-5, 8-10 + Recherche 7) ; les écarts explicitement listés (page 11 « detail site » couverte par cross-filter ; « Bilan complet vide » à clarifier mainteneur) — **aucun chiffre non reproductible affiché** (pas de « 97 % » fictif, cf. spec §2).
  - [ ] **Non-régression** : `npm test` (≥ 318) + `cargo test` au vert ; les exemples canoniques (`controle-gestion.vviz`, …) non régressés.
  - [ ] **Validation visuelle** : lancement de l'app sur l'autoporteur (`VVIZ_DEFAULT=…/dli_inventaire_autoporteur.vviz`), capture de **chaque onglet**, comparaison ergonomique avec le PBI source.
  - [ ] **Reproductibilité** : `build_dashboard.py` + `embed.py` régénèrent l'autoporteur de bout en bout (l'édition manuelle d'un `.vviz` généré n'est pas durable).
  - [ ] `examples/DLI/` reste **gitignoré** (vraies immobilisations CPAM).
- **Dépendances** : B-244
- **PRD** : spec §8 (critères d'acceptation)
- **Complexité** : M
- **Notes** : les 9 questions de réconciliation au mainteneur PBI (spec §9) **ne bloquent pas** la clôture : la wave produit les chiffres réellement calculables, étiquetés « périmètre VaultViz » ; la réconciliation fine est rejouée dès réception des réponses.

---

**Fin du backlog hors-core v1.0.**

Les références croisées vers ces stories depuis `BACKLOG.md` (B-170 dépend de B-150 ; §4.2 H3/H5 ; §4.3 R-7) pointent vers des IDs qui existent dans ce fichier — pas de référence cassée, les IDs sont stables.
