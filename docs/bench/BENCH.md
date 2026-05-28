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
