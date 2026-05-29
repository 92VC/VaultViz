# Acceptation — Intégration du design (SP1→SP4)

Date : 2026-05-29 · Branche `feat/design-integration` · PR #39

Ce dossier documente l'acceptation de l'intégration du design (maquette `mockups/VaultViz/`) dans le produit. La fidélité visuelle « ≈ pixel » est, par décision (cf. [plan maître](../superpowers/plans/2026-05-29-design-integration-master-waves.md) §0), un **artefact post-run à valider visuellement**, **pas** une gate bloquante. Les gates bloquantes sont machine-vérifiables (ci-dessous).

## 1. Gates automatiques (vertes)

À exécuter depuis la racine du repo :

| Gate | Commande | Attendu |
|---|---|---|
| Build front | `npm run build` | `tsc` + `vite build` sans erreur |
| Tests front | `npm test` | 32 fichiers / 290 tests verts, **0 errors** |
| Tests Rust | `cargo test --manifest-path src-tauri/Cargo.toml` | vert |
| Validation `.vviz` | `npx vitest run src/__tests__/examples-valid.test.ts` | exemples valides vs schéma |
| Invariant I-2 (zéro appel sortant) | `grep -rEn "fonts\.googleapis\|fonts\.gstatic" src/ index.html` | **zéro** résultat |

## 2. Exemples canoniques

Deux dashboards `.vviz` prouvent que le moteur reste un **interpréteur générique** (carte optionnelle) :

- **`examples/controle_gestion.vviz`** — *map-centric* : KPIs (avec delta), carte choroplèthe + sélecteur de métrique (CA / Marge / Écart), barres classées, barres appariées (budget vs réalisé), table (recherche + badges de statut), cross-filter au clic département. Reproduit la maquette `mockups/VaultViz/VaultViz.html`.
  - Données : `examples/controle_gestion_{departements,categories,quarters}.parquet` (générées par `cargo run --manifest-path src-tauri/Cargo.toml --example gen_controle_gestion`).
- **`examples/suivi_mensuel.vviz`** — *sans carte* : KPIs, courbe (`line`) + aire (`area`) d'évolution mensuelle, barres par canal, table. Prouve que VaultViz n'est pas dépendant de la carte.
  - Données : `examples/suivi_mensuel_{mois,canal}.parquet` (`... --example gen_suivi_mensuel`).

## 3. Procédure de validation visuelle (poste avec affichage)

1. `cargo tauri dev` (lance l'app Tauri + WebView2, DuckDB natif).
2. Écran d'accueil : vérifier hero, dropzone, liste des récents ; thème sombre par défaut ; toggle clair/sombre (toolbar).
3. Ouvrir `examples/controle_gestion.vviz` (bouton Ouvrir, double-clic, ou glisser-déposer) :
   - bandeau KPIs (4) avec valeurs formatées + deltas ;
   - carte choroplèthe colorée + sélecteur CA/Marge/Écart fonctionnel ;
   - barres classées + barres appariées ;
   - table avec recherche et badges ;
   - **clic sur un département → filtre l'ensemble** (chip de filtre actif, KPIs/barres/table recalculés) ; clic du « x » du chip → reset.
   - Comparer côte à côte avec `mockups/VaultViz/VaultViz.html` (ouvrir dans un navigateur).
4. Ouvrir un 2ᵉ document (`suivi_mensuel.vviz`) : vérifier le **2ᵉ onglet**, l'isolation (le filtre d'un onglet n'affecte pas l'autre), la fermeture d'onglet.
5. Mode avion : vérifier qu'aucune police/ressource n'échoue (tout est embarqué, I-2).

## 4. Captures automatisées (différé)

Le harnais Playwright n'a pas pu être exécuté dans l'environnement de développement actuel (pas d'app Tauri lancée / pas d'affichage ; DuckDB natif accessible uniquement via l'IPC Tauri, indisponible en `vite preview` pur). À implémenter sur un poste avec affichage : script Playwright capturant les états (accueil, dashboard, dashboard+filtre, erreur) en thèmes sombre **et** clair, déposés sous `docs/acceptance/<date>/`.

## 5. Limites connues (suivi)

- **SP4 / vgplot** : à la fermeture d'un onglet, les clients vgplot (courbes/aires/nuages) ne sont pas déconnectés du coordinator Mosaic partagé → légère **fuite mémoire** (pas de fuite de données ; l'isolation des vues `doc_<id>__<source>` et des `RuntimeContext` par onglet est garantie). À corriger : suivre les handles de plots par document et appeler `coordinator.disconnect(client)` à la fermeture.
- **Captures automatisées** : cf. §4 (différé, dépend de l'environnement).
