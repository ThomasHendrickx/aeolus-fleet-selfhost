import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { files } from './common.js';

const violations = files().filter(file => readFileSync(file, 'utf8').includes(String.fromCodePoint(0x2014)));
assert.deepEqual(violations, [], 'Files containing an em dash');
console.log('No em dashes');
