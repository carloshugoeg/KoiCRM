#!/usr/bin/env bash
# Load KEY=value env file safely (supports quotes and values with spaces).
# Usage: load-env.sh /path/to/.env.deploy.local
set -euo pipefail

load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || return 1
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"
    line="$(echo "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    [[ -z "$line" ]] && continue
    [[ "$line" != *"="* ]] && continue
    local key="${line%%=*}"
    local val="${line#*=}"
    key="$(echo "$key" | sed -e 's/[[:space:]]*$//')"
    val="$(echo "$val" | sed -e 's/^[[:space:]]*//')"
    if [[ "$val" == \"*\" && "$val" == *\" ]]; then
      val="${val:1:${#val}-2}"
    elif [[ "$val" == \'*\' && "$val" == *\' ]]; then
      val="${val:1:${#val}-2}"
    fi
    export "$key=$val"
  done <"$file"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  [[ -n "${1:-}" ]] || { echo "Usage: $0 <env-file>" >&2; exit 1; }
  load_env_file "$1"
fi
