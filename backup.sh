#!/usr/bin/env bash
# Backs up everything the stack persists: the app database, Keycloak's database and the
# uploaded files volume. Run it BEFORE stopping the stack for an update - pg_dump needs the
# database containers running.
#
#   sudo ./backup.sh [target-dir]      (default: ./backups next to this script)
#
# Restore:
#   gunzip -c app-db.sql.gz      | sudo docker exec -i app-db      sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
#   gunzip -c keycloak-db.sql.gz | sudo docker exec -i keycloak-db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
#   (restore into an empty database, e.g. right after recreating the volume)
#   sudo docker run --rm --volumes-from <backend-container> -v "$PWD":/backup alpine \
#     sh -c 'cd /app/dist/uploads && tar xzf /backup/uploads.tar.gz'

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-$SCRIPT_DIR/backups}/$(date +%Y-%m-%d_%H-%M-%S)"
mkdir -p "$TARGET"

# Dumps a Postgres container's database. The credentials are taken from the container's own
# environment (set from .env by docker-compose.yaml), so this script never has to read .env.
dump_db() {
  local container="$1"
  echo "Dumping $container..."
  docker exec "$container" sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
    | gzip > "$TARGET/$container.sql.gz"
}

dump_db app-db
dump_db keycloak-db

# The backend has no fixed container_name, so look it up through compose. -a also finds it
# when stopped; --volumes-from mounts its uploads volume regardless of the volume's name.
BACKEND="$(docker compose -f "$SCRIPT_DIR/docker-compose.yaml" ps -aq backend)"
if [[ -z "$BACKEND" ]]; then
  echo "No backend container found - uploads NOT backed up." >&2
  exit 1
fi
echo "Archiving uploads..."
docker run --rm --volumes-from "$BACKEND" -v "$TARGET":/backup alpine \
  tar czf /backup/uploads.tar.gz -C /app/dist/uploads .

# Catch truncated or corrupt archives now rather than when a restore is needed.
for f in "$TARGET"/*.gz; do
  gzip -t "$f"
done

echo "Backup complete: $TARGET"
ls -lh "$TARGET"
