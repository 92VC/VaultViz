# ADR-010 — Windows 11 exclusivement

| Champ | Valeur |
|---|---|
| Statut | Accepté |
| Date | 2026-05-28 |
| Source | [PRD.md §11 et §15 (récap ADRs)](../../PRD.md) |
| Sponsor | DSI CPAM 92 |

## Contexte

Le parc cible CPAM 92 est **homogène Windows 11** géré MECM/Intune. Supporter Linux, macOS, mobile, web ou Windows 10 introduirait des coûts récurrents (CI matrix, packaging, tests, support utilisateur) sans gain métier identifié.

Alternatives écartées : build multi-plateforme (Linux .deb/.AppImage, macOS .dmg), version web.

## Décision

**Windows 11 exclusivement** — pas de build multi-plateforme.

## Conséquences

**Justification** :
- Parc CPAM 92 cible homogène = pas de besoin métier multi-plateforme.
- Élimine coûts CI matrix (build × 3 OS), tests multi-OS, packaging × 3 cibles.
- Élimine dette future (Linux WebKitGTK ≠ WebView2 Windows ; macOS WKWebView ≠ WebView2).
- Permet d'utiliser des features WebView2 spécifiques sans abstraction.

**Conséquence opérationnelle** :
- `tauri.conf.json` cible **MSI Windows** uniquement (cf. ADR-006).
- CI GitHub Actions : job `windows-latest` pour build prod ; job `ubuntu-latest` pour tests Rust+JS uniquement (pas de build prod Linux).
- Hors scope V1 **et** V2 : Linux, macOS, mobile, web.
- Aucune dette portage à porter sur ce front.
- Documentation utilisateur cible Windows 11 (raccourcis, paths, comportement Explorer).
- Dev en local Linux possible pour itération rapide (webkit2gtk) mais aucune validation Windows-spécifique sans GHA windows-latest ou poste Windows.

## Références

- [PRD.md §11 Plateforme cible](../../PRD.md), [PRD.md §15 ADR-010](../../PRD.md)
- Décisions liées : [ADR-004 Tauri 2](ADR-004-tauri-2.md), [ADR-005 Signature DSI](ADR-005-signature-dsi.md), [ADR-006 MSI bundler](ADR-006-msi-bundler.md)
