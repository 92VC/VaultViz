# ADR-008 — Aucun port réseau, aucun appel sortant, pas d'updater applicatif

| Champ | Valeur |
|---|---|
| Statut | Accepté |
| Date | 2026-05-28 |
| Source | [PRD.md §6.3](../../PRD.md#63-décisions-architecturales-clés-adrs-synthétisés) |
| Sponsor | DSI CPAM 92, RSSI CPAM 92 |

## Contexte

Une revue PSSI/RSSI est facilitée par un binaire dont la surface réseau est nulle : pas de port en écoute, pas d'appel sortant. La philosophie local-first du produit (ADR-004, ADR-005) impose par ailleurs que toute mise à jour passe par le canal MECM/Intune existant, pas par un updater applicatif.

Alternatives écartées : updater Tauri (`tauri-plugin-updater`), télémétrie Sentry/Crashlytics, phone-home discret pour vérification de version.

## Décision

VaultViz **n'ouvre aucun port en écoute**. **Aucune connexion sortante n'est effectuée** : pas d'updater intégré, pas de télémétrie, pas de phone-home. Toutes les mises à jour sont poussées par MECM/Intune.

## Conséquences

**Justification** :
- Alignement strict avec philosophie local-first.
- Facilite la revue PSSI/RSSI : un binaire 100 % hors-ligne est plus facile à valider qu'un binaire avec exceptions.
- Élimine toute infra externe à maintenir (endpoint manifest, serveur télémétrie).
- Réduit le modèle de menace (cf. PRD §8.1).

**Conséquence opérationnelle** :
- Pas de Sentry, pas de Google Analytics, pas de plugin `tauri-plugin-updater`, pas d'endpoint à héberger.
- Logs en **local exclusivement** (`%LOCALAPPDATA%\VaultViz\logs\`, cf. PRD §8.3).
- Numéro de version visible dans l'application (À propos) pour le support.
- La capability Tauri ne déclare aucune permission `http:*` ou `shell:execute` réseau.
- À l'audit : `netstat`/`Process Monitor` doivent confirmer zéro connexion sortante en fonctionnement.

## Références

- [Tauri plugin model](https://v2.tauri.app/plugin/)
- [PRD.md §6.3 ADR-008](../../PRD.md), [PRD.md §8.1](../../PRD.md), [PRD.md §10.2](../../PRD.md)
- Décisions liées : [ADR-004 Tauri 2](ADR-004-tauri-2.md), [ADR-005 Signature DSI](ADR-005-signature-dsi.md)
