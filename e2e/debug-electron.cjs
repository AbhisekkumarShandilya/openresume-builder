const { spawnSync } = require('node:child_process');
const fs = require('node:fs');

const p = 'node_modules/electron/dist/electron.exe';
console.log('exists:', fs.existsSync(p));
if (fs.existsSync(p)) console.log('size:', fs.statSync(p).size);

const r = spawnSync(p, ['--version'], { encoding: 'utf8' });
console.log('status:', r.status, 'signal:', r.signal);
console.log('stdout:', r.stdout);
console.log('stderr:', r.stderr);
console.log('error:', r.error);
