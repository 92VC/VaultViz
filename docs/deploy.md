# VaultViz — Procédure de jonction CI → Signature DSI → Déploiement MECM (B-150)

| Champ | Valeur |
|---|---|
| Story | B-150 |
| Statut | Artefact produit — acte DSI en attente (hors scope produit) |
| Auteur produit | A. Bergé (ab@alexandre-berge.fr) |
| Date | 2026-05-31 |
| Référence | [ADR-005 — Signature DSI hors scope](adr/ADR-005-signature-dsi.md) |

---

## Frontière : acte humain attendu (hors scope produit)

> Ce document décrit **ce que l'équipe produit a livré** et **ce que la DSI doit faire**.
> La signature du MSI, la configuration de la PKI, le push via MECM/Intune sont des actes **exclusivement DSI**, conformément à [ADR-005](adr/ADR-005-signature-dsi.md). L'équipe produit s'arrête au MSI signable et à ce document.
>
> **Acte attendu côté DSI** : signer le MSI selon la PKI interne, valider l'installation sur un poste pilote AppLocker/WDAC, puis déployer via MECM/Intune sur le panel pilote (B-180).

---

## 1. Vue d'ensemble du pipeline

```
[Équipe produit]                         [DSI CPAM 92]
      │                                        │
  git tag vX.Y.Z                               │
      │                                        │
  GitHub Actions (release.yml)                 │
  ├─ Build MSI sur windows-latest              │
  ├─ SBOM Rust (cargo-audit)                   │
  ├─ SBOM npm (npm audit)                      │
  └─ SHA-256 du MSI (msi-sha256.txt)           │
      │                                        │
  GitHub Release (repo privé 92VC/VaultViz)    │
      │ ◄─────────── point de jonction ──────► │
      │                                        │
                                      Télécharge MSI + SBOM
                                      Signe avec PKI interne
                                      Teste sur poste AppLocker
                                      Déploie via MECM/Intune
```

---

## 2. Où récupérer le MSI signable

### 2.1 Source des artefacts CI

- **Repository** : `92VC/VaultViz` (GitHub privé CPAM, [PRD §16](../PRD.md))
- **URL releases** : `https://github.com/92VC/VaultViz/releases`
- **Artefacts produits par la CI** (workflow `.github/workflows/release.yml`) :

| Artefact | Fichier | Description |
|---|---|---|
| MSI Windows 11 x64 | `VaultViz_X.Y.Z_x64_en-US.msi` | Bundle principal à signer |
| Installeur NSIS (EXE) | `VaultViz_X.Y.Z_x64-setup.exe` | Alternatif NSIS |
| Hash SHA-256 | `msi-sha256.txt` | À vérifier avant signature |
| SBOM Rust | `audit-rust.json` | Liste dépendances Rust (cargo-audit) |
| SBOM npm | `audit-npm.json` | Liste dépendances JS (npm audit) |

### 2.2 Tag de la release à signer

- Le tag `v0.0.1-rc8` est la dernière release candidate disponible à la date de ce document.
- La release stable V1 sera taguée `v1.0.0` à l'issue du Go/No-Go V0 confirmé.
- Les releases candidates (tag contenant `-rc`, `-alpha`, `-beta`) sont marquées `prerelease` sur GitHub.

### 2.3 Vérification d'intégrité (obligatoire)

Avant signature, la DSI doit vérifier le SHA-256 du MSI :

```powershell
# PowerShell Windows
Get-FileHash -Algorithm SHA256 "VaultViz_X.Y.Z_x64_en-US.msi"
# Comparer avec la valeur dans msi-sha256.txt joint à la release
```

---

## 3. Caractéristiques techniques pour la DSI

Pour le détail complet des caractéristiques (identifiants, surface réseau, capabilities Tauri 2, logs, désinstallation), voir :

> **[docs/handoff/dsi-signing-package.md](handoff/dsi-signing-package.md)** — document de référence DSI (B-072)

Résumé des points clés PSSI :

| Point | Valeur |
|---|---|
| Bundle identifier | `fr.cpam92.vaultviz` |
| WiX Upgrade GUID | `6C594A1B-6917-44C8-9FA9-13394A781EE9` (stable) |
| Ports réseau | **Aucun** — vérifiable via `netstat -ano` |
| Appels sortants | **Aucun** — pas de télémétrie, pas d'updater ([ADR-008](adr/ADR-008-no-network.md)) |
| Permissions fichier | **Lecture seule** — pas de `write`/`delete` déclarés |
| Logs | `%LOCALAPPDATA%\VaultViz\logs\` — locaux, sans PII |

---

## 4. Ce que la DSI doit faire (acte externe)

> **Hors scope produit** — l'équipe VaultViz ne peut pas réaliser ces étapes.

1. **Identifier le point de contact** PSSI/AppLocker/MECM chargé de la signature (cf. [PRD §16 Q2](../PRD.md)).
2. **Télécharger** le MSI + `msi-sha256.txt` depuis la release GitHub privée.
3. **Vérifier le SHA-256** du MSI (étape §2.3 ci-dessus).
4. **Signer le MSI** avec le certificat CPAM 92 (PKI interne) selon la procédure standard de signature de code Windows (`signtool.exe` ou équivalent DSI).
5. **Tester l'installation** sur un poste pilote Windows 11 protégé AppLocker / WDAC :
   - Installation silencieuse : `msiexec /i VaultViz_X.Y.Z_x64_en-US.msi /quiet`
   - Vérification de l'association `.vviz`
   - Test d'ouverture du fichier `examples/DLI/dli_inventaire_autoporteur.vviz`
   - Vérification réseau : `netstat -ano` → aucun port en écoute
6. **Retourner** à l'équipe produit (`ab@alexandre-berge.fr`) :
   - Succès : MSI signé + confirmation compatibilité AppLocker
   - Refus motivé : ajustements à identifier (risque R-1 PRD §13)

---

## 5. Cycle d'itération CI → DSI

Pour chaque nouvelle version :

```
1. L'équipe produit pousse un tag vX.Y.Z (ex. git tag v1.0.1 && git push origin v1.0.1)
2. La CI génère automatiquement le MSI + SBOM (release.yml, ~10-15 min)
3. La DSI est notifiée (par mail ou ticket ITSM, selon procédure interne CPAM 92)
4. La DSI télécharge, vérifie, signe et pousse via MECM/Intune
```

**Délai cible** (à définir avec la DSI lors de la coordination B-150) : nouvelle version CI → MSI signé déployé ≤ _N jours_ (placeholder à remplir avec la DSI).

---

## 6. Intégration future de la signature dans la CI (optionnel)

Si la DSI souhaite automatiser la signature dans le workflow GHA, l'équipe produit peut ajouter un step `signtool.exe` dans `release.yml` (stockage sécurisé du certificat = responsabilité DSI / HSM). Cette décision est **hors scope produit actuel** — à trancher avec la DSI.

---

## 7. Références

- [docs/handoff/dsi-signing-package.md](handoff/dsi-signing-package.md) — package DSI complet (B-072)
- [docs/handoff/mecm-pilot-package.md](handoff/mecm-pilot-package.md) — déploiement pilote (B-180)
- [docs/adr/ADR-005-signature-dsi.md](adr/ADR-005-signature-dsi.md) — décision signature hors scope
- [docs/adr/ADR-008-no-network.md](adr/ADR-008-no-network.md) — local-first strict
- `.github/workflows/release.yml` — source de la CI qui produit le MSI
- [PRD.md §12.2](../PRD.md) — critères de succès V1 → déploiement large
