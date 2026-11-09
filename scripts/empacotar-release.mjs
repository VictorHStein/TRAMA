// Builds the no-install release zip: dist/ (as app/) plus the launchers.
// Run after `npm run build` (or use `npm run release`, which builds first):
//   node scripts/empacotar-release.mjs   ->   release/TRAMA-<version>.zip
// The zip stores Unix permissions, so abrir.sh and the .command file stay
// executable after unzipping on macOS and Linux.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = createRequire(import.meta.url)(join(root, 'package.json'));
const dist = join(root, 'dist');
const top = `TRAMA-${version}`;
const outDir = join(root, 'release');
const outFile = join(outDir, `${top}.zip`);

if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/ não existe: rode "npm run build" antes (ou use "npm run release").');
  process.exit(1);
}

/** [path inside the zip, file on disk] */
const files = [
  ['Abrir TRAMA.bat', join(root, 'scripts/release/Abrir TRAMA.bat')],
  ['Abrir TRAMA.command', join(root, 'scripts/release/Abrir TRAMA.command')],
  ['abrir.sh', join(root, 'scripts/release/abrir.sh')],
  ['LEIA-ME.txt', join(root, 'scripts/release/LEIA-ME.txt')],
  ['servidor-estatico.ps1', join(root, 'scripts/servidor-estatico.ps1')],
  ['servidor-estatico.py', join(root, 'scripts/servidor-estatico.py')],
];
(function walk(dir) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else files.push([`app/${relative(dist, full).split(sep).join('/')}`, full]);
  }
})(dist);

const EXECUTABLE = /\.(sh|command|py)$/;
const STORED = /\.(mp4|jpg|jpeg|png|webp|woff2?|zip)$/i;

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0;
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function dosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

const chunks = [];
const central = [];
let offset = 0;
const dirs = new Set();

function addEntry(name, data, mode, mtime) {
  const isDir = name.endsWith('/');
  const store = isDir || STORED.test(name);
  const body = store ? data : zlib.deflateRawSync(data, { level: 9 });
  const crc = isDir ? 0 : crc32(data);
  const nameBuf = Buffer.from(name, 'utf8');
  const { time, day } = dosDateTime(mtime);
  const method = store ? 0 : 8;
  const flags = 0x0800; // UTF-8 names

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(flags, 6);
  local.writeUInt16LE(method, 8);
  local.writeUInt16LE(time, 10);
  local.writeUInt16LE(day, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);
  chunks.push(local, nameBuf, body);

  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50, 0);
  cd.writeUInt16LE((3 << 8) | 20, 4); // made by Unix, so the mode below is honoured
  cd.writeUInt16LE(20, 6);
  cd.writeUInt16LE(flags, 8);
  cd.writeUInt16LE(method, 10);
  cd.writeUInt16LE(time, 12);
  cd.writeUInt16LE(day, 14);
  cd.writeUInt32LE(crc, 16);
  cd.writeUInt32LE(body.length, 20);
  cd.writeUInt32LE(data.length, 24);
  cd.writeUInt16LE(nameBuf.length, 28);
  cd.writeUInt16LE(0, 30);
  cd.writeUInt16LE(0, 32);
  cd.writeUInt16LE(0, 34);
  cd.writeUInt16LE(0, 36);
  cd.writeUInt32LE((((isDir ? 0o040000 : 0o100000) | mode) << 16 | (isDir ? 0x10 : 0)) >>> 0, 38);
  cd.writeUInt32LE(offset, 42);
  central.push(cd, nameBuf);

  offset += local.length + nameBuf.length + body.length;
}

function ensureDirs(path, mtime) {
  const parts = path.split('/').slice(0, -1);
  for (let i = 1; i <= parts.length; i++) {
    const d = `${parts.slice(0, i).join('/')}/`;
    if (!dirs.has(d)) {
      dirs.add(d);
      addEntry(d, Buffer.alloc(0), 0o755, mtime);
    }
  }
}

for (const [inside, onDisk] of files) {
  const name = `${top}/${inside}`;
  const st = statSync(onDisk);
  ensureDirs(name, st.mtime);
  addEntry(name, readFileSync(onDisk), EXECUTABLE.test(inside) ? 0o755 : 0o644, st.mtime);
}

const centralBuf = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(0, 4);
end.writeUInt16LE(0, 6);
end.writeUInt16LE(central.length / 2, 8);
end.writeUInt16LE(central.length / 2, 10);
end.writeUInt32LE(centralBuf.length, 12);
end.writeUInt32LE(offset, 16);
end.writeUInt16LE(0, 20);

mkdirSync(outDir, { recursive: true });
rmSync(outFile, { force: true });
writeFileSync(outFile, Buffer.concat([...chunks, centralBuf, end]));
console.log(`${relative(root, outFile)} (${(statSync(outFile).size / 1e6).toFixed(1)} MB, ${central.length / 2} entradas)`);
