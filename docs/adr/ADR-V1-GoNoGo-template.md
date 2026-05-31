# ADR-V1-GoNoGo — Template décision Go/No-Go V1 → déploiement large (B-190)

| Champ | Valeur |
|---|---|
| Statut | **Brouillon** (technique pré-rempli ; critères terrain = À ÉVALUER ; Sponsor à décider) |
| Date prévue | _à compléter après rapport pilote B-181_ |
| Sponsors | DSI CPAM 92, Sponsor métier (collège cadres), RSSI |
| Auteur produit | A. Bergé |
| Document source | [PRD.md §12.2](../../PRD.md) |

---

## Frontière : décision finale hors scope produit

> L'équipe produit pré-remplit les critères mesurables côté technique.
> **La décision finale Go/No-Go est une responsabilité exclusive du Sponsor DSI, du Sponsor métier et du RSSI** — conformément à [ADR-005](ADR-005-signature-dsi.md) et [PRD §12.2](../../PRD.md).
> Les critères marqués `À ÉVALUER` ne peuvent être renseignés qu'après le pilote terrain (B-181).

---

## Contexte

À l'issue des stories V1-1 à V1-9 (V1 complète + pilote MECM 10-20 cadres), évaluer si :
- les livrables V1 répondent aux 5 critères de succès §12.2 du PRD ;
- le pilote terrain confirme l'adoption et l'absence d'incidents PSSI bloquants ;
- la chaîne MSI signé + MECM est validée en conditions réelles CPAM 92 ;
- la décision de déploiement sur l'ensemble du parc cadres peut être prise.

Cette décision conditionne le **déploiement large VaultViz sur le parc CPAM 92**.

---

## Évaluation technique V1 (état au 2026-05-31 — pré-rempli par l'équipe produit)

### Livrables V1 terminés (côté code)

| Story | Livrable | Statut |
|---|---|---|
| B-100 | MapLibre GL JS intégré + zoom/pan | [x] |
| B-101 | PMTiles fond de carte embarqué offline | [x] |
| B-110 | Pipeline IGN ADMIN EXPRESS → TopoJSON simplifié | [x] |
| B-111 | Drill carto MapLibre + TopoJSON (clic département → drill) | [x] |
| B-120 | Watcher FS sur le share (plugin-fs-watch) | [x] |
| B-121 | Bannière refresh non intrusive | [x] |
| B-130 | Stratégie export PDF décidée (ADR-PDF) | [x] |
| B-131 | Export PDF A4 (exigence UC-4, ADR-011) | [x] |
| B-132 | Exports PNG (presse-papier + fichier) + CSV | [x] |
| B-170 | Doc utilisateur 1 page | [x] |
| B-171 | Doc auteur de spec 5 pages | [x] |
| B-172 | Schéma JSON `.vviz` publié | [x] |
| B-220 | SP3 — Dashboard spec-driven (design custom ADR-012) | [x] |
| B-230 | SP4 — Onglets multi-documents | [x] |

**Tests automatisés** : 442 tests passants (49 fichiers de test, vitest run 2026-05-31, branche `feat/v1-execution-complete`).

### Critères §12.2 PRD — pré-évaluation par l'équipe produit

Légende : 🟢 = Go, 🟧 = Go conditionnel / à valider, 🔴 = No-Go, 🔲 = À ÉVALUER (dépend du terrain)

| Critère §12.2 | Cible Go | Seuil No-Go | Évaluation technique V1 | Évaluation terrain | Couleur |
|---|---|---|---|---|---|
| **≥ 80 % cadres pilotes installent + ouvrent sans assistance** | ≥ 80 % | < 50 % | Doc utilisateur livré (B-170), install MECM silencieuse documentée (B-180), double-clic `.vviz` fonctionnel | `À ÉVALUER` — dépend du pilote B-181 | 🔲 |
| **Aucun incident PSSI bloquant** | 0 bloquant | ≥ 1 non résolvable | Aucun port ouvert, aucun appel sortant, lecture seule (ADR-008), capabilities Tauri restreintes, logs sans PII ; SBOM Rust + npm joints à la release | `À ÉVALUER` — dépend retour RSSI + pilote | 🟧 (_en attente RSSI_) |
| **MSI signable accepté par la DSI et déployable via MECM** | Accepté | Refus DSI | MSI signable produit par CI (`release.yml`), dernière release `v0.0.1-rc8`, handoff DSI prêt (B-150 / `docs/deploy.md`) | `À ÉVALUER` — dépend retour DSI B-150 | 🟧 (_en attente DSI_) |
| **Export PDF A4 fonctionnel sur tous les types de vues V1** | Fonctionnel | Non générable ou rendu dégradé | Export PDF A4 livré (B-131, ADR-011) ; PNG + CSV livrés (B-132) ; tests CI passants (442 verts) | `À ÉVALUER` — rendu MapLibre WebGL sur Windows runtime réel à valider (R-5) | 🟧 (_validation runtime Windows_) |
| **Performance V1 atteinte sur 90 % des cas testés** | ≥ 90 % | < 70 % | Bench V0 (Linux NVMe) : COUNT 50 Mo = 7,9 ms (× 380 marge), COUNT 300 Mo = 7,5 ms (× 1067 marge), RAM = 331 Mo (cible < 800 Mo) ; push-down DuckDB préservé | `À ÉVALUER` — bench SMB CPAM 92 réel sur postes Windows 11 standards à reproduire | 🟧 (_validation runtime Windows + SMB_) |

### Critères techniques mesurables aujourd'hui (côté équipe produit)

Ces critères sont verts côté code et ne dépendent pas du terrain :

| Critère | Mesure | Statut |
|---|---|---|
| 442 tests automatisés verts | `npx vitest run` 2026-05-31 : 49 fichiers, 442 tests, 0 erreur | 🟢 |
| Export PDF A4 implémenté | B-131 livré, UC-4 couvert | 🟢 |
| Carte MapLibre + drill carto livré | B-100/B-101/B-110/B-111 livrés | 🟢 |
| Watcher FS + bannière refresh livré | B-120/B-121 livrés | 🟢 |
| Exports PNG + CSV livrés | B-132 livré | 🟢 |
| Doc utilisateur livrée | B-170 livré (`docs/user/user.md`) | 🟢 |
| MSI signable produit par CI | `release.yml`, tag `v0.0.1-rc8` | 🟢 |
| Aucun port réseau, aucun appel sortant | ADR-008, capabilities Tauri | 🟢 |

### Critères à évaluer runtime Windows / terrain (ne peuvent pas être pré-cochés)

| Critère | Pourquoi non mesurable aujourd'hui |
|---|---|
| Rendu PDF correct sur vues MapLibre WebGL | Requiert runtime WebView2 Windows réel + GPU + export canvas (risque R-5) |
| Performance sur share SMB CPAM 92 | Bench disponible sur NVMe Linux — delta SMB3 LAN à mesurer sur poste Windows pilote |
| Taux d'installation + ouverture autonome | Dépend de l'expérience utilisateur réelle sur parc MECM |
| Incidents PSSI | Dépend de l'avis RSSI et du pilote terrain |
| Acceptation MSI signé par la DSI | Dépend de la procédure de signature interne CPAM 92 (B-150) |

---

## Pré-évaluation technique (à confirmer par sponsor après pilote)

Sur les **8 critères techniques mesurables** côté équipe produit :

- **8 🟢** (tests, exports, carto, watcher, doc, MSI, réseau, PDF implémenté)
- **0 🔴**

**3 critères §12.2 restent 🟧 en attente de données terrain** :
1. Retour DSI sur acceptation MSI signé (B-150)
2. Avis RSSI après pilote (B-181)
3. Validation runtime Windows : PDF MapLibre + perf SMB réel (B-181)

**1 critère §12.2 est 🔲 (données terrain uniquement)** :
- Taux d'autonomie cadres ≥ 80 % (B-181)

**Recommandation technique** : **Go conditionnel** — la V1 est techniquement complète. Le déploiement large peut être décidé dès réception du rapport pilote (B-181) et retour DSI (B-150) favorables.

---

## Décision sponsor

> **Acte hors scope produit** — à compléter par le Sponsor DSI, Sponsor métier et RSSI après réception du rapport pilote [docs/handoff/feedback-collection.md](../handoff/feedback-collection.md).

- [ ] **Go — déploiement large**
  - Tous les critères §12.2 atteints
  - Plan de push parc large : _____________________________________________
  - Tag de release stable : `v1.0.0`
- [ ] **Go conditionnel**
  - Conditions à lever : _____________________________________________
  - Itération V1' avant déploiement large : _____________________________________________
- [ ] **No-Go**
  - Raisons : _____________________________________________
  - Plan correctif (V1' ou V2) : _____________________________________________

---

## Signatures

| Rôle | Nom | Signature | Date |
|---|---|---|---|
| Sponsor DSI | _________________________ | _________________________ | __________ |
| Sponsor métier | _________________________ | _________________________ | __________ |
| RSSI | _________________________ | _________________________ | __________ |
| Auteur produit | A. Bergé | _________________________ | __________ |

---

## Pièces jointes attendues à la décision

- [ ] Rapport pilote terrain consolidé ([docs/handoff/feedback-collection.md §4](../handoff/feedback-collection.md))
- [ ] Retour DSI sur signature MSI + déploiement MECM (B-150)
- [ ] Avis RSSI (formel ou synthèse du pilote)
- [ ] Logs MECM d'installation agrégés (taux d'installation autonome)
- [ ] Grilles de retour pilotes ([docs/handoff/feedback-grid.md](../handoff/feedback-grid.md))
- [ ] Bench runtime Windows 11 : perf SMB réel + export PDF MapLibre (à produire pendant le pilote)
- [ ] [docs/bench/BENCH.md](../bench/BENCH.md) (mesures V0 de référence)
- [ ] [PRD.md §12.2](../../PRD.md) (critères de référence)
