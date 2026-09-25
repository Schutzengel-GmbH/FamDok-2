#!/usr/bin/env bash
# Backs up everything the stack persists: the app database, Keycloak's database and the
# uploaded files volume. Run it BEFORE stopping the stack for an update - pg_dump needs the
# database containers running.
#
#   sudo ./backup.sh [-p project] [target-dir]    (default target: ./backups next to this script)
#
# Pass the same -p you use with `docker compose -p` - containers are looked up through the
# compose project, never by container name, so with several instances on one server each
# backup is guaranteed to come from the right one.
#
# Restore (same -p as above; restore the databases into empty ones, e.g. right after
# recreating their volumes):
#   gunzip -c app-db.sql.gz      | sudo docker compose -p <project> exec -T app-db      sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
#   gunzip -c keycloak-db.sql.gz | sudo docker compose -p <project> exec -T keycloak-db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
#   sudo docker run --rm --volumes-from "$(sudo docker compose -p <project> ps -aq backend)" \
#     -v "$PWD":/backup alpine sh -c 'cd /app/dist/uploads && tar xzf /backup/uploads.tar.gz'

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PROJECT=""
while getopts "p:" opt; do
  case "$opt" in
    p) PROJECT="$OPTARG" ;;
    *) echo "Usage: $0 [-p project] [target-dir]" >&2; exit 2 ;;
  esac
done
shift $((OPTIND - 1))

# --project-directory (rather than -f) so a docker-compose.override.yaml is picked up the same
# way a plain `docker compose` in this directory would.
COMPOSE=(docker compose --project-directory "$SCRIPT_DIR")
[[ -n "$PROJECT" ]] && COMPOSE+=(-p "$PROJECT")

TARGET="${1:-$SCRIPT_DIR/backups}/${PROJECT:+${PROJECT}_}$(date +%Y-%m-%d_%H-%M-%S)"

# Prints the container id of a compose service, failing loudly if there is none.
# Pass -a to also find stopped containers.
container_of() {
  local id
  id="$("${COMPOSE[@]}" ps -q "$@")"
  if [[ -z "$id" ]]; then
    echo "No ${*: -1} container found in compose project '${PROJECT:-<default>}'." >&2
    echo "Did you pass the right -p?" >&2
    exit 1
  fi
  echo "$id"
}

# Look everything up before writing anything, so a wrong -p doesn't leave a partial backup.
APP_DB="$(container_of app-db)"
KC_DB="$(container_of keycloak-db)"
BACKEND="$(container_of -a backend)"

mkdir -p "$TARGET"

# Dumps a Postgres container's database. The credentials are taken from the container's own
# environment (set from .env by docker-compose.yaml), so this script never has to read .env.
dump_db() {
  local container="$1" name="$2"
  echo "Dumping $name..."
  docker exec "$container" sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
    | gzip > "$TARGET/$name.sql.gz"
}

dump_db "$APP_DB" app-db
dump_db "$KC_DB" keycloak-db

# --volumes-from mounts the backend's uploads volume regardless of the volume's name, and
# works with the backend stopped too.
echo "Archiving uploads..."
docker run --rm --volumes-from "$BACKEND" -v "$TARGET":/backup alpine \
  tar czf /backup/uploads.tar.gz -C /app/dist/uploads .

# Catch truncated or corrupt archives now rather than when a restore is needed.
for f in "$TARGET"/*.gz; do
  gzip -t "$f"
done

echo "Backup complete: $TARGET"
ls -lh "$TARGET"
