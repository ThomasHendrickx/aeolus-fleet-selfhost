import { docker } from './common.js';

const profiles = docker(['compose', '--env-file', '.env.example', 'config', '--profiles']).trim().split('\n').filter(Boolean);
// Check every profile combination, including the base stack and all profiles.
for (let mask = 0; mask < 2 ** profiles.length; mask++) {
  const selected = profiles.filter((_, index) => mask & (1 << index));
  docker(['compose', '--env-file', '.env.example', ...selected.flatMap(profile => ['--profile', profile]), 'config', '--quiet']);
  console.log(`Compose config: ${selected.join(', ') || 'base stack'}`);
}
