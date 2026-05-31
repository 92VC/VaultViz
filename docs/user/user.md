# VaultViz — Guide utilisateur

> Version 1.0 · Public : cadres non-techniciens · Support : `<contact DSI>`

---

## Ouvrir un fichier `.vviz`

Un fichier `.vviz` est un tableau de bord prêt à l'emploi. Pour l'ouvrir :

- **Double-clic** sur le fichier depuis l'Explorateur Windows — VaultViz démarre directement.
- **Glisser-déposer** le fichier sur la fenêtre VaultViz déjà ouverte.
- **Menu Fichier › Ouvrir** (ou `Ctrl+O`) puis sélectionner le fichier dans le dialog.

L'application est **locale** : aucune connexion Internet n'est établie, les données restent sur le réseau interne de la CPAM.

---

## Exporter les données ou le tableau de bord

Trois formats d'export sont disponibles depuis la barre d'outils en haut de la fenêtre :

| Bouton | Format | Usage |
|--------|--------|-------|
| **PDF** | A4 portrait | Imprimer ou archiver le tableau de bord tel qu'affiché |
| **PNG** | Image | Copier une capture dans le presse-papiers ou enregistrer un fichier |
| **CSV** | Tableur (UTF-8) | Ouvrir les données dans Excel ou un autre tableur |

Le CSV utilise le point-virgule (`;`) comme séparateur — compatible Excel en paramètres français.

---

## Bannière « Données mises à jour — Recharger »

Cette bannière apparaît lorsque les données sur le partage réseau ont changé depuis l'ouverture du fichier.

- **Recharger** : recharge immédiatement les données fraîches. L'affichage se met à jour.
- **Ignorer** : ferme la bannière ; les données actuelles restent affichées jusqu'à fermeture manuelle et réouverture.

> La mise à jour n'est **jamais automatique** : vous gardez le contrôle.

---

## En cas d'erreur

VaultViz affiche un message lisible décrivant le problème, par exemple :

- *« Fichier introuvable »* — le fichier `.vviz` ou le Parquet sur le partage n'est plus accessible.
- *« Fichier corrompu »* — le fichier `.vviz` n'est pas un JSON valide.
- *« Données manquantes »* — un champ attendu par la visualisation est absent de la source.

**Que faire ?**

1. Notez le message affiché (ou faites une capture d'écran).
2. Contactez votre référent DSI : `<contact DSI>`.

Les journaux techniques sont conservés automatiquement dans `%LOCALAPPDATA%\VaultViz\logs\` pour faciliter le diagnostic par la DSI.
