import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { parseArgs, parseEnv } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';

class SetupError extends Error {}

const plugins = [
  { profile: 'squadrons', label: 'Squadrons', prefix: 'SQUADRONS', port: 4100, database: 'aeolus_squadrons' },
  { profile: 'trierarch-plugin', label: 'Trierarch plugin', prefix: 'TRIERARCH_PLUGIN', port: 4200, database: 'aeolus_trierarch_plugin' },
  { profile: 'gateway', label: 'Gateway', prefix: 'GATEWAY', port: 4300, database: 'aeolus_gateway' },
];
const readEnv = file => parseEnv(readFileSync(file, 'utf8'));
const secret = () => randomBytes(32).toString('hex');

async function init(args) {
  const { values } = parseArgs({ args, options: { yes: { type: 'boolean', default: false } }, strict: true });
  const original = existsSync('.env') ? readFileSync('.env', 'utf8') : readFileSync('.env.example', 'utf8');
  const saved = parseEnv(original);
  const env = { ...saved };
  const quote = value => value.includes("'") ? JSON.stringify(value) : `'${value}'`;
  const previousProfiles = new Set((env.COMPOSE_PROFILES ?? '').split(','));
  const isRerun = existsSync('.env');
  const lines = createInterface({ input: process.stdin, terminal: false });
  const answers = lines[Symbol.asyncIterator]();
  const ask = async (prompt, fallback) => {
    if (values.yes) return fallback;
    process.stdout.write(`${prompt} [${fallback}]: `);
    const answer = await answers.next();
    if (answer.done) throw new SetupError('Input ended. Run npm run init -- --yes to accept defaults.');
    return answer.value.trim() || fallback;
  };
  try {
    let database;
    do {
      database = (await ask('Postgres in the folder or an existing server? (folder/existing)', isRerun && !previousProfiles.has('postgres') ? 'existing' : 'folder')).toLowerCase();
    } while (!['folder', 'existing'].includes(database));
    const enabled = [];
    for (const plugin of plugins) {
      if (plugin.profile === 'gateway') console.log('Bridge and chats wait for the self-hosted sign-in. Answer agents in the console inbox until then.');
      const fallback = isRerun ? previousProfiles.has(plugin.profile) : plugin.profile !== 'gateway';
      let answer;
      do {
        answer = (await ask(`Enable ${plugin.label}? (yes/no)`, fallback ? 'yes' : 'no')).toLowerCase();
      } while (!['y', 'yes', 'n', 'no'].includes(answer));
      if (['y', 'yes'].includes(answer)) enabled.push(plugin);
    }
    if (database === 'folder') {
      // Postgres creates every owner on its first boot, including disabled plugins.
      for (const key of ['POSTGRES_PASSWORD', 'CORE_DB_PASSWORD', ...plugins.map(plugin => `${plugin.prefix}_DB_PASSWORD`)]) env[key] ||= secret();
    }
    const parts = [{ prefix: '', database: 'aeolus', password: 'CORE_DB_PASSWORD' }, ...enabled.map(plugin => ({ ...plugin, password: `${plugin.prefix}_DB_PASSWORD` }))];
    for (const part of parts) {
      const key = part.prefix ? `${part.prefix}_DATABASE_URL` : 'DATABASE_URL';
      if (database === 'folder') {
        if (!env[key] || (isRerun && !previousProfiles.has('postgres'))) env[key] = `postgresql://${part.database}:${encodeURIComponent(env[part.password])}@postgres:5432/${part.database}`;
      } else {
        let url;
        do {
          // Never echo a saved URL or offer it as a visible default.
          url = await ask(`${key} for existing Postgres${env[key] ? ' (Enter keeps saved URL)' : ''}`, '');
          url ||= env[key];
        } while (!url || !/^postgres(?:ql)?:\/\//.test(url));
        env[key] = url;
      }
    }
    if (enabled.some(plugin => plugin.profile === 'gateway')) env.GATEWAY_SECRET ||= secret();
    for (const plugin of plugins) {
      const key = `AEOLUS_${plugin.prefix}_URL`;
      env[key] = enabled.includes(plugin) ? env[key] || `http://${plugin.profile}:${plugin.port}` : '';
    }
    env.COMPOSE_PROFILES = [...(database === 'folder' ? ['postgres'] : []), ...enabled.map(plugin => plugin.profile)].join(',');
    // Preserve comments, unrelated settings and existing values byte for byte.
    const pending = new Map(Object.entries(env));
    const output = original.split('\n').map(line => {
      const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
      if (!match) return line;
      const key = match[1];
      pending.delete(key);
      return saved[key] === env[key] ? line : `${key}=${quote(env[key])}`;
    });
    for (const [key, value] of pending) output.push(`${key}=${quote(value)}`);
    writeFileSync('.env', output.join('\n'), { mode: 0o600 });
    chmodSync('.env', 0o600);
    console.log('Saved .env. Keep it private and back it up with your databases. Run npm start.');
  } finally {
    lines.close();
  }
}

function compose(args, capture = false) {
  const result = spawnSync('docker', ['compose', ...args], { encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
  if (result.error) throw new SetupError('Could not run Docker Compose. Check Docker is installed and running.');
  return result;
}

function openLink(link) {
  console.log(`Open ${link}`);
  if (process.env.SSH_CONNECTION || process.env.SSH_TTY) return;
  const desktop = process.platform === 'darwin' || process.platform === 'win32' || process.env.DISPLAY || process.env.WAYLAND_DISPLAY;
  if (!desktop) return;
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'rundll32' : 'xdg-open';
  const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', link] : [link];
  const child = spawn(command, args, { stdio: 'ignore', detached: true });
  child.on('error', () => console.log('Open the printed link in your browser.'));
  child.unref();
}

async function waitForHealth(env) {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(new URL('/health', env.PUBLIC_URL), { signal: AbortSignal.timeout(5000) });
      await response.body?.cancel();
      if (response.ok) return;
    } catch { /* Core may still be starting. */ }
    await delay(1000);
  }
  throw new SetupError('Core did not become healthy within 180 seconds. Check docker compose logs core.');
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'init') return init(args);
  if (!['start', 'sign-in', 'stop'].includes(command) || args.length) throw new SetupError('Usage: setup.js init [--yes] | start | sign-in | stop');
  if (!existsSync('.env')) throw new SetupError('Run npm run init first.');
  if (command === 'stop') { process.exitCode = compose(['down']).status ?? 1; return; }
  const env = readEnv('.env');
  if (command === 'start') {
    const up = compose(['up', '-d', '--build']);
    if (up.status !== 0) { process.exitCode = up.status ?? 1; return; }
    await waitForHealth(env);
  }
  const result = compose(['exec', '-T', 'core', 'aeolus-core', ...(command === 'start' ? ['fleet:init', '--name', 'My fleet'] : ['sign-in'])], true);
  if (command === 'start' && result.status === 3) {
    openLink(new URL('/sign-in', env.CONSOLE_ORIGIN).href);
    console.log('A fleet already exists. Run npm run sign-in for a fresh argo sign-in link.');
  } else if (result.status !== 0) {
    // Diagnostics may contain database credentials. Keep them in the container.
    console.error(`aeolus-core ${command === 'start' ? 'fleet:init' : 'sign-in'} failed. Check docker compose logs core.`);
    process.exitCode = result.status ?? 1;
    return;
  } else {
    const link = result.stdout.match(/Open (https?:\/\/\S+) to sign in/)?.[1];
    if (!link) throw new SetupError('Core did not print a sign-in link. Run npm run sign-in to try again.');
    openLink(link);
    console.log('This argo sign-in link works once, for 15 minutes.');
  }
  if (command === 'start') {
    const enabled = (env.COMPOSE_PROFILES ?? '').split(',');
    for (const plugin of plugins.filter(plugin => enabled.includes(plugin.profile))) console.log(`Connect ${plugin.label} under Settings: ${env[`AEOLUS_${plugin.prefix}_URL`]}`);
    console.log('Answer agents in the console inbox. Use Join a machine in the console to join a prepared computer.');
    if (enabled.includes('gateway')) console.log('Bridge and chats wait for the self-hosted sign-in.');
  }
}

main().catch(error => {
  console.error(error instanceof SetupError ? error.message : 'Setup could not complete. Check your configuration and Docker, then try again.');
  process.exitCode = 1;
});
