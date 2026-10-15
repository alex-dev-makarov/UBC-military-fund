#!/bin/bash
# Prod deploy on the server: `git pull && pnpm server:prod`. GitHub Actions runs the same.
set -euo pipefail
cd "$(dirname "$0")/.."

compose="docker compose --env-file deploy/prod.env -f docker-compose.yml -f docker-compose.server.yml"

# 1. Back up the DB before migrations; keep the 10 newest.
stamp=$(date -u +%Y%m%d-%H%M%S)
if $compose exec -T api node -e "new (require('node:sqlite').DatabaseSync)('/app/data/ubc.sqlite').exec(\"VACUUM INTO '/app/data/backup-$stamp.sqlite'\")" 2>/dev/null; then
  echo "бекап бази: api/data-prod/backup-$stamp.sqlite"
  ls -1t api/data-prod/backup-*.sqlite | tail -n +11 | xargs -r rm -f
else
  echo "бекап пропущено: бекенд ще не запущений"
fi

# 2. Rebuild and restart; wait until the API is healthy.
$compose up -d --build --wait

# 3. Drop old images so the disk doesn't fill up.
docker image prune -f >/dev/null

echo "✅ prod оновлено: $(git log --oneline -1)"
