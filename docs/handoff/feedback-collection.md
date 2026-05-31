# Handoff — Instrument de collecte terrain VaultViz V1 (B-181)

| Champ | Valeur |
|---|---|
| Story | B-181 |
| Statut | Artefact produit — collecte effective = terrain (pilotes), hors scope produit |
| Auteur produit | A. Bergé (ab@alexandre-berge.fr) |
| Date | 2026-05-31 |
| Dépend de | [docs/handoff/mecm-pilot-package.md](mecm-pilot-package.md) (déploiement pilote effectué) |
| Grille verbatim | [docs/handoff/feedback-grid.md](feedback-grid.md) (réutilisée — ne pas dupliquer) |

---

## Frontière : acte humain attendu (hors scope produit)

> Ce document fournit l'instrument de mesure, les métriques à collecter et le modèle de rapport.
> La collecte effective des données terrain, l'administration de la grille de retour aux pilotes et la consolidation des résultats sont des **actes terrain (pilotes + DSI/sponsor)**, hors scope produit.
>
> **Actes attendus** :
> - **DSI** : collecter les métriques d'installation (logs MECM, taux de succès)
> - **Pilotes** : remplir la grille de retour ([feedback-grid.md](feedback-grid.md)) après usage
> - **Sponsor** : consolider les retours et produire le rapport (modèle §4)
> - **Équipe produit** : analyser les bugs reproductibles et les frictions UX remontés

---

## 1. Métriques à mesurer

### 1.1 Métriques quantitatives (collectées par la DSI via MECM/logs)

| Métrique | Définition | Source | Critère §12.2 associé |
|---|---|---|---|
| **Taux d'installation autonome** | % de postes sur lesquels l'installation MECM s'est terminée avec succès sans intervention manuelle | Logs MECM / rapport d'inventaire | « ≥ 80 % cadres installent sans assistance » |
| **Taux d'ouverture autonome** | % de cadres ayant ouvert au moins un `.vviz` sans contacter le support | Logs `%LOCALAPPDATA%\VaultViz\logs\` + absence d'appel hotline | « ≥ 80 % cadres ouvrent sans assistance » |
| **Durée moyenne d'usage** | Durée moyenne par session d'utilisation de VaultViz | Logs applicatifs locaux (si collecte MECM activée) | « Adoption cadres (R-7) » |
| **Nombre de sessions / cadre** | Nombre moyen d'ouvertures sur la période pilote | Logs applicatifs locaux | Adoption qualitative |
| **Incidents PSSI déclarés** | Nombre et nature des incidents de sécurité remontés | Canal DSI/RSSI | « Aucun incident PSSI bloquant » |
| **Incidents d'installation** | Nombre de postes ayant nécessité une intervention manuelle | Logs MECM | Complément taux autonomie |

> **Note** : VaultViz écrit des logs locaux dans `%LOCALAPPDATA%\VaultViz\logs\YYYY-MM-DD.log`. Ces logs sont accessibles par MECM si la collecte est configurée. Ils ne contiennent aucune PII ([ADR-008](../adr/ADR-008-no-network.md), §8.3 PRD).

### 1.2 Métriques qualitatives (collectées via grille de retour)

Voir **[docs/handoff/feedback-grid.md](feedback-grid.md)** pour l'instrument de collecte qualitative complet.

La grille couvre :
- Évaluation des critères Go/No-Go (UC-1 carte→drill, UC-3 cross-filter, UC-6 erreur lisible, performance perçue, UX sans formation, sécurité PSSI)
- Évaluation transverse (clarté UX persona Camille, crédibilité technique, adéquation métier, risques PSSI perçus)
- Points forts / points faibles / suggestions
- Décision personnelle Go / Go conditionnel / No-Go

---

## 2. Protocole de collecte

### 2.1 Calendrier type

| Étape | Délai (à remplir par le sponsor) | Responsable |
|---|---|---|
| Push MECM effectué | J0 | DSI |
| Email de notification + lien doc user | J0 à J+2 | DSI/sponsor |
| Période d'usage libre | J+2 à J+_N_ | Pilotes |
| Distribution grille de retour | J+_N_ | DSI/sponsor |
| Délai de retour grille | J+_N_ à J+_N+5_ | Pilotes |
| Consolidation des retours | J+_N+5_ à J+_N+7_ | Sponsor |
| Rapport final remis à équipe produit | J+_N+7_ | Sponsor |

> Durée recommandée de la période d'usage : 2 à 3 semaines (suffisant pour une utilisation réelle, pas trop long pour maintenir l'engagement).

### 2.2 Administration de la grille de retour

La grille [feedback-grid.md](feedback-grid.md) peut être :
- Imprimée et distribuée physiquement (1 exemplaire par pilote)
- Convertie en formulaire numérique (Microsoft Forms ou équivalent CPAM 92) — à la discrétion du sponsor
- Remplie lors d'un entretien court (15 min) avec le sponsor ou un tiers de confiance

**Nombre minimum de retours exploitables** : 5 verbatims qualitatifs (critère B-181 BACKLOG).

---

## 3. Mapping métriques → critères §12.2

| Critère §12.2 | Seuil Go | Seuil No-Go | Métrique(s) associée(s) | État à remplir par le terrain |
|---|---|---|---|---|
| ≥ 80 % cadres pilotes installent + ouvrent sans assistance | ≥ 80 % | < 50 % | Taux d'installation autonome + Taux d'ouverture autonome | `À ÉVALUER` |
| Aucun incident PSSI bloquant | 0 incident bloquant | ≥ 1 incident bloquant non résolvable | Incidents PSSI déclarés (canal DSI/RSSI) | `À ÉVALUER` |
| MSI signable accepté par la DSI et déployable via MECM | Accepté | Refus DSI | Résultat déploiement MECM (B-150) | `À ÉVALUER` |
| Export PDF A4 fonctionnel sur tous les types de vues V1 | Fonctionnel | Non générable ou rendu dégradé | Feedback pilotes (grille §2 + verbatim) + test équipe produit | `À ÉVALUER runtime Windows` |
| Performance V1 atteinte sur 90 % des cas testés | ≥ 90 % | < 70 % | Feedback performance perçue (grille) + mesures runtime Windows | `À ÉVALUER runtime Windows` |

> **Note sur les deux derniers critères** : l'export PDF et les performances sur SMB réel CPAM 92 sont vérifiables en partie par l'équipe produit (tests CI Windows) mais **la validation terrain** (postes MECM standards, shares SMB réels) ne peut être faite que par les pilotes.

---

## 4. Modèle de rapport quantitatif + qualitatif

> À compléter par le sponsor après consolidation des retours terrain.
> Ce modèle est un canevas — le sponsor peut l'adapter selon le contexte.

---

### Rapport pilote VaultViz V1 — [Date]

**Panel** : _N_ cadres pilotes / _N_ postes MECM
**Période d'usage** : _du [date] au [date]_
**Consolidé par** : _[Nom / Rôle]_

#### A. Métriques quantitatives

| Métrique | Valeur mesurée | Seuil Go §12.2 | Couleur |
|---|---|---|---|
| Taux d'installation autonome | _____ % | ≥ 80 % | 🔲 |
| Taux d'ouverture autonome | _____ % | ≥ 80 % | 🔲 |
| Durée moyenne de session | _____ min | — (indicatif) | — |
| Incidents PSSI bloquants | _____ | 0 | 🔲 |
| Incidents d'installation MECM | _____ postes sur _____ | 0 (idéal) | 🔲 |
| Grilles de retour reçues | _____ / _____ | ≥ 5 verbatims | 🔲 |

#### B. Résultats critères §12.2

| Critère | Résultat terrain | Go / No-Go / Conditionnel |
|---|---|---|
| ≥ 80 % autonomie installation+ouverture | `À remplir` | `À remplir` |
| Aucun incident PSSI bloquant | `À remplir` | `À remplir` |
| MSI accepté DSI + déployable MECM | `À remplir` | `À remplir` |
| Export PDF A4 fonctionnel (toutes vues) | `À remplir` | `À remplir` |
| Performance V1 ≥ 90 % des cas | `À remplir` | `À remplir` |

#### C. Synthèse qualitative (verbatims)

**Points forts récurrents** :
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

**Frictions UX identifiées** :
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

**Bugs reproductibles remontés** :
1. _______________________________________________
2. _______________________________________________

**Suggestions d'amélioration** :
_______________________________________________

#### D. Recommandation terrain (sponsor)

- [ ] **Go déploiement large** — tous les critères §12.2 atteints
- [ ] **Go conditionnel** — conditions à lever : _______________________________________________
- [ ] **No-Go** — raisons : _______________________________________________

#### E. Pièces jointes

- [ ] Grilles de retour individuelles (anonymisées si nécessaire)
- [ ] Logs MECM d'installation (agrégés)
- [ ] Captures d'écran des bugs signalés
- [ ] Rapport RSSI sur les incidents PSSI (le cas échéant)

---

## 5. Transmission à l'équipe produit

Une fois le rapport consolidé, le sponsor le transmet à :
- **A. Bergé** (ab@alexandre-berge.fr) — équipe produit
- Ce rapport alimente directement le template de décision Go/No-Go V1 : [docs/adr/ADR-V1-GoNoGo-template.md](../adr/ADR-V1-GoNoGo-template.md)

---

## 6. Références

- [docs/handoff/feedback-grid.md](feedback-grid.md) — grille de retour individuelle (verbatims)
- [docs/handoff/mecm-pilot-package.md](mecm-pilot-package.md) — package pilote MECM (B-180)
- [docs/adr/ADR-V1-GoNoGo-template.md](../adr/ADR-V1-GoNoGo-template.md) — décision Go/No-Go V1 (B-190)
- [PRD.md §12.2](../../PRD.md) — critères de succès V1 → déploiement large
- [PRD.md H5](../../PRD.md) — hypothèse adoption cadres
