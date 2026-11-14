import { execFileSync } from 'node:child_process';
import { docker, files, pins } from './common.js';

for (const file of files().filter(file => file.endsWith('.sh'))) {
  execFileSync('sh', ['-n', file], { stdio: 'inherit' });
  console.log(`Shell syntax: ${file}`);
}
// Parse the Dockerfile without adding BuildKit style rules to the syntax check.
console.log(docker(['buildx', 'build', '--check', '--build-arg', 'BUILDKIT_DOCKERFILE_CHECK=skip=all', '--build-arg', `NODE_VERSION=${pins.NODE_VERSION}`, '--build-arg', 'PART=core', '--build-arg', `VERSION=${pins.CORE_VERSION}`, '.']));
console.log('Dockerfile syntax passed');
