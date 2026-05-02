#!/bin/sh
set -e

# Run pending DB migrations before starting the app. Drizzle tracks applied
# migrations in __drizzle_migrations, so re-runs on container restart are no-ops.
echo "[entrypoint] Running drizzle migrations..."
drizzle-kit migrate
echo "[entrypoint] Migrations complete. Starting server."

exec "$@"
