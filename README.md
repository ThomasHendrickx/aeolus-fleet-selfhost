# aeolus-fleet-selfhost

```sh
git clone https://github.com/ThomasHendrickx/aeolus-fleet-selfhost.git && cd aeolus-fleet-selfhost
npm run init
npm start
```

You need git, Node (with `node:util.parseEnv`, Node 22.16 or later), and Docker with Docker Compose. No `npm install` is needed to run the setup. Images install the published npm packages while building.

Init asks whether to run Postgres in this folder or use an existing server, then whether to enable squadrons, the trierarch plugin and the gateway. Enter accepts each default: Postgres in the folder, squadrons and the trierarch plugin on, gateway off. `npm run init -- --yes` accepts defaults without questions. On a rerun the saved choices are the defaults.

Init writes `.env` with generated passwords, container database URLs, plugin addresses and `COMPOSE_PROFILES`. Keep this file private and back it up alongside the databases. A rerun keeps passwords, secrets and custom settings, changing the parts you choose. An existing Postgres needs a separate database and LOGIN owner for each enabled part; init asks for each connection URL. These URLs must be reachable from the containers, so `localhost` refers to the container itself.

Start builds and starts Compose, waits for core's `/health`, and initializes a new fleet named My fleet. Change the name later in the console. It prints argo's one-use sign-in link (valid for 15 minutes), opening it when a desktop is available. On a server, copy the printed link into a browser with a tunnel to localhost. For an existing fleet it opens the console's sign-in page, keeping any current argo sign-in active.

Start prints each enabled plugin's address to connect under **Settings**. Answer agents in the console's operator inbox. The trierarch plugin runs on the server; use **Join a machine** in the console to join a prepared computer. With the gateway enabled, Bridge and chats wait for the self-hosted sign-in service.

## Sign in and stop

```sh
npm run sign-in
npm stop
```

Sign-in prints and opens a fresh argo link, ending any other argo sign-in. Stop runs `docker compose down`, keeping database volumes.

## Configure and operate

Core and the console always run. Squadrons, the trierarch plugin, the gateway and Postgres are optional profiles. `.env` records them in `COMPOSE_PROFILES`, so ordinary `docker compose up -d --build`, `docker compose ps` and `docker compose logs` use the same choices.

All published ports bind to `127.0.0.1`. `PUBLIC_URL` and `CONSOLE_ORIGIN` are the browser-facing addresses, defaulting to localhost ports 4000 and 3000. Plugins reach core at `http://core:4000` inside Compose; the console reaches plugins at their Compose service addresses. Remote access needs your proxy and reachable public addresses. See the [self-host guide](https://github.com/ThomasHendrickx/aeolus-fleet/blob/main/docs/guide/self-host.md) for public addresses, first sign-in and plugin setup.

The `postgres` profile creates all four database owners on its first boot, including disabled plugins. Keep the generated passwords permanently. Enabling a plugin later reuses its saved password. The gateway also requires a permanent `GATEWAY_SECRET`, generated when first enabled.

For upgrades, copy the released version pins from `.env.example` into `.env`, then run `npm start`. Init preserves your saved pins and settings. Core's distinct existing-fleet exit code requires core 0.40.0 or later; older core versions refuse a second initialization as a general failure. `.env.example` is the source of the exact published versions, updated separately for each release.

For databases, health, upgrades, backup and restore, see [run the server](https://github.com/ThomasHendrickx/aeolus-fleet/blob/main/docs/guide/run-the-server.md). Core and console health checks use `/health`; plugins use `/api/health`.

Contributing: see [CLAUDE.md](CLAUDE.md). The setup scenarios run with `npm run test:setup` using only Node built-ins. The repository's check tooling needs its development dependencies.
