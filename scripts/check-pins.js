import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { files, pins } from './common.js';

const versionKeys = ['CORE', 'CONSOLE', 'SQUADRONS', 'TRIERARCH_PLUGIN', 'GATEWAY', 'NODE', 'POSTGRES'];
for (const part of versionKeys) {
  assert.match(pins[`${part}_VERSION`], /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$|^\d+\.\d+$/, `${part} must have an exact pin`);
}
assert.equal(pins.CORE_VERSION, pins.CONSOLE_VERSION, 'Core and console versions must match');
const compose = parse(readFileSync('compose.yaml', 'utf8'));
for (const part of versionKeys.filter(part => !['NODE', 'POSTGRES'].includes(part))) {
  const service = part.toLowerCase().replaceAll('_', '-');
  assert.equal(compose.services[service].build.args.VERSION, `\${${part}_VERSION:?Set ${part}_VERSION in .env}`);
  assert.equal(compose.services[service].build.args.NODE_VERSION, '${NODE_VERSION:?Set NODE_VERSION in .env}');
}
assert.equal(compose.services.postgres.image, 'postgres:${POSTGRES_VERSION:?Set POSTGRES_VERSION in .env}');
for (const file of files().filter(file => file !== '.env.example' && !file.startsWith('.agents/') && !file.startsWith('.claude/'))) {
  const source = readFileSync(file, 'utf8');
  assert.ok(!/(?:CORE|CONSOLE|SQUADRONS|TRIERARCH_PLUGIN|GATEWAY|NODE|POSTGRES)_VERSION\s*[:=]\s*["']?\d/.test(source), `Exact pin outside .env.example: ${file}`);
  assert.ok(!/(?:@aeolus-fleet\/[\w-]+@|(?:node|postgres):)\d+\.\d+/.test(source), `Exact package or image pin outside .env.example: ${file}`);
}
console.log('Exact pins live in .env.example; core and console versions match');
