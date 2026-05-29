# SP0 — Refondation documentaire & backlog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Officialiser l'abandon du DSFR au profit du design custom de la maquette, et restructurer le backlog V1 autour des sous-projets SP1→SP4.

**Architecture:** Sous-projet purement documentaire (aucun code applicatif touché). On amende `PRD.md`, on crée `docs/adr/ADR-012-design-system.md`, et on réécrit la section V1 de `BACKLOG.md`. Décision tracée au niveau ADR (CLAUDE.md §8).

**Tech Stack:** Markdown. Vérifications via `grep`. Aucun build, aucun test unitaire (docs-only).

**Spec source :** `docs/superpowers/specs/2026-05-29-integration-design-maquette-design.md` §3 et §5 (SP0).

**Pré-requis :** être sur la branche `feat/design-integration` (déjà créée, spec commité en `14bd298`).

---

## Structure des fichiers

| Fichier | Action | Responsabilité |
|---|---|---|
| `docs/adr/ADR-012-design-system.md` | Créer | Tracer la décision « design custom supersede DSFR/Marianne » (format Nygard) |
| `PRD.md` | Modifier | §4.1 V1 (retirer ligne DSFR) ; §4.1 Hors V0 (retirer mention DSFR) ; §15 (ajouter ligne ADR-012) ; §8 Annexe (diagramme `theme/ # DSFR`) |
| `BACKLOG.md` | Modifier | §0.3 tableau de bord ; §3.5 (retirer B-140/B-141, créer épopée design SP0-SP4) ; dépendances B-150 et B-160 (re-pointer hors B-141) |

---

## Task 1 : Créer l'ADR-012 (design system)

**Files:**
- Create: `docs/adr/ADR-012-design-system.md`

- [ ] **Step 1 : Écrire le fichier ADR-012**

Créer `docs/adr/ADR-012-design-system.md` avec exactement ce contenu :

```markdown
# ADR-012 — Design system custom VaultViz (supersede DSFR/Marianne)

| Champ | Valeur |
|---|---|
| Statut | Accepté |
| Date | 2026-05-29 |
| Source | [PRD.md §4.1 V1](../../PRD.md), [spec intégration maquette](../superpowers/specs/2026-05-29-integration-design-maquette-design.md) |
| Sponsor | Produit (décision utilisateur explicite) |
| Supersede | Exigence « Thème DSFR + typo Marianne » (PRD §4.1 V1 ; ex-stories B-140, B-141) |

## Contexte

Le PRD V1 prévoyait initialement un habillage conforme au **Système de design de l'État (DSFR)** avec la typographie **Marianne**, pour crédibilité institutionnelle (ex-stories B-140, B-141).

En parallèle de la V0, une maquette haute-fidélité (`mockups/VaultViz/`) a défini un **design system custom** : thème sombre/clair, tokens CSS, accent `#0066FF`, polices Inter (UI) + JetBrains Mono (données/chemins). Ce design est jugé supérieur en lisibilité et en densité d'information pour l'usage data-viz desktop visé.

VaultViz est un **outil interne** CPAM 92 (organisme privé chargé d'une mission de service public). Le DSFR n'est **pas** une obligation externe pour cet outil. La décision d'adopter le design custom a été prise explicitement par le porteur produit.

## Décision

Le **design system custom de la maquette** devient la **référence visuelle officielle** de VaultViz, en lieu et place du DSFR/Marianne. Les ex-stories B-140 (palette DSFR) et B-141 (typo Marianne) sont **retirées** et remplacées par l'épopée d'intégration du design (cf. BACKLOG §3.5, SP1→SP4).

## Conséquences

**Justification :**
- Meilleure adéquation au cas d'usage data-viz desktop (densité, thème sombre, hiérarchie typographique).
- Pas d'obligation externe DSFR pour un outil interne CPAM.

**Conséquences opérationnelles :**
- Les polices Inter + JetBrains Mono doivent être **embarquées** en `.woff2` local + `@font-face`, **sans aucun appel CDN** (invariant I-2 « zéro appel sortant »). La maquette importe actuellement les polices via Google Fonts — interdit en production.
- **RGAA AA reste dû** (stories B-160/B-161 inchangées) : l'audit d'accessibilité s'applique désormais au design custom (contrastes des tokens dark/light à vérifier).
- La persistance des préférences (thème, densité) se fait en `%LOCALAPPDATA%\VaultViz\` uniquement (invariant I-3).

## Références

- [Spec d'intégration de la maquette](../superpowers/specs/2026-05-29-integration-design-maquette-design.md)
- Maquette : `mockups/VaultViz/`
- Décisions liées : [ADR-002 Mosaic](ADR-002-mosaic-vgplot.md), [ADR-008 No network](ADR-008-no-network.md)
- [PRD.md §4.1 V1](../../PRD.md), [PRD.md §15 ADR-012](../../PRD.md)
```

- [ ] **Step 2 : Vérifier la création**

Run: `test -f docs/adr/ADR-012-design-system.md && grep -c "supersede" docs/adr/ADR-012-design-system.md`
Expected: affiche `2` (titre + champ Supersede), fichier présent.

- [ ] **Step 3 : Commit**

```bash
git add docs/adr/ADR-012-design-system.md
git commit -m "docs(adr): ADR-012 design system custom supersede DSFR/Marianne

Refs: design-integration"
```

---

## Task 2 : Amender PRD.md §4.1 (retirer DSFR du périmètre)

**Files:**
- Modify: `PRD.md:140` (ligne « Hors V0 ») et `PRD.md:161` (ligne table V1)

- [ ] **Step 1 : Retirer la mention DSFR de la ligne « Hors V0 »**

Dans `PRD.md`, remplacer la ligne 140 :

```
| **Hors V0** : MapLibre, watcher, export PDF, déploiement MECM, thème DSFR | ❌ |
```

par :

```
| **Hors V0** : MapLibre, watcher, export PDF, déploiement MECM, design system custom | ❌ |
```

- [ ] **Step 2 : Remplacer la ligne DSFR du tableau V1**

Dans `PRD.md`, remplacer la ligne 161 :

```
| Thème DSFR appliqué (palette, typographie Marianne) — crédibilité publique | ✅ |
```

par :

```
| Design system custom appliqué (thème sombre/clair, tokens, polices Inter + JetBrains Mono embarquées) — cf. [ADR-012](docs/adr/ADR-012-design-system.md) | ✅ |
```

- [ ] **Step 3 : Vérifier qu'il ne reste plus d'exigence DSFR comme cible visuelle**

Run: `grep -n -i "dsfr\|marianne" PRD.md`
Expected : il reste UNIQUEMENT des occurrences historiques/contextuelles (glossaire §79, R-4 §603, références §743, diagramme §839 à traiter en Task 3). AUCUNE ligne ne doit présenter le DSFR comme exigence V1 active.

---

## Task 3 : Amender PRD.md §15 (ajouter ADR-012) + diagramme annexe

**Files:**
- Modify: `PRD.md:671` (table ADRs §15) et `PRD.md:839` (diagramme arborescence)

- [ ] **Step 1 : Ajouter la ligne ADR-012 au récapitulatif §15**

Dans `PRD.md`, juste après la ligne 671 (ADR-011), insérer :

```
| ADR-012 | **Design system custom** (sombre/clair, tokens, polices embarquées) supersede DSFR/Marianne | [ADR-012](docs/adr/ADR-012-design-system.md) | Maquette `mockups/VaultViz/` |
```

- [ ] **Step 2 : Corriger le commentaire DSFR dans le diagramme d'arborescence**

Dans `PRD.md` (~ligne 839), remplacer :

```
│   ├── theme/                  # DSFR
```

par :

```
│   ├── theme/                  # design system custom (tokens, thèmes)
```

- [ ] **Step 3 : Vérifier**

Run: `grep -n "ADR-012" PRD.md`
Expected : au moins une occurrence dans §15 (table) + celles ajoutées en Task 2.

- [ ] **Step 4 : Commit (PRD)**

```bash
git add PRD.md
git commit -m "docs(prd): retirer l'exigence DSFR, référencer ADR-012 (design custom)

Refs: design-integration"
```

---

## Task 4 : Réécrire BACKLOG §3.5 (retirer B-140/B-141, créer l'épopée design)

**Files:**
- Modify: `BACKLOG.md:592-618` (section `### 3.5 V1-5 — Thème DSFR` incluant B-140 et B-141)

- [ ] **Step 1 : Remplacer toute la sous-section §3.5**

Dans `BACKLOG.md`, remplacer le bloc allant de la ligne `### 3.5 V1-5 — Thème DSFR` jusqu'à la fin de la story B-141 (juste avant `### 3.6 V1-6 — Signature DSI`) par exactement :

```markdown
### 3.5 V1-5 — Intégration du design (épopée maquette)

> Remplace l'ex-itération « Thème DSFR ». Le DSFR est abandonné au profit du design custom de la maquette (`mockups/VaultViz/`) — cf. [ADR-012](docs/adr/ADR-012-design-system.md) et la [spec d'intégration](docs/superpowers/specs/2026-05-29-integration-design-maquette-design.md). Chaque épopée SP1→SP4 fait l'objet de son propre cycle spec → plan → implémentation. **Stories B-140 et B-141 retirées** (tombstones ci-dessous pour traçabilité).

- **B-140 — [retiré]** ~~Setup palette + composants DSFR~~ → remplacé par B-200/B-201/B-202 (ADR-012).
- **B-141 — [retiré]** ~~Typo Marianne embarquée~~ → remplacé par B-201 (polices Inter + JetBrains Mono embarquées).

### B-199 — [~] SP0 — Refondation documentaire & backlog

- **Itération** : V1-5 / SP0
- **Livrable** : PRD amendé (DSFR retiré), ADR-012 créé, backlog V1 restructuré autour de SP1→SP4
- **Critères d'acceptation** :
  - [ ] ADR-012 présent et accepté
  - [ ] PRD §4.1 V1 et §15 amendés (plus d'exigence DSFR active ; ADR-012 référencé)
  - [ ] B-140/B-141 retirés (tombstones) ; dépendances re-pointées
  - [ ] Tableau de bord §0.3 cohérent
- **Dépendances** : aucune
- **PRD** : §4.1, §15 ; ADR-012
- **Complexité** : S

### B-200 — [ ] SP1 — Design system (tokens + polices + icônes + CSS base)

- **Itération** : V1-5 / SP1
- **Livrable** : design tokens (dark/light), polices Inter + JetBrains Mono **embarquées** (.woff2 + @font-face), jeu d'icônes SVG, CSS de base des composants
- **Critères d'acceptation** :
  - [ ] Tokens CSS portés (`:root`, `[data-theme="dark"]`, `[data-theme="light"]`, densité, accent)
  - [ ] **Zéro appel réseau** pour les polices (invariant I-2) — vérifié par grep anti-URL
  - [ ] Toggle de thème persistant en `%LOCALAPPDATA%` (I-3)
  - [ ] Tests existants (`npm test`, `cargo test`) toujours au vert
- **Dépendances** : B-199
- **PRD** : §4.1 V1 ; ADR-012, ADR-008 (I-2)
- **Complexité** : L (épopée — spec dédiée)
- **Notes** : la maquette importe les polices via Google Fonts CDN — interdit ; embarquer en local.

### B-210 — [ ] SP2 — App shell

- **Itération** : V1-5 / SP2
- **Livrable** : titlebar custom (contrôles fenêtre Tauri), toolbar (path/statut/actions), home (hero/dropzone/récents persistés), glisser-déposer, loader à étapes, dialog natif thémé, bandeau d'erreur câblé sur erreurs typées
- **Critères d'acceptation** :
  - [ ] Home remplace `welcome.ts` ; récents persistés app-local (I-3)
  - [ ] Ouverture par double-clic, dialog ET glisser-déposer
  - [ ] Bandeau d'erreur alimenté par `ErrorPayload` + détails Ajv existants
  - [ ] Tests existants toujours au vert
- **Dépendances** : B-200
- **PRD** : §4.1 V1, UC-2 ; ADR-012
- **Complexité** : L (épopée — spec dédiée)

### B-220 — [ ] SP3 — Dashboard spec-driven

- **Itération** : V1-5 / SP3
- **Livrable** : extensions `schema/vviz-v1.json` + `view-compiler` pour KPI-avec-delta, carte+sélecteur de métrique, barres classées, barres appariées, table+recherche+badges, chip de filtre ; exemple canonique `examples/controle-gestion.vviz` + Parquet
- **Critères d'acceptation** :
  - [ ] Chaque composant de la maquette exprimable en `.vviz` (générique, pas hardcodé)
  - [ ] Push-down DuckDB + cross-filter Mosaic préservés
  - [ ] L'exemple canonique rendu par le moteur ≈ `mockups/VaultViz/VaultViz.html`
  - [ ] Tests existants + nouveaux tests de compilation au vert
- **Dépendances** : B-200, B-210
- **PRD** : §5.3, UC-1, UC-3 ; ADR-002, ADR-012
- **Complexité** : L (épopée — spec dédiée, potentiellement re-découpée)

### B-230 — [ ] SP4 — Onglets multi-documents

- **Itération** : V1-5 / SP4
- **Livrable** : architecture multi-documents (namespacing connexion DuckDB Rust + état d'onglets front)
- **Critères d'acceptation** :
  - [ ] Plusieurs `.vviz` ouverts simultanément, isolés
  - [ ] Pas de fuite de vues/données entre onglets
  - [ ] Tests existants toujours au vert
- **Dépendances** : B-220
- **PRD** : §4.1 (hors V1 « multi » à réévaluer) ; ADR-012
- **Complexité** : L (épopée — brainstorm + spec dédiés)
- **Notes** : la maquette note les onglets « V2 » ; séquencés en dernier.
```

- [ ] **Step 2 : Vérifier la suppression des stories DSFR actives et la présence des nouvelles**

Run: `grep -n "B-140 — \[ \]\|B-141 — \[ \]\|B-199\|B-200\|B-210\|B-220\|B-230" BACKLOG.md`
Expected : AUCUN `B-140 — [ ]` ni `B-141 — [ ]` (seulement les tombstones `[retiré]`) ; B-199, B-200, B-210, B-220, B-230 présents.

---

## Task 5 : Re-pointer les dépendances orphelines + mettre à jour le tableau de bord

**Files:**
- Modify: `BACKLOG.md:631` (B-150 dépend de B-141), `BACKLOG.md:647` (B-160 dépend de B-141), `BACKLOG.md:49` + `BACKLOG.md:55` (tableau de bord §0.3)

- [ ] **Step 1 : Re-pointer la dépendance de B-150**

Dans `BACKLOG.md` (~ligne 631), remplacer :

```
- **Dépendances** : B-141, B-072 (test V0 réussi)
```

par :

```
- **Dépendances** : B-220 (design intégré), B-072 (test V0 réussi)
```

- [ ] **Step 2 : Re-pointer la dépendance de B-160**

Dans `BACKLOG.md` (~ligne 647), remplacer la ligne de dépendance de la story B-160 :

```
- **Dépendances** : B-141
```

par :

```
- **Dépendances** : B-220 (design intégré)
```

- [ ] **Step 3 : Mettre à jour la ligne V1-5 du tableau de bord §0.3**

Dans `BACKLOG.md` (ligne 49), remplacer :

```
| V1 — V1-5 DSFR | 2 | 2 | 0 | 0 | 0 |
```

par ces deux lignes :

```
| V1 — V1-5 Design SP0 (refondation) | 1 | 0 | 1 | 0 | 0 |
| V1 — V1-5 Design SP1–SP4 (épopées) | 4 | 4 | 0 | 0 | 0 |
```

- [ ] **Step 4 : Mettre à jour la ligne Total du tableau de bord §0.3**

Dans `BACKLOG.md` (ligne 55), remplacer :

```
| **Total** | **46** | **20** | **0** | **23** | **3** |
```

par :

```
| **Total** | **49** | **22** | **1** | **23** | **3** |
```

> Calcul : 46 − 2 (B-140/B-141 retirés) + 5 (B-199 `[~]` + B-200/210/220/230 `[ ]`) = 49. À faire : 20 − 2 + 4 = 22. En cours : 0 + 1 (B-199) = 1. Terminé : 23. Bloqué : 3. Contrôle : 22 + 1 + 23 + 3 = 49 ✓.

- [ ] **Step 5 : Vérifier la cohérence du tableau de bord**

Run: `grep -n "Total\|V1-5" BACKLOG.md | head`
Expected : ligne Total = 49 / 22 / 1 / 23 / 3 ; deux lignes V1-5 Design présentes ; plus de ligne « V1-5 DSFR ».

- [ ] **Step 6 : Vérification globale — aucune référence cassée à B-140/B-141 comme dépendance**

Run: `grep -n "Dépendances.*B-14[01]" BACKLOG.md`
Expected : AUCUN résultat (toutes les dépendances vers B-140/B-141 ont été re-pointées).

---

## Task 6 : Clôturer SP0 et commiter

**Files:**
- Modify: `BACKLOG.md` (B-199 `[~]` → `[x]` et tableau de bord)

- [ ] **Step 1 : Passer B-199 à terminé**

Dans `BACKLOG.md`, remplacer `### B-199 — [~] SP0` par `### B-199 — [x] SP0`.

- [ ] **Step 2 : Mettre à jour le tableau de bord (SP0 terminé)**

Dans `BACKLOG.md` §0.3, remplacer :

```
| V1 — V1-5 Design SP0 (refondation) | 1 | 0 | 1 | 0 | 0 |
```

par :

```
| V1 — V1-5 Design SP0 (refondation) | 1 | 0 | 0 | 1 | 0 |
```

et la ligne Total :

```
| **Total** | **49** | **22** | **1** | **23** | **3** |
```

par :

```
| **Total** | **49** | **22** | **0** | **24** | **3** |
```

> SP0 passe de « en cours » à « terminé » : En cours 1→0, Terminé 23→24. Contrôle : 22 + 0 + 24 + 3 = 49 ✓.

- [ ] **Step 3 : Vérifier l'état final**

Run: `grep -n "B-199 — \[x\]\|Total.*49.*22.*0.*24.*3" BACKLOG.md`
Expected : B-199 terminé ; ligne Total = 49 / 22 / 0 / 24 / 3.

- [ ] **Step 4 : Commit (backlog)**

```bash
git add BACKLOG.md
git commit -m "docs(backlog): retirer DSFR (B-140/141), créer épopée design SP0-SP4

SP0 terminé. B-200 (design system), B-210 (shell), B-220 (dashboard
spec-driven), B-230 (onglets) créés ; dépendances B-150/B-160 re-pointées.

Refs: design-integration"
```

---

## Self-Review (effectué)

**Couverture spec §5 SP0 :**
- Amender PRD §4.1 V1 → Task 2 ✓
- Créer ADR-012 → Task 1 ✓
- Réécrire BACKLOG V1 (retirer B-140/141, restructurer SP1→SP4) → Task 4 ✓
- Conserver/réordonner stories non-design (re-pointer B-150/B-160) → Task 5 ✓
- Mettre à jour tableau de bord §0.3 → Task 5 + Task 6 ✓
- Ajouter ADR-012 au §15 → Task 3 ✓

**Placeholders :** aucun — tout le markdown à coller est fourni intégralement.

**Cohérence des compteurs :** les calculs du tableau de bord sont contrôlés à chaque étape (49 / 22 / x / x / 3).

**Cohérence des IDs :** B-140/B-141 deviennent des tombstones ; B-199 (SP0), B-200 (SP1), B-210 (SP2), B-220 (SP3), B-230 (SP4) ; dépendances B-150 et B-160 re-pointées vers B-220. Les IDs SP1→SP4 référencés dans les tombstones (B-200/201/202) seront détaillés dans le spec de SP1.
```
