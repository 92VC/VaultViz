# Licence des données géographiques de référence

## Fichiers concernés

- `ref/departements.topojson` — contours des départements français métropolitains (96 départements, Corse incluse)

## Source

Les données géographiques sont dérivées du référentiel **IGN ADMIN EXPRESS COG** (Coordonnées Géographiques) produit et diffusé par l'Institut national de l'information géographique et forestière (IGN).

Source intermédiaire utilisée pour ce dépôt : `src/assets/departements-v0.geojson` — extrait des contours départementaux issu du référentiel IGN ADMIN EXPRESS, simplifié et converti au format TopoJSON via mapshaper (voir `scripts/build-geo.sh`).

## Licence Ouverte / Etalab 2.0

Ces données sont mises à disposition sous **Licence Ouverte version 2.0** (Etalab), conformément aux conditions de réutilisation du référentiel ADMIN EXPRESS COG de l'IGN.

> **Producteur de données** : Institut national de l'information géographique et forestière (IGN) — [www.ign.fr](https://www.ign.fr)
>
> **Référentiel d'origine** : ADMIN EXPRESS COG — [geoservices.ign.fr](https://geoservices.ign.fr/adminexpress)

Texte complet de la licence : [https://www.etalab.gouv.fr/licence-ouverte-open-licence/](https://www.etalab.gouv.fr/licence-ouverte-open-licence/)

### Conditions de la Licence Ouverte / Etalab 2.0

Le Réutilisateur est libre de :
- **reproduire**, **copier**, **publier** et **transmettre** l'Information ;
- **diffuser** et **redistribuer** l'Information ;
- **adapter**, **modifier**, **extraire** et **transformer** l'Information, notamment pour créer des Informations dérivées ;
- **exploiter** l'Information à titre commercial.

Sous réserve de :
- mentionner la **paternité** de l'Information : sa source et la date de sa dernière mise à jour.

## Note sur la couverture

Les fichiers présents couvrent la **France métropolitaine** (96 départements, codes 01-95 + 2A + 2B).
Les **Départements et Régions d'Outre-Mer** (971 Guadeloupe, 972 Martinique, 973 Guyane, 974 La Réunion, 976 Mayotte) ne sont **pas inclus** dans `departements-v0.geojson` source. Pour les intégrer, utiliser la procédure de régénération complète depuis l'IGN ADMIN EXPRESS COG documentée dans `scripts/build-geo.sh`.

Un fichier `ref/regions.topojson` n'est **pas produit** : la source `departements-v0.geojson` ne contient que les champs `code` et `nom` des départements, sans code région (`code_reg`), ce qui ne permet pas l'agrégation en régions. La production de `ref/regions.topojson` nécessite le shapefile REGION de l'IGN ADMIN EXPRESS COG (voir `scripts/build-geo.sh`, bloc « REFRESH IGN »).

---

*Dernière mise à jour du référentiel local : voir le commit git associé.*
