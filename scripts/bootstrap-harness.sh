#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HARNESS="$ROOT/tests/harness"
SRC="$ROOT/tests/harness-src"

cd "$ROOT"

echo "==> Removing old harness..."
rm -rf "$HARNESS"

echo "==> Creating fresh Symfony 8 app..."
symfony new "$HARNESS" --version="8.0.*" --no-git

echo "==> Patching composer.json..."
tmp=$(mktemp)
jq '
  .["minimum-stability"] = "dev" |
  .repositories = [{"type": "path", "url": "../..", "options": {"symlink": true}}]
' "$HARNESS/composer.json" > "$tmp" && mv "$tmp" "$HARNESS/composer.json"

echo "==> Installing dependencies..."
composer require \
  twig/twig \
  "symfony/twig-bundle:8.0.*" \
  doctrine/orm \
  doctrine/doctrine-bundle \
  symfony/var-exporter \
  sourecode/wire \
  "symfony/test-pack:*" \
  phpunit/phpunit \
  --no-interaction \
  --working-dir="$HARNESS"

echo "==> Patching config..."
# SQLite in-memory for tests — remove the PostgreSQL dbname_suffix
sed -i '/dbname_suffix/d' "$HARNESS/config/packages/doctrine.yaml"

echo "==> Patching .env.test..."
echo 'DATABASE_URL="sqlite:///:memory:"' >> "$HARNESS/.env.test"

echo "==> Patching base template to include Wire bundle..."
sed -i 's|</body>|    <script src="/wire.js"></script>\n    </body>|' "$HARNESS/templates/base.html.twig"

echo "==> Copying application files..."
cp -r "$SRC/src/"*       "$HARNESS/src/"
cp -r "$SRC/templates/"* "$HARNESS/templates/"
cp -r "$SRC/tests/"*     "$HARNESS/tests/"

echo "==> Done. Harness ready at $HARNESS"
