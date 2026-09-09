import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const run=scenario=>JSON.parse(execFileSync(process.execPath,['src/main.js','--tool-only',scenario],{encoding:'utf8'}));
assert.equal(run('01').proposals[0].quantity,10);
assert.equal(run('02').proposals[0].quantity,0);
assert.equal(run('02').proposals[1].quantity,18);
assert.equal(run('03').proposals[0].quantity,null);
assert.equal(run('03').proposals[0].action,'manual_review');
console.log('5 comprobaciones de negocio: OK');
