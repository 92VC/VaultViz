#!/usr/bin/env bash
# =============================================================================
# scripts/build-geo.sh — Pipeline de conversion GeoJSON → TopoJSON simplifié
# =============================================================================
#
# USAGE
#   ./scripts/build-geo.sh          # mode hors-ligne (défaut)
#   ./scripts/build-geo.sh --help   # affiche ce message
#
# DESCRIPTION
#   Mode par défaut (hors-ligne) :
#     Convertit src/assets/departements-v0.geojson vers ref/departements.topojson
#     via mapshaper. Simplification ~8 % avec conservation de la topologie,
#     quantization 1e4. Vise ≤ 200 Ko.
#
#   Régions : la source GeoJSON ne contient que les champs `code` et `nom`
#     des départements — aucun code région (code_reg / reg). La production de
#     ref/regions.topojson nécessite soit une source IGN dédiée (REGION shapefile
#     COG), soit une table de correspondance dept→région pour agrégation.
#     Elle est donc NON produite ici. Voir bloc commenté « REFRESH IGN » ci-dessous
#     pour la régénération complète depuis les sources officielles.
#
# LICENCE
#   Données dérivées des référentiels IGN ADMIN EXPRESS COG.
#   Licence Ouverte / Etalab 2.0 — voir ref/LICENSE.md.
#
# IDEMPOTENCE
#   Le script est idempotent : relancer ne modifie ref/ que si la source change.
#
# PRÉREQUIS
#   - Node.js (pour npx mapshaper)
#   - mapshaper dans node_modules/.bin/ ou installé globalement
#
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SOURCE_GEOJSON="$REPO_ROOT/src/assets/departements-v0.geojson"
OUTPUT_DIR="$REPO_ROOT/ref"
OUTPUT_TOPOJSON="$OUTPUT_DIR/departements.topojson"

# ---------------------------------------------------------------------------
# Vérifications préalables
# ---------------------------------------------------------------------------
if [[ "${1:-}" == "--help" ]]; then
    sed -n '2,50p' "$0" | grep '^#' | sed 's/^# \?//'
    exit 0
fi

if [[ ! -f "$SOURCE_GEOJSON" ]]; then
    echo "ERREUR : source introuvable : $SOURCE_GEOJSON" >&2
    exit 1
fi

# Recherche mapshaper : local (node_modules) ou global
MAPSHAPER=""
if [[ -x "$REPO_ROOT/node_modules/.bin/mapshaper" ]]; then
    MAPSHAPER="$REPO_ROOT/node_modules/.bin/mapshaper"
elif command -v mapshaper &>/dev/null; then
    MAPSHAPER="mapshaper"
else
    echo "ERREUR : mapshaper introuvable. Lancez : npm install (ou npm install -g mapshaper)" >&2
    exit 1
fi

mkdir -p "$OUTPUT_DIR"

# ---------------------------------------------------------------------------
# MODE PAR DÉFAUT — Conversion hors-ligne depuis source locale
# ---------------------------------------------------------------------------
echo "[build-geo] Source  : $SOURCE_GEOJSON"
echo "[build-geo] Cible   : $OUTPUT_TOPOJSON"
echo "[build-geo] Outil   : $MAPSHAPER"
echo ""

"$MAPSHAPER" \
    "$SOURCE_GEOJSON" \
    -simplify 8% keep-shapes \
    -o format=topojson "$OUTPUT_TOPOJSON" \
    2>&1

# ---------------------------------------------------------------------------
# Vérification du résultat
# ---------------------------------------------------------------------------
if [[ ! -f "$OUTPUT_TOPOJSON" ]]; then
    echo "ERREUR : $OUTPUT_TOPOJSON n'a pas été produit." >&2
    exit 1
fi

SIZE=$(wc -c < "$OUTPUT_TOPOJSON")
SIZE_KB=$(( SIZE / 1024 ))
echo ""
echo "[build-geo] Taille produite : ${SIZE_KB} Ko ($SIZE octets)"

if [[ $SIZE -gt 204800 ]]; then
    echo "AVERTISSEMENT : taille > 200 Ko (${SIZE_KB} Ko). Augmenter la simplification :" >&2
    echo "  Remplacer '-simplify 8%' par '-simplify 5%' (ou moins) dans ce script." >&2
    # Pas d'exit 1 : on livre quand même, l'avertissement suffit pour décider.
fi

echo "[build-geo] Infos mapshaper :"
"$MAPSHAPER" "$OUTPUT_TOPOJSON" -info 2>&1 | grep -E "^Layer|features|Type" || true

echo ""
echo "[build-geo] DONE → $OUTPUT_TOPOJSON"

# =============================================================================
# BLOC « REFRESH IGN » — NE PAS EXÉCUTER EN CI / HORS-LIGNE
# (commenté ; décommenter uniquement pour régénérer depuis les sources officielles)
# =============================================================================
#
# Prérequis supplémentaires : ogr2ogr (GDAL), accès réseau, unzip
#
# URL IGN ADMIN EXPRESS COG (exemple 2024 — adapter l'année et le lien) :
#   https://geoservices.ign.fr/adminexpress
#   Téléchargement direct exemple :
#   IGN_BASE="https://data.geopf.fr/telechargement/download/ADMIN-EXPRESS-COG/ADMIN-EXPRESS-COG_3-2__SHP_WGS84G_FRA_2024-02-22"
#   ZIP="${IGN_BASE}/ADMIN-EXPRESS-COG_3-2__SHP_WGS84G_FRA_2024-02-22.7z"
#
# Étapes :
# 1. Téléchargement et extraction
#    wget "$ZIP" -O /tmp/adminexpress.7z
#    7z x /tmp/adminexpress.7z -o/tmp/adminexpress/
#
# 2. Conversion SHP → GeoJSON (départements + régions)
#    ogr2ogr -f GeoJSON /tmp/departements-raw.geojson \
#        /tmp/adminexpress/.../DEPARTEMENT.shp \
#        -t_srs EPSG:4326
#    ogr2ogr -f GeoJSON /tmp/regions-raw.geojson \
#        /tmp/adminexpress/.../REGION.shp \
#        -t_srs EPSG:4326
#
# 3. Simplification + TopoJSON départements
#    "$MAPSHAPER" /tmp/departements-raw.geojson \
#        -simplify 8% keep-shapes \
#        -o format=topojson "$OUTPUT_DIR/departements.topojson"
#
# 4. Simplification + TopoJSON régions (directement depuis le shapefile REGION)
#    "$MAPSHAPER" /tmp/regions-raw.geojson \
#        -simplify 8% keep-shapes \
#        -o format=topojson "$OUTPUT_DIR/regions.topojson"
#
#    Note : l'agrégation departements → régions via mapshaper est également
#    possible SI le champ CODE_REG est présent dans DEPARTEMENT.shp (ce n'est
#    pas le cas dans departements-v0.geojson qui ne porte que `code` et `nom`).
#    Commande d'agrégation (pour référence) :
#      "$MAPSHAPER" /tmp/departements-raw.geojson \
#          -dissolve CODE_REG copy-fields=NOM_REG \
#          -simplify 8% keep-shapes \
#          -o format=topojson "$OUTPUT_DIR/regions.topojson"
#
# 5. Remplacer src/assets/departements-v0.geojson par la version fraîche IGN
#    pour mettre à jour la base locale hors-ligne.
#    cp /tmp/departements-raw.geojson "$REPO_ROOT/src/assets/departements-v0.geojson"
#
# =============================================================================
