#!/bin/bash
# Prod deploy, run ON THE SERVER. GitHub Actions calls it on every push to main
# through an SSH key that can run nothing else (forced command in
# ~/.ssh/authorized_keys). Can also be run by hand: ~/ubc/deploy/server-deploy.sh
#
# Everything is inside main() so bash parses the whole file before `git reset`
# below rewrites it.
set -euo pipefail

main() {
  cd "$(dirname "$0")/.."

  exec 9>/tmp/ubc-deploy.lock
  if ! flock -n 9; then
    echo "інший деплой ще йде — пропускаю"
    exit 1
  fi

  local compose=(docker compose --env-file deploy/prod.env -f docker-compose.yml -f docker-compose.server.yml)

  # Snapshot the DB before new migrations run. VACUUM INTO gives a consistent
  # copy even while the API is writing. Keeps the 10 newest.
  if "${compose[@]}" ps --status running --services 2>/dev/null | grep -qx api; then
    local stamp
    stamp=$(date -u +%Y%m%d-%H%M%S)
    "${compose[@]}" exec -T api node -e \
      "new (require('node:sqlite').DatabaseSync)('/app/data/ubc.sqlite').exec(\"VACUUM INTO '/app/data/backup-${stamp}.sqlite'\")"
    ls -1t api/data-prod/backup-*.sqlite 2>/dev/null | tail -n +11 | xargs -r rm -f
    echo "бекап бази: api/data-prod/backup-${stamp}.sqlite"
  fi

  git fetch --quiet origin main
  git checkout --quiet -B main origin/main
  echo "код: $(git log --oneline -1)"

  "${compose[@]}" up -d --build --wait
  docker image prune -f >/dev/null

  echo "✅ prod оновлено до $(git rev-parse --short HEAD)"
}

main "$@"
