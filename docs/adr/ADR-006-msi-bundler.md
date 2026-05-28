# ADR-006 — MSI via `tauri-bundler`, pas MSIX

| Champ | Valeur |
|---|---|
| Statut | Accepté |
| Date | 2026-05-28 |
| Source | [PRD.md §6.3](../../PRD.md#63-décisions-architecturales-clés-adrs-synthétisés) |
| Sponsor | DSI CPAM 92 |

## Contexte

Tauri 2 propose plusieurs cibles de packaging Windows : MSI (via tauri-bundler + WiX), MSIX (modern packaging recommandé par Microsoft), NSIS (installer alternatif). Le choix impacte la procédure DSI de déploiement (MECM/Intune historique sur MSI vs MSIX).

## Décision

Cible installeur = **MSI** (via tauri-bundler `"targets": ["msi"]`) pour Windows.

## Conséquences

**Justification** :
- MSI = standard MECM/Intune historique, déploiement silencieux maîtrisé.
- MSIX recommandé « forward-looking » par Microsoft, mais Tauri ne génère pas nativement MSIX → friction de repackaging.
- AppLocker / WDAC s'accommodent du MSI signé.

**Conséquence opérationnelle** :
- `tauri.conf.json` cible `["msi"]` exclusivement.
- WiX upgrade GUID stable (à générer une fois, versionner).
- File associations `.vviz` créées à l'installation.
- MSIX étudié en V2 si la DSI CPAM impose modern packaging.

## Références

- [Tauri distribute](https://v2.tauri.app/distribute/)
- [WiX Toolset](https://wixtoolset.org/)
- [MECM MSI deployment](https://learn.microsoft.com/en-us/mem/configmgr/apps/deploy-use/create-applications)
- [PRD.md §6.3 ADR-006](../../PRD.md), [PRD.md §10](../../PRD.md)
- Décisions liées : [ADR-004 Tauri 2](ADR-004-tauri-2.md), [ADR-005 Signature DSI](ADR-005-signature-dsi.md)
