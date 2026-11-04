#!/usr/bin/env bash
# Widens attendance.clock_photo on legacy MySQL servers by SSHing into each
# host and running `mysql` there directly (SQL is streamed over the
# SSH connection's stdin - nothing is copied to the remote disk).
#
# Usage:
#   ./database/apply-schema.sh                                        # loads project .env
#   DB_USER=... DB_PASSWORD=... ./database/apply-schema.sh                # all allowed hosts
#   DB_USER=... DB_PASSWORD=... ./database/apply-schema.sh 178.62.72.140  # just this host
#   DB_USER=... DB_PASSWORD=... ./database/apply-schema.sh --schema      # original app migrations
#
# Loads DB_USER/DB_PASSWORD/DB_PORT/DB_NAME from the project .env without
# executing it as shell code. Exported values take precedence.
# Override the file with ENV_FILE=/path/to/.env.
# SSH_USER defaults to root, SSH_KEY defaults to database/keys/sshkey;
# override with SSH_USER=other SSH_KEY=/path/to/key ./database/apply-schema.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/../.env}"
if [ -f "$ENV_FILE" ]; then
  command -v node >/dev/null || { echo "Node.js is required to load .env" >&2; exit 1; }
  # dotenv handles quoted values and special characters. Only these four
  # settings are emitted as safely single-quoted Bash assignments.
  env_assignments=$(node --input-type=module - "$SCRIPT_DIR/.." "$ENV_FILE" <<'NODE'
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(resolve(process.argv[2], 'package.json'));
const { parse } = require('dotenv');
const values = parse(readFileSync(process.argv[3]));
for (const key of ['DB_USER', 'DB_PASSWORD', 'DB_PORT', 'DB_NAME']) {
  if (process.env[key] === undefined && values[key] !== undefined) {
    const quoted = "'" + values[key].replaceAll("'", "'\\''") + "'";
    process.stdout.write(`${key}=${quoted}\n`);
  }
}
NODE
  ) || { echo "Unable to load $ENV_FILE; ensure dependencies are installed (npm install)." >&2; exit 1; }
  eval "$env_assignments"
  unset env_assignments
fi
SCHEMA_FILE="$SCRIPT_DIR/attendance-clock-photo.sql"
if [ "${1:-}" = "--schema" ]; then
  SCHEMA_FILE="$SCRIPT_DIR/schema.sql"
  shift
fi

: "${DB_USER:?Set DB_USER (see .env)}"
: "${DB_PASSWORD:?Set DB_PASSWORD (see .env)}"
: "${DB_PORT:=3306}"
: "${DB_NAME:=iclockdb}"
: "${SSH_USER:=root}"
: "${SSH_KEY:=$SCRIPT_DIR/keys/sshkey}"

for command in ssh; do
  command -v "$command" >/dev/null || { echo "Missing command: $command" >&2; exit 1; }
done
[ -r "$SSH_KEY" ] || { echo "SSH key is not readable: $SSH_KEY" >&2; exit 1; }
[ -r "$SCHEMA_FILE" ] || { echo "SQL file is not readable: $SCHEMA_FILE" >&2; exit 1; }

# Kept in sync with src/config/allowed-db-hosts.ts
ALL_HOSTS=(
  167.99.92.164
  178.62.72.140
  165.22.205.179
  138.68.128.112
  161.35.149.243
  165.227.237.95
  138.68.169.19
  178.62.10.202
  161.35.172.18
  138.68.148.222
  64.227.38.185
)

HOSTS=("$@")
if [ ${#HOSTS[@]} -eq 0 ]; then
  HOSTS=("${ALL_HOSTS[@]}")
fi

failed=()
succeeded=()

echo "Applying $(basename "$SCHEMA_FILE") to ${#HOSTS[@]} server(s), database $DB_NAME"

for host in "${HOSTS[@]}"; do
  echo "== $host =="
  # Explicit Bash ensures printf %q quoting is understood on the remote host.
  mysql_cmd=$(printf 'MYSQL_PWD=%q mysql --batch --unbuffered --connect-timeout=15 -h 127.0.0.1 -P %q -u %q %q' \
    "$DB_PASSWORD" "$DB_PORT" "$DB_USER" "$DB_NAME")
  remote_cmd=$(printf 'bash -c %q' "$mysql_cmd")
  if ssh -i "$SSH_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new \
    -o BatchMode=yes -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=3 \
    "$SSH_USER@$host" "$remote_cmd" < "$SCHEMA_FILE"; then
    echo "-> OK"
    succeeded+=("$host")
  else
    echo "-> FAILED (see SSH/MySQL error above)" >&2
    failed+=("$host")
  fi
  echo
done

echo "Completed: ${#succeeded[@]} succeeded, ${#failed[@]} failed"
if [ ${#failed[@]} -gt 0 ]; then
  echo "Failed hosts: ${failed[*]}" >&2
  exit 1
fi
