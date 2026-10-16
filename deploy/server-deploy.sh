#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

compose="docker compose --env-file deploy/prod.env -f docker-compose.yml -f docker-compose.server.yml"

stamp=$(date -u +%Y%m%d-%H%M%S)
if $compose exec -T api node -e "new (require('node:sqlite').DatabaseSync)('/app/data/ubc.sqlite').exec(\"VACUUM INTO '/app/data/backup-deploy-$stamp.sqlite'\")" 2>/dev/null; then
  echo "бекап бази: api/data-prod/backup-deploy-$stamp.sqlite"
  ls -1t api/data-prod/backup-deploy-*.sqlite | tail -n +11 | xargs -r rm -f
else
  echo "бекап пропущено: бекенд ще не запущений"
fi

$compose up -d --build --wait

docker image prune -f >/dev/null

echo "✅ prod оновлено: $(git log --oneline -1)"
