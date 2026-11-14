import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { parseEnv } from 'node:util';

export const pins = parseEnv(readFileSync('.env.example', 'utf8'));
export const checkEnv = { ...process.env, ...pins, DATABASE_URL: 'postgresql://check:check@postgres:5432/check' };
export const files = () => execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(file => file && statSync(file).isFile());
export const docker = (args, env = checkEnv) => execFileSync('docker', args, { env, encoding: 'utf8' });
