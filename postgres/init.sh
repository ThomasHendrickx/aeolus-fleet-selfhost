#!/bin/sh
set -eu
# psql variables quote passwords as SQL literals, never as shell-generated SQL.
: "${CORE_DB_PASSWORD:?Set CORE_DB_PASSWORD}"
: "${SQUADRONS_DB_PASSWORD:?Set SQUADRONS_DB_PASSWORD}"
: "${TRIERARCH_PLUGIN_DB_PASSWORD:?Set TRIERARCH_PLUGIN_DB_PASSWORD}"
: "${GATEWAY_DB_PASSWORD:?Set GATEWAY_DB_PASSWORD}"
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=ON_ERROR_STOP=1 \
  --set=core_password="$CORE_DB_PASSWORD" \
  --set=squadrons_password="$SQUADRONS_DB_PASSWORD" \
  --set=trierarch_password="$TRIERARCH_PLUGIN_DB_PASSWORD" \
  --set=gateway_password="$GATEWAY_DB_PASSWORD" <<'SQL'
CREATE ROLE aeolus LOGIN PASSWORD :'core_password';
CREATE DATABASE aeolus OWNER aeolus;
CREATE ROLE aeolus_squadrons LOGIN PASSWORD :'squadrons_password';
CREATE DATABASE aeolus_squadrons OWNER aeolus_squadrons;
CREATE ROLE aeolus_trierarch_plugin LOGIN PASSWORD :'trierarch_password';
CREATE DATABASE aeolus_trierarch_plugin OWNER aeolus_trierarch_plugin;
CREATE ROLE aeolus_gateway LOGIN PASSWORD :'gateway_password';
CREATE DATABASE aeolus_gateway OWNER aeolus_gateway;
SQL
