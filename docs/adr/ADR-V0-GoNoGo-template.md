# ADR-V0-GoNoGo — Template décision Go/No-Go V0 → V1 (B-082)

| Champ | Valeur |
|---|---|
| Statut | **Brouillon** (technique pré-rempli ; sponsor à décider) |
| Date prévue | _à compléter après démo B-081_ |
| Sponsors | DSI CPAM 92, métier (collège cadres), RSSI |
| Auteur produit | A. Bergé |
| Document source | [PRD.md §12.1](../../PRD.md) |

---

## Contexte

À l'issue des stories I0 → I7 (V0 prototype démontrable), évaluer si :
- l'architecture verrouillée (ADR-001 à ADR-011) tient face aux 6 cas d'usage canoniques ;
- les performances mesurées sur Parquet 50 Mo + 300 Mo répondent aux cibles §9.1 V0 ;
- la chaîne MSI signable est compatible avec les procédures DSI CPAM 92 ;
- l'avis RSSI préliminaire est favorable (sans blocage structurel).

Cette décision conditionne le démarrage de **V1 (pilote collège cadres)**.

---

## Évaluation technique (V0 = 20/23 stories `[x]` autonomes)

### Critères §12.1 PRD — pré-évaluation par l'équipe produit

Légende : 🟢 = Go, 🟧 = Go conditionnel, 🔴 = No-Go.

| Critère | Cible Go | Seuil No-Go | Mesure VaultViz V0 | Couleur |
|---|---|---|---|---|
| **UC-1** fonctionnel Parquet 50 Mo | ✅ | ❌ | ✅ (démo enregistrée + tests unitaires `src/__tests__/`) | 🟧 (proxy synthétique — handoff CPAM réel V1) |
| **UC-3** cross-filter | ✅ | ❌ | ✅ (B-041 démo carte + barres + table) | 🟢 |
| **UC-6** erreur lisible | ✅ | ❌ | ✅ (B-060/B-061 bandeau typé + détails Ajv) | 🟢 |
| Premier rendu Parquet 50 Mo | < 3 s | > 8 s | **7.9 ms** (Linux NVMe, B-023) | 🟢 large |
| Premier rendu Parquet 300 Mo | < 8 s | > 15 s | **7.5 ms** (Linux NVMe, B-080) | 🟢 large |
| Drill-down Parquet 300 Mo | < 1 s | > 3 s | **14.9 ms** (Filter+AGG, B-080) | 🟢 large |
| RAM stable Parquet 300 Mo | < 800 Mo | > 1,5 Go | **331 Mo** RSS process complet (B-080) | 🟢 |
| Hypothèse H1 (UNC scope Tauri) validée | ✅ | ❌ | Partiel : chemin local + relatif OK ; UNC réel CPAM = handoff V1 (B-072 + B-012 reporté) | 🟧 |
| Hypothèse H4 (drill spec déclarative, < 50 lignes JS métier) | ✅ | ❌ | ✅ (B-041 critère audité, `src/main.ts` = câblage haut-niveau uniquement, logique métier exclusivement dans `viz-engine/`) | 🟢 |

### Critères dépendants de décisions externes (3 stories `[!]`)

| Critère | Cible Go | Seuil No-Go | Statut V0 | Couleur |
|---|---|---|---|---|
| MSI signable accepté par DSI | ✅ | ❌ | Handoff prêt (B-072 — `docs/handoff/dsi-signing-package.md`) | 🟧 _en attente_ |
| Avis RSSI préliminaire favorable | ✅ | ❌ | Handoff prêt (B-081 — `docs/handoff/demo-script.md` + grille de retour) | 🟧 _en attente_ |
| Décision Sponsor (DSI + métier) | ✅ | ❌ | ce document — à signer après démo et retour DSI | 🟧 _en attente_ |

---

## Pré-évaluation technique (à confirmer par sponsor)

Sur les **9 critères techniques mesurables**, la V0 est :

- **6 🟢** (UC-3, UC-6, perfs 50 Mo, perfs 300 Mo, RAM, H4)
- **3 🟧** (UC-1 sur synthétique, H1 UNC partielle, MSI/RSSI/Sponsor en attente)
- **0 🔴**

**Recommandation technique** : **Go conditionnel** sur V1, sous condition de :
1. Retour DSI signature MSI favorable (B-072) ;
2. Avis RSSI préliminaire sans blocage structurel (B-081) ;
3. Validation H1 (UNC scope Tauri) sur un share CPAM réel comme **première story V1**.

---

## Décision sponsor

(À compléter après démo B-081 et retour DSI B-072)

- [ ] **Go V1**
  - Démarrer la roadmap V1 (V1-1 MapLibre, etc.)
  - Tagger `v0.0.1` (release stable)
- [ ] **Go conditionnel**
  - Conditions à lever : _____________________________________________
  - Itération supplémentaire avant V1 (préciser scope)
- [ ] **No-Go**
  - Raisons : _____________________________________________
  - Plan d'action : _____________________________________________

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

- [ ] `docs/bench/BENCH.md` (mesures B-023 + B-080)
- [ ] `docs/handoff/dsi-signing-package.md` + retour DSI (B-072)
- [ ] `docs/handoff/demo-script.md` (B-081)
- [ ] Compte-rendu écrit de la démo B-081 (grilles de retour remplies)
- [ ] PRD.md §12.1 (critères de référence)
