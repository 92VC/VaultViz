# ADR-PDF — Stratégie d'export PDF A4 (B-130)

| Champ      | Valeur                                                                 |
|------------|------------------------------------------------------------------------|
| Statut     | Accepté                                                                |
| Date       | 2026-05-31                                                             |
| Décideur   | Alex Berge (ElegAlex)                                                  |
| Story      | B-130 → implémentation B-131                                           |
| Dépendances | ADR-011 (export PDF exigence V1), ADR-009 (MapLibre IGN), ADR-008 (no-network) |

---

## Contexte

### Exigence dure

L'export PDF A4 est une exigence explicite V1 (PRD §4.1 UC-4, ADR-011) : livrable principal pour partage hors VaultViz (mail, impression, archivage). Critère de succès PRD §12.2 : « Export PDF A4 fonctionnel sur **tous** les types de vues V1 ». Le PDF doit être généré en < 5 s (B-131 AC-1). Les métadonnées sont obligatoires (titre `.vviz`, auteur, date).

### Inventaire des vues à capturer

| Type de vue               | Technologie de rendu            | Moteur de capture             |
|---------------------------|---------------------------------|-------------------------------|
| KPI card                  | HTML DOM (`div/span`)           | ⚠ html2canvas **ou** redraw pdf-lib |
| Table                     | HTML DOM (`div`)                | ⚠ html2canvas **ou** redraw pdf-lib |
| Bar chart (vgplot/Plot)   | SVG (Observable Plot)           | `XMLSerializer` → canvas → `toDataURL` |
| Bar chart maison          | SVG                             | idem                          |
| Ranked/Grouped bars       | SVG                             | idem                          |
| Pie/Donut                 | SVG                             | idem                          |
| Line/Area                 | SVG                             | idem                          |
| Carte choroplèthe (défaut)| SVG / D3-geo (`engine: "svg"`)  | idem                          |
| Carte MapLibre (optionnel)| WebGL canvas (`engine: "maplibre"`) | `map.getCanvas().toDataURL()` + piège preserveDrawingBuffer |

`pdf-lib@1.17.1` est déjà dans le lockfile. Aucune autre dep PDF n'est présente.

### Deux voies candidates

#### (a) Impression native WebView2 — `window.print()` / CSS `@media print`

Le moteur Chromium de WebView2 rend la page entière (DOM + SVG + canvas WebGL) et confie le résultat au spooler d'impression Windows.

**Avantages** : fidélité visuelle maximale ; capture WebGL sans manipulation de contexte.

**Inconvénients** :
- Ouvre **un dialogue système** (Print to PDF ou imprimante physique) — impossible de générer un fichier `.pdf` en 1 clic sans interaction utilisateur, ce qui casse le critère B-131 AC-1 (< 5 s, automatisable) et l'UX bouton « Exporter ».
- **Aucun contrôle programmatique** des marges A4 paysage : les réglages proviennent de la feuille CSS `@media print` et des préférences du poste. Aucune garantie de conformité A4 paysage exact hors configuration manuelle.
- **Métadonnées PDF (titre, auteur, date) impossibles à injecter** programmatiquement via `window.print()`.
- Comportement WebView2 (Windows 11 Chromium) ≠ webkit2gtk (dev Linux) : toute validation en dev est trompeuse.
- Dépend de la configuration du poste (pilotes d'impression, imprimante par défaut, droits d'accès au spooler).

#### (b) Génération pdf-lib — capture par vue, composition A4 paysage

Chaque vue de la page active est capturée en PNG (data URI) et composée sur une page A4 paysage via `pdf-lib`. Le PDF est sérialisé en mémoire et téléchargé via Tauri `fs` write.

**Avantages** :
- **Contrôle total** du format : A4 paysage = `[841.89, 595.28]` points PDF (PageSizes.A4 swappé).
- **Métadonnées programmables** : `pdfDoc.setTitle(vvizTitle)`, `setAuthor("VaultViz")`, `setCreationDate(new Date())`.
- **Zéro dialogue utilisateur** : génération 1-clic, fichier sauvegardé via Tauri IPC.
- **Hors-ligne garanti** (invariant I-2) : pdf-lib est bundlé, aucun appel réseau.
- **Indépendant du moteur d'impression** du poste Windows.
- `pdf-lib@1.17.1` déjà dans le lockfile — pas de nouvelle dep pour le cœur PDF.

**Inconvénients** :
- Capture SVG : les `var(--*)` CSS custom properties ne sont **pas résolues** dans un SVG sérialisé hors DOM ; les polices non-embarquées peuvent s'absenter. B-131 devra inliner les styles calculés avant sérialisation (voir piège SVG ci-dessous).
- Capture HTML (KPI, table) : `XMLSerializer` ne couvre pas le HTML arbitraire. Deux sous-options — (b1) html2canvas (dep npm à verrouiller) ou (b2) redessiner les éléments simples avec les primitives `drawText`/`drawRectangle` de pdf-lib (plus de code, zéro dep, rendu vectoriel net).

---

## Décision

**Voie (b) — génération pdf-lib** est retenue.

Les discriminants décisifs sont l'impossibilité d'injecter les métadonnées programmatiquement, l'absence de contrôle sur le format A4 exact, et la dépendance au dialogue système avec `window.print()`. La voie (b) répond à toutes les exigences fonctionnelles de B-131 sans infrastructure externe.

Pour la capture HTML (KPI, table), B-131 opte pour la **sous-option (b2) par défaut** : redessiner les cartes KPI et le tableau en primitives pdf-lib. Ce choix est **révisable en (b1) html2canvas** si la complexité de redraw se révèle disproportionnée — la décision lockfile sera prise au démarrage de B-131 (voir §Impact sur B-131).

### Pipeline retenu

```
Vue active
├── Vues SVG (charts, choroplèthe SVG)
│    └── XMLSerializer → <img> → <canvas> → toDataURL("image/png")
│         └── inlining styles calculés (résoudre var(--*), embeds fonts)
├── Carte MapLibre WebGL (si engine = "maplibre")
│    └── map.getCanvas().toDataURL("image/png")
│         └── prérequis : preserveDrawingBuffer: true + capturer après idle
└── Vues HTML (KPI, table)
     └── pdf-lib drawText / drawRectangle (option (b2) — révision possible vers html2canvas)

→ PDFDocument.create()
   .addPage([841.89, 595.28])   // A4 paysage
   .drawImage(pdfImg, { x, y, width, height })
   .setTitle / setAuthor / setCreationDate
   .save()
→ Tauri fs.writeFile → PDF sur disque
```

---

## Conséquences

### Ce que B-131 doit implémenter

1. **Service `pdf-export.ts`** dans `src/services/` :
   - Orchestration de la capture de chaque vue active.
   - Composition A4 paysage avec pdf-lib (marges, titre de page, en-tête `.vviz`).
   - Métadonnées : `setTitle`, `setAuthor("VaultViz")`, `setCreationDate`.
   - Appel Tauri IPC `fs::write_file` pour écriture sur disque (dialog `save`).

2. **Capture SVG** (charts + choroplèthe SVG) :
   ```ts
   const svg = container.querySelector('svg')!;
   // Inliner les styles calculés AVANT sérialisation :
   // résoudre toutes les var(--*) via getComputedStyle, embarquer la font si nécessaire
   const dataUrl = svgToDataUrl(svg);  // XMLSerializer → blob URL → canvas → toDataURL
   const pdfImg = await pdfDoc.embedPng(dataUrl);
   ```

3. **Capture MapLibre WebGL** :
   - Ajouter `preserveDrawingBuffer: true` au constructeur `new maplibregl.Map(...)` dans `map-libre.ts`.
   - Capturer APRÈS `map.once('idle', ...)` pour s'assurer que le buffer est peuplé.
   - Extraction : `map.getCanvas().toDataURL("image/png")`.

4. **Capture HTML (KPI, table)** — option (b2) par défaut :
   - Redessiner chaque carte KPI avec `page.drawRectangle` (fond) + `page.drawText` (valeurs, labels, delta).
   - Redessiner le tableau visible avec `drawText` par cellule (police monospace ou système).
   - **Si la complexité est jugée excessive**, basculer sur html2canvas (option b1) — décision lockfile à prendre en B-131 : `npm install html2canvas` + verrouillage version.

### Dépendances lockfile pour B-131

| Dep             | Statut                       | Action                                         |
|-----------------|------------------------------|------------------------------------------------|
| `pdf-lib@1.17.1`| Déjà dans `package.json`     | Rien à faire                                   |
| `html2canvas`   | **Absente** (option b1 HTML) | À décider en B-131 si (b2) trop coûteux ; noter la version à l'installation |

### Pièges à éviter pour B-131

#### Piège 1 — WebGL canvas vide (`preserveDrawingBuffer`)

Par défaut, MapLibre GL crée son contexte WebGL avec `preserveDrawingBuffer: false` pour des raisons de performance (le GPU peut effacer le back-buffer entre frames). Un appel `getCanvas().toDataURL()` dans ce mode retourne une **image entièrement transparente ou noire**, même si la carte s'affiche correctement à l'écran.

**Correction** : passer `preserveDrawingBuffer: true` dans les options du `Map` constructor. Ce flag a un coût mémoire GPU, mais est nécessaire pour la capture. Il n'affecte pas les cartes avec `engine: "svg"` (choroplèthe D3 — le cas le plus fréquent en V1).

**Deuxième condition** : capturer APRÈS l'événement `idle` (ou `render`) de MapLibre — le moteur WebGL rend de façon asynchrone, un `toDataURL()` synchrone immédiat renverra le buffer non encore peuplé.

**Portée** : risque R-5 est **circonscrit au mode `engine: "maplibre"`** (opt-in). La choroplèthe SVG/D3 (moteur par défaut) passe par le chemin XMLSerializer, sans risque WebGL.

#### Piège 2 — CSS custom properties non résolues dans les SVG sérialisés

Les graphiques SVG maison (pie, line, bar maison) utilisent `var(--accent)` et d'autres custom properties CSS pour leurs couleurs (cf. `pie-chart.ts` DEFAULT_COLORS, `line-chart.ts`). Lorsqu'un SVG est sérialisé via `XMLSerializer` et rendu hors du contexte DOM, **les `var(--*)` ne sont pas résolues** — les formes apparaissent avec des couleurs CSS invalides (généralement transparent ou noir).

**Correction** : avant sérialisation, parcourir les éléments SVG et remplacer les `var(--*)` par leur valeur calculée via `window.getComputedStyle(el).getPropertyValue('--accent')`. Idem pour les attributs `fill`, `stroke`, `color`.

Les polices CSS référencées par `font-family` doivent être converties en `font-family: sans-serif` générique ou embarquées en base64 dans un `<defs>/<style>` inline.

### Ce qui n'est PAS modifié par cet ADR

- L'invariant I-2 (zéro réseau) : pdf-lib est bundlé, aucun endpoint distant.
- L'invariant I-6 (Parquet/Arrow) : le PDF est un export de présentation, pas un format de données.
- Le moteur de rendu des vues (Mosaic + rendu maison) : non impacté.

---

## Alternatives écartées

| Alternative | Raison du rejet |
|-------------|----------------|
| (a) `window.print()` / WebView2 native | Dialogue système → pas de génération 1-clic ; pas de métadonnées programmatiques ; format A4 non contrôlé ; validation dev Linux invalide |
| jsPDF | pdf-lib déjà présent, API plus moderne, pas de raison d'ajouter jsPDF |
| Puppeteer/Playwright headless | Infrastructure serveur, contredit I-4 (pas de serveur) et I-2 (appels réseau) |

---

## Références

- [pdf-lib — API PDFDocument](https://pdf-lib.js.org/docs/api/classes/pdfdocument)
- [MapLibre GL — preserveDrawingBuffer](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/)
- [ADR-011 — Export PDF A4 exigence V1](ADR-011-export-pdf-v1.md)
- [ADR-009 — MapLibre IGN](ADR-009-maplibre-ign.md)
- [ADR-008 — No network](ADR-008-no-network.md)
- [PRD.md §3.4 UC-4, §4.1 V1, §13 R-5](../../PRD.md)
- `src/components/map-libre.ts` — constructeur `maplibregl.Map` (à modifier en B-131)
- `src/components/pie-chart.ts`, `line-chart.ts` — DEFAULT_COLORS avec `var(--accent)`
- `node_modules/pdf-lib/src/api/sizes.ts` — `PageSizes.A4 = [595.28, 841.89]` (portrait) → paysage = `[841.89, 595.28]`
