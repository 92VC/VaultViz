# VaultViz

Outil de data-visualization desktop **local-first**, fichier-comme-source-de-vérité, pour la CPAM 92.

> Obsidian pour la dataviz : un exécutable local qui interprète des fichiers `.vviz` (JSON, spec Mosaic/vgplot) référençant des Parquet posés sur un partage SMB/UNC. Pas de serveur, pas de cloud, pas de licence par utilisateur.

## Documentation projet

| Document | Rôle | Quand le lire |
|---|---|---|
| [PRD.md](./PRD.md) | Product Requirements Document — source de vérité | Avant toute décision produit |
| [BACKLOG.md](./BACKLOG.md) | Backlog atomique avec suivi d'avancement | Pour exécuter / suivre l'état |
| [CLAUDE.md](./CLAUDE.md) | Contrat de collaboration Claude Code | Au démarrage de chaque session IA |
| [VaultViz.md](./VaultViz.md) | Note d'opportunité originale (historique) | Pour comprendre la genèse |
| `docs/adr/` | Architecture Decision Records détaillés | Pour comprendre une décision technique |

## Statut

Projet en phase **Pré-V0**. Voir [BACKLOG.md §0.3](./BACKLOG.md) pour le tableau de bord d'avancement.

## Stack

Tauri 2 (Rust + WebView2) · DuckDB natif · Mosaic + vgplot · Apache Arrow · MapLibre GL JS · TopoJSON IGN ADMIN EXPRESS · Windows 11.

## Plateforme cible

**Windows 11 exclusivement** — parc CPAM 92, déploiement MECM/Intune.

## Contact

Auteur : A. Bergé (CPAM 92) — `ab@alexandre-berge.fr`
