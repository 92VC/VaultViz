# ADR-012 — Design system custom VaultViz (supersede DSFR/Marianne)

| Champ | Valeur |
|---|---|
| Statut | Accepté |
| Date | 2026-05-29 |
| Source | [PRD.md §4.1 V1](../../PRD.md), [spec intégration maquette](../superpowers/specs/2026-05-29-integration-design-maquette-design.md) |
| Sponsor | Produit (décision utilisateur explicite) |
| Supersede | Exigence « Thème DSFR + typo Marianne » (PRD §4.1 V1 ; ex-stories B-140, B-141) |

## Contexte

Le PRD V1 prévoyait initialement un habillage conforme au **Système de design de l'État (DSFR)** avec la typographie **Marianne**, pour crédibilité institutionnelle (ex-stories B-140, B-141).

En parallèle de la V0, une maquette haute-fidélité (`mockups/VaultViz/`) a défini un **design system custom** : thème sombre/clair, tokens CSS, accent `#0066FF`, polices Inter (UI) + JetBrains Mono (données/chemins). Ce design est jugé supérieur en lisibilité et en densité d'information pour l'usage data-viz desktop visé.

VaultViz est un **outil interne** CPAM 92 (organisme privé chargé d'une mission de service public). Le DSFR n'est **pas** une obligation externe pour cet outil. La décision d'adopter le design custom a été prise explicitement par le porteur produit.

## Décision

Le **design system custom de la maquette** devient la **référence visuelle officielle** de VaultViz, en lieu et place du DSFR/Marianne. Les ex-stories B-140 (palette DSFR) et B-141 (typo Marianne) sont **retirées** et remplacées par l'épopée d'intégration du design (cf. BACKLOG §3.5, SP1→SP4).

## Conséquences

**Justification :**
- Meilleure adéquation au cas d'usage data-viz desktop (densité, thème sombre, hiérarchie typographique).
- Pas d'obligation externe DSFR pour un outil interne CPAM.

**Conséquences opérationnelles :**
- Les polices Inter + JetBrains Mono doivent être **embarquées** en `.woff2` local + `@font-face`, **sans aucun appel CDN** (invariant I-2 « zéro appel sortant »). La maquette importe actuellement les polices via Google Fonts — interdit en production.
- La persistance des préférences (thème, densité) se fait en `%LOCALAPPDATA%\VaultViz\` uniquement (invariant I-3).

## Références

- [Spec d'intégration de la maquette](../superpowers/specs/2026-05-29-integration-design-maquette-design.md)
- Maquette : `mockups/VaultViz/`
- Décisions liées : [ADR-002 Mosaic](ADR-002-mosaic-vgplot.md), [ADR-008 No network](ADR-008-no-network.md)
- [PRD.md §4.1 V1](../../PRD.md), [PRD.md §15 ADR-012](../../PRD.md)
