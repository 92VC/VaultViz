# Nettoyage des anciens modèles non-autoporteurs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supprimer tous les `.vviz` non-autoporteurs et leurs `.parquet`/générateurs, en laissant le seul modèle attendu (`dli_inventaire_autoporteur.vviz`), tests verts et build MSI sain.

**Architecture :** Le modèle de données est désormais l'autoporteur unique (parquet base64 `inline`). On purge l'ancien modèle « .vviz + parquet séparés » ; on repointe le bundle MSI et les 2 tests de schéma sur l'autoporteur ; on nettoie les références docs. Exécution en **3 waves**, Wave 1 parallélisable en sous-agents indépendants (fichiers disjoints).

**Tech Stack :** Tauri 2.x, Rust (DuckDB bundled), Vite + TS, Vitest, Ajv (JSON Schema vviz-v1).

---

## État de départ (déjà fait cette session — NE PAS refaire)

- ✅ **Suppressions effectuées** (`rm -f`) : `examples/DLI/dli_inventaire.vviz` + 17 `dli_*.parquet` ; `examples/{effectifs_2026,demo_dept,controle_gestion,suivi_mensuel}.vviz` + leurs `.parquet` ; `src-tauri/examples/gen_{controle_gestion,demo_dept,suivi_mensuel}.rs`.
- ✅ **`tauri.conf.json`** : `resources` repointé sur `../examples/DLI/dli_inventaire_autoporteur.vviz`.
- ✅ **Conservés** (fixtures/pipeline, PAS des modèles) : `examples/sample.parquet`, `examples/synth_*.parquet`, `examples/fixtures/`, `src-tauri/examples/{gen_fixtures,gen_synth,bench_50mb}.rs`, et la pipeline DLI `examples/DLI/{embed.py,build_dashboard.py,*.xlsx,*.csv}`.
- ⏳ **Travail viz de la session, à committer en Wave 3** : `src/components/pie-chart.ts` (disque responsive), `src/styles/layout.css`, `src/components/line-chart.ts` (libellés X non rognés), `examples/DLI/dli_inventaire_autoporteur.vviz` (camembert `region: main`, `size: 240`, + vue `bars_valeur_manq` en `region: side`).

**Faits de schéma vérifiés** (`schema/vviz-v1.json`) : top-level requis `vviz/data/spec` ; `vviz` requis `version+title` ; `data.sources` `minItems:1`, chaque source `name` + `anyOf(inline|path)`. → L'autoporteur (inline) **valide** et possède `data.sources[0]`, donc il sert de base canonique aux tests de mutation sans fixture supplémentaire.

---

## Wave 1 — Réparations (sous-agents PARALLÈLES, fichiers disjoints)

### Task 1.1 : repointer `examples-valid.test.ts` sur l'autoporteur

**Files:**
- Modify/Test: `src/__tests__/examples-valid.test.ts` (remplacement intégral du `describe`)

- [ ] **Step 1 : Remplacer les 4 `it()` morts par un seul validant l'autoporteur**

Remplacer le bloc `describe(...)` (lignes 22-62) et la fonction `loadExample` (lignes 16-20) par :

```ts
function loadExample(relPath: string): unknown {
  return JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "examples", relPath), "utf8"),
  );
}

describe("examples valides contre schema vviz-v1", () => {
  it("examples/DLI/dli_inventaire_autoporteur.vviz", () => {
    const doc = loadExample("DLI/dli_inventaire_autoporteur.vviz");
    const ok = validate(doc);
    if (!ok) {
      // eslint-disable-next-line no-console
      console.error(validate.errors);
    }
    expect(ok).toBe(true);
  });
});
```

- [ ] **Step 2 : Vérifier ce test seul**

Run: `cd /home/alex/Documents/REPO/VaultViz && npx vitest run src/__tests__/examples-valid.test.ts`
Expected: PASS (1 test).

### Task 1.2 : repointer `schema-validator.test.ts` sur l'autoporteur

**Files:**
- Modify/Test: `src/__tests__/schema-validator.test.ts:16-20` (`SAMPLE_PATH`)

- [ ] **Step 1 : Changer le chemin de l'exemple canonique**

Remplacer (lignes 16-20) :

```ts
const SAMPLE_PATH = path.join(
  REPO_ROOT,
  "examples",
  "effectifs_2026.vviz",
);
```

par :

```ts
const SAMPLE_PATH = path.join(
  REPO_ROOT,
  "examples",
  "DLI",
  "dli_inventaire_autoporteur.vviz",
);
```

- [ ] **Step 2 : Corriger le libellé du 1er `it` (cosmétique, ligne 34)**

Remplacer `"accepte l'exemple canonique effectifs_2026.vviz"` par `"accepte l'exemple canonique dli_inventaire_autoporteur.vviz"`.

- [ ] **Step 3 : Vérifier les 6 tests de mutation**

Run: `cd /home/alex/Documents/REPO/VaultViz && npx vitest run src/__tests__/schema-validator.test.ts`
Expected: PASS (6 tests). Note : la mutation `sources[0].path = "https://evil.com..."` reste rejetée car le `path` https ne matche aucun pattern (UNC/relatif/lettre), même si la source porte déjà `inline`.

### Task 1.3 : nettoyer les références docs aux exemples supprimés

**Files:**
- Modify: `docs/user/format-vviz.md`, `docs/handoff/demo-script.md`

- [ ] **Step 1 : Lister les mentions mortes**

Run: `cd /home/alex/Documents/REPO/VaultViz && grep -nE "effectifs_2026|demo_dept|controle_gestion|suivi_mensuel|dli_inventaire\.vviz" docs/user/format-vviz.md docs/handoff/demo-script.md`

- [ ] **Step 2 : Remplacer chaque mention par l'autoporteur**

Pour chaque occurrence trouvée à l'étape 1, remplacer le nom de fichier mort par `examples/DLI/dli_inventaire_autoporteur.vviz` (et adapter la phrase si elle décrit un « parquet séparé » → « parquet embarqué »). Ne PAS toucher aux docs historiques datés sous `docs/superpowers/plans/` et `docs/superpowers/specs/` (archives immuables).

- [ ] **Step 3 : Vérifier qu'il ne reste plus de mention active**

Run: `cd /home/alex/Documents/REPO/VaultViz && grep -rnE "effectifs_2026|demo_dept|controle_gestion|suivi_mensuel" docs/user docs/handoff`
Expected: aucune sortie.

---

## Wave 2 — Vérification (SÉQUENTIEL, gate après Wave 1)

### Task 2.1 : suite de tests JS complète

- [ ] **Step 1 :** Run: `cd /home/alex/Documents/REPO/VaultViz && npx vitest run`
  Expected: tous les fichiers de tests PASS (aucun `ENOENT` sur un fichier supprimé).

### Task 2.2 : typecheck

- [ ] **Step 1 :** Run: `cd /home/alex/Documents/REPO/VaultViz && npx tsc --noEmit`
  Expected: aucune erreur.

### Task 2.3 : sanité build Rust / bundle

- [ ] **Step 1 : La ressource bundlée existe**

Run: `cd /home/alex/Documents/REPO/VaultViz && test -f examples/DLI/dli_inventaire_autoporteur.vviz && echo OK`
Expected: `OK`.

- [ ] **Step 2 : Compilation Rust (les gen_*.rs supprimés ne sont plus référencés)**

Run: `cd /home/alex/Documents/REPO/VaultViz/src-tauri && cargo check`
Expected: `Finished` sans erreur (pas de `[[example]]` mort dans `Cargo.toml`).

---

## Wave 3 — Finalisation

### Task 3.1 : relancer l'app sur l'autoporteur et confirmer le rendu

**Files:** aucun (run only)

- [ ] **Step 1 : Couper toute instance et relancer**

Run (background): `cd /home/alex/Documents/REPO/VaultViz && pkill -f target/debug/vaultviz; pkill -f "tauri dev"; pkill -f vite; sleep 1; VVIZ_DEFAULT=$PWD/examples/DLI/dli_inventaire_autoporteur.vviz npm run tauri dev > /tmp/dev_vaultviz.log 2>&1 &`

- [ ] **Step 2 : Confirmer le rendu**

Run: `cd /home/alex/Documents/REPO/VaultViz && grep -m1 "rendu OK" /tmp/dev_vaultviz.log`
Expected: ligne `rendu OK docId=d1 (N vues)`. Vérifier à l'écran l'onglet **Bilan comptable** : camembert à gauche (responsive), barres « Valeur manquante par compte » à droite.

### Task 3.2 : commit atomique

**Files:** tout le diff de la session.

- [ ] **Step 1 : Stager + committer**

```bash
cd /home/alex/Documents/REPO/VaultViz
git add -A
git commit -m "$(cat <<'EOF'
chore(examples): purge des modèles non-autoporteurs + viz bilan

- supprime dli_inventaire.vviz + dli_*.parquet, effectifs_2026/demo_dept/
  controle_gestion/suivi_mensuel (.vviz+.parquet) et leurs gen_*.rs
- seul modèle conservé : dli_inventaire_autoporteur.vviz (parquet embarqué)
- tauri.conf.json: bundle repointé sur l'autoporteur
- tests schema/examples repointés sur l'autoporteur
- camembert responsive (disque ~42%), libellés courbe non rognés
- onglet Bilan: camembert en colonne + barres "valeur manquante par compte"

Refs: B-200
EOF
)"
```

- [ ] **Step 2 : Vérifier le commit**

Run: `cd /home/alex/Documents/REPO/VaultViz && git show --stat HEAD | head -40`
Expected: les suppressions + modifs listées, working tree propre (`git status --short` vide).

---

## Plan d'orchestration (waves / sous-agents)

- **Wave 1** : 3 sous-agents en parallèle (Task 1.1, 1.2, 1.3) — fichiers disjoints, aucune dépendance partagée.
- **Wave 2** : séquentiel, barrière après Wave 1 (les tests dépendent des 3 réparations).
- **Wave 3** : séquentiel après Wave 2 vert (relance puis commit).

## Self-Review

- **Couverture spec** : suppressions (fait) ✓ ; build (Task 2.3, conf déjà repointée) ✓ ; tests (1.1/1.2/2.1) ✓ ; docs (1.3) ✓ ; viz session committée (3.2) ✓.
- **Placeholders** : aucun — code et commandes complets.
- **Cohérence types** : `loadExample(relPath)` accepte un chemin relatif avec sous-dossier (`DLI/...`) ; `SAMPLE_PATH` utilise les mêmes segments `path.join`. Cohérent.
