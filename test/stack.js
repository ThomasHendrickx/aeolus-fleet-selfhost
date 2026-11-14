import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pins } from '../scripts/common.js';

function run(args, env, capture = false) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { env, stdio: ['ignore', capture ? 'pipe' : 'inherit', 'inherit'] });
    let output = '';
    child.stdout?.on('data', chunk => { output += chunk; });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve(output) : reject(new Error(`Docker ${args[0]} failed (${code})`)));
  });
}

export async function stackScenario(allProfiles) {
  const project = `selfhost-test-${randomBytes(6).toString('hex')}`;
  const directory = await mkdtemp(join(tmpdir(), 'selfhost-test-'));
  const password = randomBytes(24).toString('hex');
  const env = { ...process.env, ...pins, COMPOSE_PROJECT_NAME: project };
  for (const key of ['POSTGRES_PASSWORD', 'CORE_DB_PASSWORD', 'SQUADRONS_DB_PASSWORD', 'TRIERARCH_PLUGIN_DB_PASSWORD', 'GATEWAY_DB_PASSWORD', 'GATEWAY_SECRET']) env[key] = password;
  for (const [key, owner] of Object.entries({ DATABASE_URL: 'aeolus', SQUADRONS_DATABASE_URL: 'aeolus_squadrons', TRIERARCH_PLUGIN_DATABASE_URL: 'aeolus_trierarch_plugin', GATEWAY_DATABASE_URL: 'aeolus_gateway' })) {
    env[key] = `postgresql://${owner}:${password}@${allProfiles ? 'postgres' : 'database'}:5432/${owner}`;
  }
  env.PUBLIC_URL = 'http://core:4000';
  env.CONSOLE_ORIGIN = 'http://console:3000';
  env.AEOLUS_SQUADRONS_URL = allProfiles ? 'http://squadrons:4100' : '';
  env.AEOLUS_TRIERARCH_PLUGIN_URL = allProfiles ? 'http://trierarch-plugin:4200' : '';
  env.AEOLUS_GATEWAY_URL = allProfiles ? 'http://gateway:4300' : '';
  const args = ['compose', '--env-file', '.env.example', '-p', project];
  const fixture = ['compose', '-p', `${project}-database`, '-f', join(directory, 'database.json')];
  if (allProfiles) args.push('--profile', '*');
  if (!allProfiles) {
    await writeFile(join(directory, 'database.json'), JSON.stringify({
      services: { database: {
        image: `postgres:${pins.POSTGRES_VERSION}`,
        environment: Object.fromEntries(['POSTGRES_PASSWORD', 'CORE_DB_PASSWORD', 'SQUADRONS_DB_PASSWORD', 'TRIERARCH_PLUGIN_DB_PASSWORD', 'GATEWAY_DB_PASSWORD'].map(key => [key, `\${${key}}`])),
        volumes: [`${resolve('postgres/init.sh')}:/docker-entrypoint-initdb.d/init.sh:ro`],
        networks: ['stack'],
        healthcheck: { test: ['CMD-SHELL', 'pg_isready -h 127.0.0.1 -U postgres -d postgres'], interval: '2s', timeout: '5s', retries: 60 },
      } },
      networks: { stack: { external: true, name: `${project}_default` } },
    }));
  }
  return {
    async start() {
      await run([...args, 'build'], env);
      if (!allProfiles) {
        await run([...args, 'create'], env);
        await run([...fixture, 'up', '-d', '--wait', '--wait-timeout', '180'], env);
      }
      await run([...args, 'up', '-d', '--wait', '--wait-timeout', '300'], env);
    },
    async assertHealthy(expected) {
      const output = await run([...args, 'ps', '--format', 'json'], env, true);
      const services = output.trim().split('\n').filter(Boolean).flatMap(line => JSON.parse(line));
      assert.deepEqual(services.map(service => service.Service).sort(), [...expected].sort());
      for (const service of services) {
        assert.equal(service.State, 'running', `${service.Service} must run`);
        assert.equal(service.Health, 'healthy', `${service.Service} must be healthy`);
      }
      console.log(`Healthy: ${expected.join(', ')}`);
    },
    async stop() {
      try {
        // Stop the external fixture before Compose removes its network.
        if (!allProfiles) await run([...fixture, 'down', '--volumes', '--remove-orphans'], env);
        await run([...args, 'down', '--volumes', '--remove-orphans'], env);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
  };
}
