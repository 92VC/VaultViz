# Handoff — Package pilote MECM VaultViz V1 (B-180)

| Champ | Valeur |
|---|---|
| Story | B-180 |
| Statut | Artefact produit — déploiement et identification panel = acte DSI/sponsor (hors scope produit) |
| Auteur produit | A. Bergé (ab@alexandre-berge.fr) |
| Date | 2026-05-31 |
| Référence | [ADR-005 — Signature DSI hors scope](../adr/ADR-005-signature-dsi.md) |
| Dépend de | [docs/deploy.md](../deploy.md) (MSI signé disponible), [docs/user/user.md](../user/user.md) (doc utilisateur) |

---

## Frontière : acte humain attendu (hors scope produit)

> Ce document fournit les instructions et modèles nécessaires au déploiement pilote.
> L'identification du panel de cadres, la configuration MECM/Intune, le push effectif et le canal de retour sont des **actes DSI / sponsor**, hors scope produit.
>
> **Actes attendus** :
> - **Sponsor** : désigner le panel de 10-20 cadres pilotes (`<panel à désigner par le sponsor>`)
> - **DSI** : configurer le package MECM/Intune avec les arguments ci-dessous et effectuer le push silencieux sur les postes identifiés
> - **DSI** : notifier les pilotes par email (modèle §4)
> - **DSI** : ouvrir le canal de retour (§5)

---

## 1. Pré-requis au déploiement pilote

Avant tout push MECM, s'assurer que :

| Condition | Source | Statut |
|---|---|---|
| MSI signé disponible | [docs/deploy.md §2](../deploy.md) | `[!]` en attente signature DSI (B-150) |
| SHA-256 du MSI vérifié | `msi-sha256.txt` joint à la release | À vérifier avant push |
| Avis RSSI préliminaire favorable | [docs/handoff/dsi-signing-package.md](dsi-signing-package.md) | `[!]` en attente décision |
| Panel pilote désigné | §2 ci-dessous | `[!]` en attente sponsor |
| Doc utilisateur disponible | [docs/user/user.md](../user/user.md) | [x] livré |

---

## 2. Identification du panel pilote

**Panel cible** : `<panel à désigner par le sponsor>`

Critères de sélection recommandés (à trancher avec le sponsor) :

| Critère | Recommandation |
|---|---|
| Taille | 10 à 20 cadres ([PRD §16 Q5](../../PRD.md)) |
| Profils | Mix contrôleurs de gestion + cadres métier (représentatifs de la persona Camille) |
| Postes | Windows 11 managés MECM standards — pas de postes dérogés |
| Périmètre géo | À définir par le sponsor (un service, un secteur, multi-sites ?) |
| Disponibilité | Cadres informés et disponibles pour retour sous _N semaines_ |

> **Acte sponsor** : remplir le tableau ci-dessous et le retourner à l'équipe produit.

| # | Nom | Rôle / Service | Identifiant poste MECM | Email |
|---|---|---|---|---|
| 1 | _________________________ | _________________________ | _________________________ | _________________________ |
| 2 | _________________________ | _________________________ | _________________________ | _________________________ |
| … | (répéter jusqu'à 20) | | | |

---

## 3. Instructions de déploiement MECM/Intune (push silencieux)

> **Acte DSI** — configuration et push effectif.

### 3.1 Paramètres d'installation MSI

| Paramètre | Valeur |
|---|---|
| Commande d'installation silencieuse | `msiexec /i "VaultViz_X.Y.Z_x64_en-US.msi" /quiet /norestart` |
| Commande de désinstallation silencieuse | `msiexec /x {6C594A1B-6917-44C8-9FA9-13394A781EE9} /quiet /norestart` |
| WiX Upgrade GUID | `6C594A1B-6917-44C8-9FA9-13394A781EE9` |
| Redémarrage requis | Non |
| Droits requis | Administrateur local (standard MECM) |
| Espace disque estimé | ~50 Mo (bundle Tauri + WebView2 si déjà présent) |

### 3.2 Détection de présence

Clé de registre créée à l'installation :
```
HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{6C594A1B-6917-44C8-9FA9-13394A781EE9}
```
Valeur : `DisplayName` = `VaultViz`

### 3.3 Association fichier

L'installation crée automatiquement l'association `.vviz` → `VaultViz.exe`. Aucune GPO supplémentaire n'est requise, sauf si la politique de site bloque les associations de type MIME personnalisées.

### 3.4 Dépendance WebView2

VaultViz requiert **Microsoft Edge WebView2 Runtime** (fourni par défaut sur Windows 11). Si des postes en sont dépourvus (déploiements hors-standards), le runtime peut être pré-installé via MECM avant VaultViz.

### 3.5 Logs d'installation

Les logs MSI peuvent être activés pour diagnostic :
```
msiexec /i "VaultViz_X.Y.Z_x64_en-US.msi" /quiet /norestart /l*v "%TEMP%\vaultviz-install.log"
```

---

## 4. Communication aux pilotes

### 4.1 Modèle d'email — Notification installation

> À envoyer par le sponsor ou la DSI aux cadres du panel, après le push MECM.

---

**Objet** : [VaultViz] Accès à votre outil de visualisation de données — action requise

Bonjour,

Dans le cadre du projet VaultViz, vous avez été sélectionné(e) comme pilote pour tester notre nouvel outil de visualisation de tableaux de bord.

**VaultViz vient d'être installé automatiquement sur votre poste.** Aucune action d'installation de votre part n'est nécessaire.

**Pour démarrer :**
1. Ouvrez l'Explorateur Windows
2. Double-cliquez sur un fichier `.vviz` partagé par votre référent données
3. Le tableau de bord s'affiche directement

**Documentation :** Le guide utilisateur est disponible ici : [insérer lien ou chemin réseau vers `docs/user/user.md`]

**Vos retours comptent.** Après 2 semaines d'utilisation, vous recevrez une courte grille de retour (5 min). Vos observations permettront d'améliorer l'outil.

En cas de question ou difficulté : contactez `<contact DSI / hotline>`.

Cordialement,
_[Nom du sponsor]_
_[Direction / Service]_

---

### 4.2 Ressource utilisateur à joindre ou partager

Lien vers le guide : **[docs/user/user.md](../user/user.md)**

Le guide couvre :
- Ouvrir un fichier `.vviz`
- Exporter en PDF / PNG / CSV
- Réagir à la bannière « Données mises à jour »
- Que faire en cas d'erreur

---

## 5. Canal de retour terrain

> **Acte DSI/sponsor** : ouvrir et opérer ce canal.

| Élément | À définir par DSI/sponsor |
|---|---|
| Hotline / contact premier niveau | `<contact DSI>` |
| Canal de retour écrit | `<email ou formulaire à définir>` |
| Délai de retour demandé aux pilotes | `<N semaines après installation>` |
| Référent produit pour escalade | A. Bergé (ab@alexandre-berge.fr) |

Les retours collectés alimenteront l'instrument de collecte terrain → [docs/handoff/feedback-collection.md](feedback-collection.md).

---

## 6. Checklist déploiement pilote (DSI)

- [ ] MSI signé téléchargé et SHA-256 vérifié
- [ ] Package MECM/Intune créé avec les paramètres §3.1
- [ ] Test d'installation sur 1 poste non-pilote avant push (smoke test)
- [ ] Panel pilote finalisé par le sponsor (§2)
- [ ] Push MECM effectué sur les postes du panel
- [ ] Email de notification envoyé aux pilotes (§4.1)
- [ ] Canal de retour ouvert (§5)
- [ ] Date de début de collecte arrêtée

---

## 7. Références

- [docs/deploy.md](../deploy.md) — procédure CI → signature → déploiement (B-150)
- [docs/handoff/dsi-signing-package.md](dsi-signing-package.md) — caractéristiques techniques MSI pour DSI
- [docs/handoff/feedback-collection.md](feedback-collection.md) — collecte retours terrain (B-181)
- [docs/user/user.md](../user/user.md) — guide utilisateur cadres
- [ADR-005](../adr/ADR-005-signature-dsi.md) — signature et déploiement hors scope produit
- [PRD.md §12.2](../../PRD.md) — critères de succès V1 → déploiement large
- [PRD.md §16 Q5](../../PRD.md) — question ouverte panel pilote
