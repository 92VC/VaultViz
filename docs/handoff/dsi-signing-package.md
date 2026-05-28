# Handoff — Signature MSI VaultViz par DSI CPAM 92 (B-072)

| Champ | Valeur |
|---|---|
| Story | B-072 |
| Statut | `[!]` Bloqué — point de contact DSI à identifier (PRD §16 Q2) |
| Auteur produit | A. Bergé (ab@alexandre-berge.fr) |
| Date | 2026-05-28 |

---

## 1. Objet du ticket

Demander à la DSI CPAM 92 la **signature de code** du MSI `VaultViz_0.0.1_x64_en-US.msi` selon les procédures internes en vigueur (PKI interne, AppLocker, MECM/Intune).

La signature et le déploiement parc relèvent **exclusivement de la DSI** ([ADR-005](../adr/ADR-005-signature-dsi.md)). Le produit s'arrête au MSI signable livré ici.

## 2. Livrables produits par l'équipe VaultViz

| Artefact | Source | Description |
|---|---|---|
| **MSI v0.0.1-rc1** | Release GitHub privée `92VC/VaultViz` (à tagger : `v0.0.1-rc1`) | Bundle Windows 11 généré par tauri-bundler via GHA windows-latest |
| **SHA-256 du MSI** | `msi-sha256.txt` joint à la release | Intégrité de l'artefact |
| **SBOM Rust** | `audit-rust.json` (cargo-audit) | Liste dépendances Rust + vulnérabilités connues |
| **SBOM npm** | `audit-npm.json` (npm audit) | Liste dépendances JS + vulnérabilités connues |
| **Notes de version** | GitHub Release auto-générée | Commits + PRs incluses |

## 3. Caractéristiques techniques pour validation DSI

### 3.1 Identifiants

| Champ | Valeur |
|---|---|
| Bundle identifier | `fr.cpam92.vaultviz` |
| WiX Upgrade GUID | `6C594A1B-6917-44C8-9FA9-13394A781EE9` (stable) |
| Cible plateforme | Windows 11 x64 ([ADR-010](../adr/ADR-010-windows-11-only.md)) |
| Éditeur | CPAM 92 |
| Catégorie | Productivity |
| Langues installeur | fr-FR (principal), en-US |
| Association fichier | `.vviz` (MIME `application/x.vviz+json`) |

### 3.2 Surface réseau

- **Aucun port ouvert** en écoute. Vérifiable via `netstat -ano` après installation.
- **Aucun appel sortant** au démarrage ni en fonctionnement. Vérifiable via Process Monitor / Wireshark.
- Pas d'updater applicatif intégré ([ADR-008](../adr/ADR-008-no-network.md)).
- Pas de télémétrie, pas de phone-home.

### 3.3 Capabilities déclarées (Tauri 2)

Fichier source : `src-tauri/capabilities/main.json`.

```json
{
  "identifier": "main-capability",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "fs:default",
    "fs:allow-read-text-file ($HOME, $DOCUMENT, $DESKTOP, $DOWNLOAD, $APPLOCALDATA)",
    "fs:allow-read-file (idem scope)",
    "fs:allow-exists (idem scope)"
  ]
}
```

- **Lecture seule** strict. Aucune permission write/delete déclarée.
- Scope à étendre au déploiement avec `//<host>/<share>/**` (variable par site).

### 3.4 Logs

- Local uniquement : `%LOCALAPPDATA%\VaultViz\logs\YYYY-MM-DD.log`
- Rotation 7 jours, plafond 50 Mo
- Aucune PII journalisée (helper `assert_no_pii` testé)
- MECM peut collecter ces logs si la DSI le souhaite

### 3.5 Désinstallation

- MSI propre, désinstallation via Apps & Features ou MECM
- Pas de modification registre hors clé d'association `.vviz`
- Cache local effacé à la désinstallation

## 4. Demandé à la DSI

1. **Identification du point de contact PSSI/AppLocker/MECM** pour la coordination signature.
2. **Test de signature** avec le certificat CPAM 92 (PKI interne) selon la procédure standard.
3. **Test d'installation** sur poste pilote Windows 11 protégé AppLocker / WDAC.
4. **Retour** par mail à `ab@alexandre-berge.fr` :
   - MSI signé OK → joindre l'artefact signé pour intégration au workflow GHA
   - Refus motivé → ajustements à identifier (`R-1` PRD §13)

## 5. Risques connus

| ID | Risque | Mitigation produit |
|---|---|---|
| R-1 | MSI non signable par procédures DSI standard | Livraison V0 dédiée (cette story) pour validation rapide |
| R-9 | Tauri 2 → 3 breaking changes | Verrouillage `Cargo.lock` ; migration planifiée |

## 6. Procédure côté équipe VaultViz après retour DSI

- **Si signé** :
  - Inclure le certificat / procédure dans le workflow GHA `release.yml` (ajout step `signtool.exe`)
  - Tagger `v0.0.1` (release stable)
  - Story B-082 (Go/No-Go V0) débloquable
- **Si refusé** :
  - Documenter le motif dans un amendement PRD
  - Ajuster `tauri.conf.json` ou pipeline GHA selon retour
  - Re-livrer un MSI v0.0.1-rc2

## 7. Contacts

- **Produit** : A. Bergé (ab@alexandre-berge.fr)
- **DSI CPAM 92** : *à identifier* — point ouvert PRD §16 Q2

## 8. Pièces jointes (à fournir au ticket DSI une fois la release tagguée)

- [ ] Lien release GitHub privée `v0.0.1-rc1`
- [ ] Hash SHA-256 du MSI (depuis `msi-sha256.txt`)
- [ ] `audit-rust.json` (SBOM Rust)
- [ ] `audit-npm.json` (SBOM npm)
- [ ] Ce document (`dsi-signing-package.md`)
- [ ] [ADR-005](../adr/ADR-005-signature-dsi.md), [ADR-008](../adr/ADR-008-no-network.md), [ADR-010](../adr/ADR-010-windows-11-only.md) pour contexte
