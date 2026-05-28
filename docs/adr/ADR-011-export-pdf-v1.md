# ADR-011 — Export PDF A4 comme exigence V1 explicite

| Champ | Valeur |
|---|---|
| Statut | Accepté |
| Date | 2026-05-28 |
| Source | [PRD.md §4.1 UC-4 et §15 (récap ADRs)](../../PRD.md) |
| Sponsor | Métier (collège cadres) |

## Contexte

Le partage hors VaultViz (mail, impression, archivage) reste un mode de travail central pour les cadres CPAM 92. L'export PDF A4 d'une vue active est un livrable explicite, pas une option. Le choix d'architecture du moteur de rendu PDF impacte la complexité de l'export sur certains types de vues (notamment carto WebGL MapLibre — risque R-5).

Deux stratégies évaluées : **impression native WebView2** (`chrome.printing`, fidélité maximale) vs **bibliothèque PDF côté front** (`pdf-lib`, `jsPDF`, contrôle total mais dépendance JS et fidélité variable).

## Décision

**Export PDF A4** est une **exigence explicite V1** (cf. UC-4 PRD §3.4 et §4.1 V1). Le choix de stratégie technique (chrome.printing vs pdf-lib) est tranché en V1 dans le cadre de la story V1-4 (B-130) après prototype des deux approches sur la carte MapLibre.

## Conséquences

**Justification** :
- Mentionné comme livrable principal pour partage hors VaultViz (mail, impression, archivage) dans UC-4.
- Format A4 (paysage par défaut, portrait sur demande) = standard administration française.
- Hors scope V0 (focus sur démonstration architecture) ; entre en V1 dans la roadmap (cf. V1-4).

**Conséquence opérationnelle** :
- V1-4 (B-130) : prototype des deux approches (`chrome.printing`, `pdf-lib`) sur vue UC-1 (carte + détail).
- V1-4 (B-131) : implémentation production de l'approche retenue.
- Métadonnées PDF : titre `.vviz`, auteur, date génération.
- Risque R-5 : rendu PDF dégradé sur certaines vues (carto MapLibre WebGL) — tester pipeline export PDF dès V0 sur la carte ; fallback envisagé : capture canvas → PDF via pdf-lib.
- Critère succès V1 (PRD §12.2) : « Export PDF A4 fonctionnel sur tous les types de vues V1 ».

## Références

- [pdf-lib](https://pdf-lib.js.org/)
- [jsPDF](https://github.com/parallax/jsPDF)
- [Chrome printing API](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_paged_media)
- [PRD.md §3.4 UC-4](../../PRD.md), [PRD.md §4.1 V1](../../PRD.md), [PRD.md §13 R-5](../../PRD.md), [PRD.md §15 ADR-011](../../PRD.md), [PRD.md §16 Q8](../../PRD.md)
- Décisions liées : [ADR-002 Mosaic](ADR-002-mosaic-vgplot.md), [ADR-009 MapLibre IGN](ADR-009-maplibre-ign.md)
