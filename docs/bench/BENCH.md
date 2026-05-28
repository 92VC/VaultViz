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
