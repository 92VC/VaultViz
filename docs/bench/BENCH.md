# BENCH.md — Mesures performance VaultViz V0

Ce document consigne les mesures de référence (taille binaire, RAM idle, temps de chargement) au fil des stories du backlog.

La cible de production étant **Windows 11 exclusivement** (ADR-010), les valeurs Linux ci-dessous servent uniquement de proxy pour la dérive locale et ne préjugent pas du gabarit MSI final mesuré en B-070/B-071.

---

## B-010 — Taille binaire skeleton

| Plateforme       | Cible                          | Taille     | Date       | Commentaire                              |
|------------------|--------------------------------|------------|------------|------------------------------------------|
| Linux x86_64     | `cargo build --release`        | 11 Mo      | 2026-05-28 | Skeleton Tauri 2 + tauri-plugin-fs vide. |
| Windows x86_64   | MSI signé (à venir)            | —          | —          | Sera mesuré en B-070 (CI MSI GHA).       |

Versions verrouillées dans les lockfiles (cf. `Cargo.lock`, `package-lock.json`) :

| Composant                | Version  |
|--------------------------|----------|
| `tauri`                  | 2.11.2   |
| `tauri-build`            | 2.6.2    |
| `tauri-plugin-fs`        | 2.5.1    |
| `wry`                    | 0.55.1   |
| `tao`                    | 0.35.3   |
| `@tauri-apps/api`        | 2.11.0   |
| `@tauri-apps/cli`        | 2.11.2   |
| `vite`                   | 5.4.21   |
| `typescript`             | 5.6.x    |
| Rust toolchain           | stable (≥ 1.75) |

Reproduction :

```bash
# côté front
npm install
npm run build   # produit dist/

# côté core
cd src-tauri
cargo build --release
du -h target/release/vaultviz
```

---

## B-020 — Taille binaire avec DuckDB bundled

| Plateforme | Cible | Taille | Date | Commentaire |
|---|---|---|---|---|
| Linux x86_64 | `cargo build --release` (binaire `vaultviz`) | 11 Mo | 2026-05-28 | Inchangé tant que `main.rs` ne référence pas DuckDB — le linker dead-strip. |
| Linux x86_64 | Binaire de test `target/release/deps/duck_smoke-*` | **45 Mo** | 2026-05-28 | **Mesure représentative** : ce binaire lie statiquement DuckDB embarqué (cf. ADR-001). |
| Linux x86_64 | rlib `libvaultviz_lib.rlib` | 16 Mo | 2026-05-28 | Bibliothèque intermédiaire avec symboles DuckDB préservés. |
| Linux x86_64 | staticlib `libvaultviz_lib.a` | 92 Mo | 2026-05-28 | Archive avec toute la profondeur DuckDB + Arrow + Tauri. Indicatif uniquement. |
| Windows x86_64 | MSI signé | — | — | Sera mesuré en B-070 (CI MSI GHA). |

**Delta brut** : binaire skeleton 11 Mo → binaire de test (avec DuckDB statique) 45 Mo, soit **+34 Mo**. Le binaire `vaultviz` Tauri final intégrera ce surcoût dès que `run_query` sera enregistré (B-022) — il faudra remesurer alors.

**Cible PRD §9.1** : MSI < 30 Mo en V1. Delta 34 Mo > 30 Mo → **R-3 (taille MSI) à escalader** dès Wave 7 si la mesure Windows confirme le ratio. Pistes V1 :
- features DuckDB minimales (sans `icu`, `json`, `tpch`, `tpcds`) ;
- strip + UPX (compatible AppLocker à vérifier) ;
- `lto = "fat"` et `codegen-units = 1` dans `[profile.release]` (gain typique 10-20 %).

**Note** : le binaire Linux n'est pas la cible production (Windows MSI ADR-010), mais sert d'indicateur. Mesure Windows à reproduire en B-070.

Versions verrouillées (Cargo.lock) ajoutées par B-020 :

| Composant | Version |
|---|---|
| `duckdb` | 1.10503.1 |
| `libduckdb-sys` | 1.10503.1 |
| `arrow` (réexporté via `duckdb::arrow`) | 58.3.0 |

Reproduction :

```bash
cd src-tauri
cargo test --release --test duck_smoke  # compile DuckDB ~4 min première fois
ls -la target/release/vaultviz \
       target/release/deps/duck_smoke-* \
       target/release/libvaultviz_lib.rlib
```

---

## B-023 — Bench Parquet 50 Mo (synthétique Linux NVMe)

**Méthode** : Parquet synthétique généré via
`docs/scripts/gen-synth-parquet.sh 50` (substitut au CLI `duckdb`
non installé : passe par un binaire Rust `examples/gen_synth.rs` qui
utilise le crate `duckdb` bundled). Bench via
`docs/scripts/bench-50mb.sh` (compile + lance `examples/bench_50mb.rs`
sous `/usr/bin/time -v` pour RAM peak).

**Cible PRD §9.1 V0** : premier rendu < 3 s sur Parquet 50 Mo.

**Note** : substitut au bench SMB CPAM réel (reporté V1, cf. ci-dessous).
Le bench Linux NVMe est plus rapide que SMBv3 LAN, mais sert de
plancher utile et valide qu'aucun goulot algorithmique ne se cache.

### Résultats — run du 2026-05-28 (Fedora 43, x86_64)

| Paramètre | Valeur |
|---|---|
| Taille parquet | **48 Mo** (50 344 955 octets, 950 000 lignes, Snappy) |
| Schéma | id INT64, code_dept INT32, lib_dept VARCHAR, effectif DOUBLE, taux DOUBLE, jour DATE, categorie VARCHAR, hash VARCHAR(md5) |
| CPU | Fedora 43, multi-cœurs (588 % d'usage observé → ~6 cœurs en parallèle DuckDB) |
| Storage | NVMe local |

| Query | Temps elapsed | RAM peak (process complet) | Statut vs cible 3 s |
|---|---|---|---|
| `SELECT COUNT(*) FROM …`               | **7.9 ms**  | 50 Mo | **vert** large (× 380) |
| `GROUP BY code_dept` (AVG+COUNT)       | **10.4 ms** | 50 Mo | **vert** large (× 290) |
| `Filter (jour > …) + AVG GROUP BY`     | **10.2 ms** | 50 Mo | **vert** large (× 290) |

Log brut : `docs/bench/run-50mb-linux-20260528.log`. *(Versionné via
`git add -f` car le `.gitignore` exclut `*.log`. Refaire un `git add -f`
à chaque nouveau run de bench.)*

**Observations** :
- DuckDB push-down + parallélisme SIMD assurent une marge énorme sur la
  cible PRD ; le goulot ne sera pas le SQL côté serveur mais le transit
  Arrow IPC (B-080 mesurera 300 Mo).
- RAM peak du process complet ≈ 50 Mo, soit ~la taille du Parquet
  scanné — DuckDB ne *charge pas* tout le Parquet en mémoire (lecture
  streaming par row group), c'est le coût de boot + structures internes.
- Cible PRD V1 « RAM stable < 400 Mo en idle » très largement tenue.

**Statut Hybride (cf. plan §0.3)** :
- [x] Mesure temps ouverture → `SELECT COUNT(*)` < 3 s ✓ (sur synthétique, pas SMB réel)
- [x] Mesure RAM stable < 400 Mo ✓
- [!] Mesures SMB CPAM réel : reporté V1 (handoff documenté)
- [x] Comparaison local NVMe documentée ✓

**SMB CPAM réel** : à reproduire en V1 dans le cadre du pilote
(handoff `docs/handoff/dsi-signing-package.md` à créer en Wave 7). Le
delta attendu local NVMe → SMBv3 LAN est de l'ordre de 5-20× sur la
latence d'ouverture, principalement à cause du temps de négociation
SMB et de la fragmentation des reads par row group. Cible de
**marge × 100** (10 ms × 100 = 1 s) reste largement dans le budget 3 s.

---

## B-050 — Drill-down dept → table virtualisée (UC-1 complet)

**Méthode** : ouverture de l'app en `cargo tauri dev` (Linux NVMe,
ext4, Parquet `examples/synth_50mb.parquet`, 950 000 lignes), clic
département Hauts-de-Seine (`code_dept = '92'`) sur la carte
choroplèthe, mesure du délai clic → table peuplée via
`performance.now()` côté front.

| Mesure                                       | Cible V0   | Cible V1   | Statut                          |
|----------------------------------------------|------------|------------|---------------------------------|
| Clic dept → table 5000 lignes peuplée        | < 3 s      | < 1 s      | À mesurer en Wave 8 (B-080)     |
| 1er render table 5000 lignes (Arrow → DOM)   | < 1 s      | < 500 ms   | À mesurer en Wave 8 (B-080)     |
| Re-query DuckDB filtré WHERE code_dept = ... | proxy 50 Mo ≈ 10 ms (cf. B-023) | idem | extrapolé vert |

**Notes** :

- Bench Tauri dev non reproductible dans un subagent (besoin GUI
  WebView2 sur Windows, ou GTK WebKit sur Linux). La mesure réelle
  sera consignée par le contrôleur lors de Wave 8 (B-080 — bench
  300 Mo) avec instrumentation `performance.now()` dans
  `renderCrossFilterDashboard()` (src/main.ts).
- La virtualisation côté JS rend une fenêtre fixe d'environ 30 lignes
  indépendamment de `numRows` ; le coût render DOM est borné à O(1)
  par scroll event, indépendant du dataset → les tests unitaires
  (`src/__tests__/table-view.test.ts`) le couvrent (10 000 lignes →
  moins de 50 `<div class="vv-tr">` rendues).
- Le re-query DuckDB filtré bénéficie du push-down de prédicat sur
  Parquet (row group pruning par statistiques min/max), donc le drill
  sera proportionnellement plus rapide que le COUNT global déjà
  mesuré 7,9 ms.

