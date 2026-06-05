#!/usr/bin/env bash
# Destructive: removes the Docker pgdata volume and all CRM data in local Postgres.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ "${DB_RESET_CONFIRM:-}" == "reset" ]]; then
  confirmed=true
else
  echo ""
  echo "WARNING: pnpm db:reset permanently deletes ALL local CRM data:"
  echo "  - tenants, deals, clients, users, memberships"
  echo "  - the Docker volume pgdata (not restored by signing in again with Google)"
  echo ""
  echo "Restarting npm/pnpm dev or signing out does NOT wipe data."
  echo "Use pnpm db:down / pnpm db:up instead if you only need to restart Postgres."
  echo ""
  read -r -p "Type 'reset' to confirm: " answer
  if [[ "$answer" == "reset" ]]; then
    confirmed=true
  else
    echo "Aborted — no data was deleted."
    exit 1
  fi
fi

docker compose down -v
docker compose up -d
echo ""
echo "Postgres restarted with an empty database."
echo "Next: pnpm db:migrate"
