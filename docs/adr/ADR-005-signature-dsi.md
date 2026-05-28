# ADR-005 — MSI signable produit par la CI ; signature et déploiement = DSI

| Champ | Valeur |
|---|---|
| Statut | Accepté |
| Date | 2026-05-28 |
| Source | [PRD.md §6.3](../../PRD.md#63-décisions-architecturales-clés-adrs-synthétisés) |
| Sponsor | DSI CPAM 92, RSSI CPAM 92 |

## Contexte

Le déploiement d'un binaire sur un parc Windows 11 d'établissement public passe par : (1) signature de code avec un certificat reconnu par le parc (PKI interne ou EV), (2) packaging conforme MECM/Intune, (3) éventuelles règles AppLocker / WDAC, (4) tests d'installation sur poste protégé.

Ces décisions (type de certificat, mode de stockage de clé, procédure de signature, packaging MECM, fenêtre de déploiement) **relèvent de la DSI CPAM 92** selon ses procédures en vigueur. Il n'appartient pas au produit VaultViz de les trancher.

## Décision

Le build produit un **MSI signable** en sortie de CI. La **signature de code** et le **déploiement parc** relèvent de la DSI CPAM 92 selon ses procédures en vigueur (PKI interne, AppLocker, MECM/Intune).

## Conséquences

**Justification** :
- Découplage produit/parc : le produit garantit un artefact propre, le parc gère la chaîne de confiance.
- Évite que le PRD prenne des décisions techniques (HSM ? OV vs EV ? procédure de signature ?) hors de sa compétence et de sa gouvernance.
- Permet à la DSI d'intégrer VaultViz dans son outillage existant sans contrainte produit.

**Conséquence opérationnelle** :
- Le PRD ne tranche **ni** le type de certificat, **ni** le mode de stockage de clé, **ni** la procédure de signature.
- La CI GitHub Actions produit un MSI non signé téléchargeable depuis la release privée.
- La DSI signe et pousse via MECM selon ses procédures.
- Story B-072 (V0) : livraison d'un MSI de test à la DSI pour validation rapide (mitigation R-1).
- Le point de contact DSI est à identifier (§16 Q2 PRD).

## Références

- [PRD.md §6.3 ADR-005](../../PRD.md), [PRD.md §10](../../PRD.md), [PRD.md §13 R-1](../../PRD.md)
- Décisions liées : [ADR-006 MSI bundler](ADR-006-msi-bundler.md), [ADR-008 No network](ADR-008-no-network.md), [ADR-010 Windows 11 only](ADR-010-windows-11-only.md)
