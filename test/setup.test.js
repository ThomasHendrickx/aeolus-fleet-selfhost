import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { parseEnv } from 'node:util';
import { createServer } from 'node:http';

const script = resolve('scripts/setup.js');
async function aFolder(t) {
  const path = await mkdtemp(join(tmpdir(), 'aeolus-setup-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  await writeFile(join(path, '.env.example'), await readFile('.env.example'));
  await mkdir(join(path, 'bin'));
  await writeFile(join(path, 'bin/docker'), `#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
appendFileSync('commands', JSON.stringify(process.argv.slice(2)) + '\\n');
if (process.argv.includes('fleet:init') || process.argv.includes('sign-in')) {
  if (process.env.INIT_CODE) process.exit(Number(process.env.INIT_CODE));
  console.log('Open http://localhost:3000/sign-in?ticket=one-use to sign in to the console as argo.');
}
`, { mode: 0o755 });
  await writeFile(join(path, 'package.json'), '{"type":"module"}');
  return {
    path,
    async run(command, input = '', env = {}) {
      const child = spawn(process.execPath, [script, ...command], {
        cwd: path, env: { ...process.env, PATH: `${path}/bin:${process.env.PATH}`, DISPLAY: '', WAYLAND_DISPLAY: '', SSH_CONNECTION: 'test', ...env },
      });
      let output = '';
      child.stdout.on('data', data => { output += data; });
      child.stderr.on('data', data => { output += data; });
      child.stdin.end(input);
      const code = await new Promise(resolve => child.on('close', resolve));
      return { code, output };
    },
    async settings() { return parseEnv(await readFile(join(path, '.env'), 'utf8')); },
    async commands() { return (await readFile(join(path, 'commands'), 'utf8')).trim().split('\n').map(JSON.parse); },
  };
}

test('init accepts Enter defaults or --yes without printing generated secrets', async t => {
  for (const args of [[], ['--yes']]) {
    // Given a fresh folder and the approved defaults.
    const folder = await aFolder(t);
    // When init accepts Enter or --yes.
    const result = await folder.run(['init', ...args], '\n\n\n\n');
    // Then the chosen profiles and container URLs are recorded, with private secrets.
    assert.equal(result.code, 0, result.output);
    const env = await folder.settings();
    assert.equal(env.COMPOSE_PROFILES, 'postgres,squadrons,trierarch-plugin');
    assert.match(env.DATABASE_URL, /^postgresql:\/\/aeolus:[^@]+@postgres:5432\/aeolus$/);
    assert.equal(env.AEOLUS_SQUADRONS_URL, 'http://squadrons:4100');
    assert.equal(env.AEOLUS_TRIERARCH_PLUGIN_URL, 'http://trierarch-plugin:4200');
    assert.equal(env.AEOLUS_GATEWAY_URL, '');
    for (const key of ['POSTGRES_PASSWORD', 'CORE_DB_PASSWORD', 'SQUADRONS_DB_PASSWORD', 'TRIERARCH_PLUGIN_DB_PASSWORD', 'GATEWAY_DB_PASSWORD']) {
      assert.ok(env[key].length >= 32);
      assert.ok(!result.output.includes(env[key]));
    }
  }
});

test('rerun keeps secrets and custom settings while changing chosen plugins', async t => {
  // Given an initialized folder with custom settings.
  const folder = await aFolder(t);
  await folder.run(['init', '--yes']);
  await writeFile(join(folder.path, '.env'), (await readFile(join(folder.path, '.env'), 'utf8')) + '\nCUSTOM_SETTING=keep-me\n');
  const before = await folder.settings();
  // When the operator enables the gateway and disables squadrons.
  const result = await folder.run(['init'], '\nn\ny\n');
  // Then secrets and settings survive, while selected profiles change.
  assert.equal(result.code, 0, result.output);
  const after = await folder.settings();
  for (const key of Object.keys(before).filter(key => key.endsWith('_PASSWORD') || key.endsWith('_DATABASE_URL') || key === 'CUSTOM_SETTING')) assert.equal(after[key], before[key]);
  assert.equal(after.COMPOSE_PROFILES, 'postgres,trierarch-plugin,gateway');
  assert.equal(after.AEOLUS_SQUADRONS_URL, '');
  assert.equal(after.AEOLUS_GATEWAY_URL, 'http://gateway:4300');
  assert.ok(after.GATEWAY_SECRET.length >= 32);
  await folder.run(['init', '--yes']);
  assert.equal((await folder.settings()).GATEWAY_SECRET, after.GATEWAY_SECRET);
  assert.ok(!result.output.includes(after.GATEWAY_SECRET));
});

test('existing Postgres takes a separate URL for each selected part', async t => {
  // Given databases on an existing server.
  const folder = await aFolder(t);
  // When the operator chooses external Postgres and all plugins.
  const result = await folder.run(['init'], 'existing\ny\ny\ny\npostgresql://core:private@db/core\npostgresql://sq:private@db/sq\npostgresql://tr:private@db/tr\npostgresql://gw:private@db/gw\n');
  // Then URLs are saved privately without the postgres profile.
  assert.equal(result.code, 0, result.output);
  const env = await folder.settings();
  assert.equal(env.COMPOSE_PROFILES, 'squadrons,trierarch-plugin,gateway');
  assert.equal(env.DATABASE_URL, 'postgresql://core:private@db/core');
  assert.equal(env.GATEWAY_DATABASE_URL, 'postgresql://gw:private@db/gw');
  assert.ok(!result.output.includes('private'));
});

for (const existing of [false, true]) test(`start ${existing ? 'existing' : 'new'} fleet waits for health and prints sign-in and plugin guidance`, async t => {
  // Given a configured fleet and core's health endpoint.
  const folder = await aFolder(t);
  await folder.run(['init', '--yes']);
  let healthRequests = 0;
  const server = createServer((request, response) => { healthRequests++; response.writeHead(healthRequests === 1 ? 503 : 200).end(); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  await writeFile(join(folder.path, '.env'), (await readFile(join(folder.path, '.env'), 'utf8')).replace('PUBLIC_URL=http://localhost:4000', `PUBLIC_URL=http://127.0.0.1:${server.address().port}`));
  // When start builds the stack and fleet:init returns the appropriate result.
  const result = await folder.run(['start'], '', existing ? { INIT_CODE: '3' } : {});
  // Then health is awaited and the right link and Settings guidance are printed.
  assert.equal(result.code, 0, result.output);
  assert.ok(healthRequests >= 2);
  assert.match(result.output, existing ? /http:\/\/localhost:3000\/sign-in(?:\s|$)/ : /http:\/\/localhost:3000\/sign-in\?ticket=one-use/);
  assert.match(result.output, /Settings/);
  assert.match(result.output, /http:\/\/squadrons:4100/);
  assert.match(result.output, /Join a machine/);
  const commands = await folder.commands();
  assert.deepEqual(commands[0], ['compose', 'up', '-d', '--build']);
  assert.ok(commands[1].includes('fleet:init'));
  assert.ok(!commands.some(command => command.includes('sign-in')));
});

test('sign-in prints a fresh link and stop keeps volumes', async t => {
  // Given an initialized folder.
  const folder = await aFolder(t);
  await folder.run(['init', '--yes']);
  // When sign-in and stop are run.
  const signIn = await folder.run(['sign-in']);
  const stop = await folder.run(['stop']);
  // Then a fresh link is shown and Compose stops without deleting volumes.
  assert.equal(signIn.code, 0, signIn.output);
  assert.match(signIn.output, /ticket=one-use/);
  assert.equal(stop.code, 0, stop.output);
  assert.deepEqual(await folder.commands(), [['compose', 'exec', '-T', 'core', 'aeolus-core', 'sign-in'], ['compose', 'down']]);
});

test('start propagates a fleet:init failure without opening a sign-in page', async t => {
  // Given core is healthy but fleet:init fails.
  const folder = await aFolder(t);
  await folder.run(['init', '--yes']);
  const server = createServer((request, response) => response.end());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  await writeFile(join(folder.path, '.env'), (await readFile(join(folder.path, '.env'), 'utf8')).replace('PUBLIC_URL=http://localhost:4000', `PUBLIC_URL=http://127.0.0.1:${server.address().port}`));
  // When start receives an ordinary failure.
  const result = await folder.run(['start'], '', { INIT_CODE: '1' });
  // Then it fails without claiming the fleet already exists.
  assert.equal(result.code, 1);
  assert.ok(!result.output.includes('http://localhost:3000/sign-in'));
});
