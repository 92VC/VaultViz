# Démo VaultViz V0 — Script (30 min) — B-081

| Champ | Valeur |
|---|---|
| Story | B-081 |
| Statut | `[!]` Bloqué — convocation des participants par sponsor |
| Audience cible | RSSI CPAM 92 + 2 cadres invités (collège cible) + DSI |
| Format | Présentation live + Q/R + retours écrits |
| Date | À planifier par sponsor |

---

## Pré-requis machine de démo

- Poste Windows 11 (de préférence un poste « parc » MECM standard)
- MSI v0.0.1-rc1 installé via association `.vviz`
- Fichier de démo `examples/DLI/dli_inventaire_autoporteur.vviz` copié sur le poste (parquet embarqué `inline` — aucun `.parquet` séparé ni partage SMB requis pour ce fichier)
- Réseau interne LAN (pas de routage internet — démontre invariant ADR-008)
- Connexion partagée écran (projection ou Teams)

## Audience attendue

- **DSI** — décideur autorisation déploiement parc
- **RSSI** — décideur avis sécurité préliminaire (critère §12.1 PRD)
- **2 cadres invités** — représentatifs collège cible (un contrôleur de gestion + un cadre métier)
- Auteur produit (A. Bergé) — présentateur

## Plan détaillé

### 1. (3 min) Contexte & vision

- Note d'opportunité originale ([VaultViz.md](../../VaultViz.md))
- Positionnement (« Obsidian pour la dataviz », PRD §1.1)
- Pourquoi maintenant : convergence Tauri 2 + DuckDB 1 + Mosaic (PRD §1.2)
- Hors scope explicite : pas d'éditeur, pas de cloud, pas multi-plateforme

### 2. (5 min) Architecture & invariants

Affichage du schéma PRD §6.1 :
```
Partage SMB (RO)
    │
    ▼
.vviz (JSON) + .parquet (data)
    │
    ▼
VaultViz.exe (Tauri 2 + DuckDB natif + Mosaic)
    │ aucun port, aucun appel sortant
    ▼
Carte interactive
```

ADRs structurants à mentionner :
- [ADR-001 DuckDB natif](../adr/ADR-001-duckdb-natif.md)
- [ADR-005 Signature DSI hors scope](../adr/ADR-005-signature-dsi.md)
- [ADR-008 Local-first strict](../adr/ADR-008-no-network.md)
- [ADR-010 Windows 11 only](../adr/ADR-010-windows-11-only.md)

### 3. (10 min) Démo live

**Scénario UC-1 + UC-3 + UC-6** :

1. **Double-clic** sur `dli_inventaire_autoporteur.vviz` dans Explorer Windows
   → VaultViz s'ouvre en ~2 s (citer cible PRD §9.1 < 3 s)
   → JSON pretty-print affiché + DuckDB en arrière-plan
2. **Carte choroplèthe France** dessinée
   → 96 départements colorés par effectif
   → Tooltip au survol (nom dept + valeur)
3. **Clic sur Hauts-de-Seine (`92`)** :
   → Tableau détail filtré apparaît (< 1 s, cite cible)
   → Barres adjacentes recalculées (cross-filter UC-3)
   → Push-down SQL DuckDB observable dans logs locaux
4. **Spec invalide** (UC-6) :
   → Ouvrir un `.vviz` avec `title` manquant
   → Bandeau erreur lisible avec chemin exact (`/vviz/title: must be string`)
   → Bouton « Réessayer » + lien vers doc auteur
5. **Démontrer absence de réseau** :
   → Mode avion / déconnexion réseau
   → Reload VaultViz → tout continue de fonctionner (lecture share OK, pas d'updater)

### 4. (5 min) Performance : BENCH.md

Présenter `docs/bench/BENCH.md` synthétique :

| Mesure | Cible V0 | Mesuré (300 Mo synth Linux NVMe) | Statut |
|---|---|---|---|
| Premier rendu | < 8 s | 7.5 ms | 🟢 × 1067 |
| Drill-down | < 1 s | 14.9 ms | 🟢 × 67 |
| RAM stable | < 800 Mo | 331 Mo | 🟢 |

Note honnêteté : « substitué au bench CPAM SMB réel ; validation finale = V1 pilote ».

### 5. (5 min) Q/R + retours écrits

- Distribuer la grille de retour ([feedback-grid.md](feedback-grid.md))
- Champs ouverts pour RSSI / DSI / cadres
- Décision Go / Go conditionnel / No-Go à formaliser dans
  [ADR-V0-GoNoGo-template.md](../adr/ADR-V0-GoNoGo-template.md)

### 6. (2 min) Next steps

Si Go V0 :
- Tagger `v0.0.1` (release stable)
- Démarrer V1 selon roadmap (V1-1 MapLibre + PMTiles)
- Coordonner avec DSI pour signature MSI prod
- Identifier panel pilote cadres (10-20)

Si Go conditionnel :
- Lister conditions
- Itération supplémentaire avant V1

Si No-Go :
- Documenter raisons
- Amendement PRD

---

## Pièces jointes à préparer

- [ ] MSI v0.0.1-rc1 préinstallé sur poste démo
- [ ] Partage `\\demo\share\` monté avec spec + Parquet
- [ ] Grille de retour imprimée (1/participant)
- [ ] Slides de présentation (à générer via `pandoc demo-slides.md`)
- [ ] BENCH.md imprimé (2 pages max)
