# ADR-004 — Tauri 2.x, pas Electron ni Wails v3

| Champ | Valeur |
|---|---|
| Statut | Accepté |
| Date | 2026-05-28 |
| Source | [PRD.md §6.3](../../PRD.md#63-décisions-architecturales-clés-adrs-synthétisés) |
| Sponsor | DSI CPAM 92 |

## Contexte

Le shell desktop doit fournir : (1) une fenêtre native sur Windows 11 (cible exclusive — cf. ADR-010), (2) un modèle de sécurité auditable PSSI/RSSI (capabilities explicites, pas d'IPC ouvert), (3) un footprint binaire et mémoire compatible parc cadre, (4) un packaging MSI industrialisé.

Alternatives évaluées : **Tauri 2.x** (Rust + WebView2), **Electron** (Chromium embarqué), **Wails v3** (Go + WebView2).

## Décision

**Tauri 2.x** (dernière minor stable au démarrage du POC).

## Conséquences

**Justification** :
- **Wails v3** n'est pas GA à la date de rédaction ; exclu pour déploiement large échelle tant que statut alpha/beta. À réévaluer au démarrage. Source : [v3.wails.io/whats-new](https://v3.wails.io/whats-new/).
- **Electron** : Chromium embarqué = bundle nettement plus lourd (ordre de grandeur 10×) que Tauri ; RAM idle supérieure ; sur Windows l'écart RAM se réduit (WebView2 vs Chromium) mais le bundle reste pénalisant.
- **Tauri capability model** (ACL JSON par fenêtre) cadre mieux avec une revue PSSI : permissions explicitement déclarées, scope FS limité à `//<host>/<share>/**`.

**Conséquence opérationnelle** :
- Montée en compétence Rust nécessaire côté core. Vibe coding compense en grande partie ; restent les sujets durs (Tauri plugins custom, bindings DuckDB).
- WebView2 Evergreen comme moteur HTML — mises à jour Windows Update (pas notre charge).
- Verrouillage `Cargo.lock` au début du POC ; migration Tauri 3 réévaluée si breaking change majeur (R-9).

## Références

- [Tauri 2 documentation](https://v2.tauri.app/)
- [Tauri 2 releases](https://v2.tauri.app/release/)
- [Tauri capability model](https://v2.tauri.app/security/capabilities/)
- [Wails v3 status](https://v3.wails.io/whats-new/)
- [PRD.md §6.3 ADR-004](../../PRD.md), [PRD.md §13 R-9](../../PRD.md)
- Décisions liées : [ADR-006 MSI bundler](ADR-006-msi-bundler.md), [ADR-007 UNC paths](ADR-007-unc-paths.md), [ADR-008 No network](ADR-008-no-network.md)
