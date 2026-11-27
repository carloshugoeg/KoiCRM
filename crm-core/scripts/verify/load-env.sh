#!/usr/bin/env bash
# Load crm-core/.env.verify into the current shell (source this file).
set -euo pipefail

VERIFY_SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CRM_CORE="$(cd "$VERIFY_SCRIPTS_DIR/../.." && pwd)"
ENV_FILE="${KOICRM_VERIFY_ENV_FILE:-$CRM_CORE/.env.verify}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy from .env.verify.example" >&2
  return 1 2>/dev/null || exit 1
fi

while IFS= read -r line || [[ -n "$line" ]]; do
  trimmed="${line#"${line%%[![:space:]]*}"}"
  [[ -z "$trimmed" || "$trimmed" == \#* ]] && continue
  key="${trimmed%%=*}"
  val="${trimmed#*=}"
  key="${key%"${key##*[![:space:]]}"}"
  # strip surrounding quotes
  if [[ "$val" == \"*\" && "$val" == *\" ]]; then
    val="${val:1:${#val}-2}"
  elif [[ "$val" == \'*\' && "$val" == *\' ]]; then
    val="${val:1:${#val}-2}"
  fi
  export "$key=$val"
done < "$ENV_FILE"

# shellcheck disable=SC1091
source "$VERIFY_SCRIPTS_DIR/guard-env.sh"
guard_verify_env "$ENV_FILE"
