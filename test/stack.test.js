import { test } from 'node:test';
import { stackScenario } from './stack.js';

test('base stack', { timeout: 1_200_000 }, async () => {
  // Given an external Postgres and the published core and console packages.
  const stack = await stackScenario(false);
  try {
    // When the base stack is built and started.
    await stack.start();
    // Then only core and console run, and both are healthy.
    await stack.assertHealthy(['core', 'console']);
  } finally {
    await stack.stop();
  }
});

test('all profiles', { timeout: 1_200_000 }, async () => {
  // Given every profile and the published packages.
  const stack = await stackScenario(true);
  try {
    // When the complete stack is built and started.
    await stack.start();
    // Then every service is healthy.
    await stack.assertHealthy(['core', 'console', 'squadrons', 'trierarch-plugin', 'gateway', 'postgres']);
  } finally {
    await stack.stop();
  }
});
