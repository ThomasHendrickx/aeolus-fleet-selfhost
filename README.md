# aeolus-fleet-selfhost

Run an Aeolus fleet with Docker Compose, using images built from the published npm packages. Core and the console always run. Squadrons, the trierarch plugin, the gateway and Postgres are optional Compose profiles.

## Prerequisites

- Docker with Docker Compose and access to the published npm packages when building images.
- A Postgres database for core and a separate database for each enabled plugin, with a separate LOGIN owner for each. Alternatively, use the `postgres` profile to create them.
- Addresses reachable by browsers, ships and plugins. The Compose ports bind to `127.0.0.1`, so remote access needs routing to those ports.

## Configure

Copy the example and edit `.env`:

```sh
cp .env.example .env
```

Keep the version pins from the example. Set `PUBLIC_URL` to the core address reachable by browsers, ships **and containers**, including the enabled plugins. The example `http://localhost:4000` refers to each container itself when used inside a container; use an address reachable from the containers as well as clients. Set `CONSOLE_ORIGIN` to the console's browser-facing origin.

Set `DATABASE_URL` to core's Postgres connection URL. For each enabled plugin, set its separate `SQUADRONS_DATABASE_URL`, `TRIERARCH_PLUGIN_DATABASE_URL` or `GATEWAY_DATABASE_URL`. Set the corresponding `AEOLUS_SQUADRONS_URL`, `AEOLUS_TRIERARCH_PLUGIN_URL` or `AEOLUS_GATEWAY_URL` to its address as seen by the console. The example lists Compose service addresses. For the gateway, also set `GATEWAY_PUBLIC_URL` to its public address and `GATEWAY_SECRET` to a permanent secret of at least 32 characters.

For the `postgres` profile, set `POSTGRES_PASSWORD` and all four owner passwords: `CORE_DB_PASSWORD`, `SQUADRONS_DB_PASSWORD`, `TRIERARCH_PLUGIN_DB_PASSWORD` and `GATEWAY_DB_PASSWORD`. The initializer creates all four owners and databases even if only core is enabled. Use `postgres:5432` as the database host and port in connection URLs, with the matching owner, password and database. URL-encode passwords in those URLs. The example contains the database names and a connection URL pattern.

## Start

Start core and the console with an external Postgres:

```sh
docker compose up -d --build
```

Add profiles as needed. Each command also starts core and the console; combine `--profile` flags to run multiple profiles, including `postgres` alongside plugins:

```sh
docker compose --profile postgres up -d --build
docker compose --profile squadrons up -d --build
docker compose --profile trierarch-plugin up -d --build
docker compose --profile gateway up -d --build
```

Check the services and their health status with the same profile flags used to start them:

```sh
docker compose ps
```

Core and console health checks use `/health`; the plugin checks use `/api/health`. Postgres uses `pg_isready`.

## Upgrade

Bump the relevant version pin in `.env.example`, copy that pin into `.env`, then rebuild and start the stack with the same profile flags:

```sh
docker compose up -d --build
```

For first sign-in and the rest of the self-hosting setup, see the [self-host guide](https://github.com/ThomasHendrickx/aeolus-fleet/blob/main/docs/guide/self-host.md). For operating services, databases, health, upgrades, backup and restore, see [run the server](https://github.com/ThomasHendrickx/aeolus-fleet/blob/main/docs/guide/run-the-server.md).

Contributing: see [CLAUDE.md](CLAUDE.md).
