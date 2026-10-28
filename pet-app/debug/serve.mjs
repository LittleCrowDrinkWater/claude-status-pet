// Serves the debug page: the pet frontend in a plain browser with a control panel instead of
// hooks. Usage: node pet-app/debug/serve.mjs [port]   then open http://localhost:<port>/
//   /src/...  the real frontend files (app.js, scene.js, style.css)
//   /pet/...  character packs, from pet-data/assets then pet-data/characters, like load_asset
//   /api/packs  the installed packs as JSON
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.argv[2] || 1421);
const DEBUG_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(DEBUG_DIR, '..', 'src');
const PET_DATA = path.join(os.homedir(), '.claude', 'pet-data');
const PACK_ROOTS = [
  { dir: path.join(PET_DATA, 'assets'), group: 'dlc' },
  { dir: path.join(PET_DATA, 'characters'), group: 'custom' },
];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml',
};

function fileUnder(root, relative) {
  const target = path.resolve(root, '.' + path.sep + relative.replaceAll('/', path.sep));
  if (!target.startsWith(path.resolve(root) + path.sep)) return null;
  return fs.existsSync(target) && fs.statSync(target).isFile() ? target : null;
}

function listPacks() {
  const packs = [];
  for (const { dir, group } of PACK_ROOTS) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      // A junction to the exported pack counts as a directory only through stat, not dirent
      const packDir = path.join(dir, entry.name);
      const config = path.join(packDir, 'character.json');
      if (!fs.existsSync(config)) continue;
      let name = entry.name;
      try { name = JSON.parse(fs.readFileSync(config, 'utf8')).name || name; } catch (e) {}
      packs.push({ id: entry.name, name, group });
    }
  }
  return packs;
}

function send(response, status, body, type = 'text/plain; charset=utf-8') {
  response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  response.end(body);
}

function sendFile(response, file) {
  send(response, 200, fs.readFileSync(file), MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
}

http.createServer((request, response) => {
  const url = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  if (url === '/api/packs') return send(response, 200, JSON.stringify(listPacks()), MIME['.json']);
  let file = null;
  if (url.startsWith('/src/')) file = fileUnder(SRC_DIR, url.slice(5));
  else if (url.startsWith('/pet/')) {
    for (const { dir } of PACK_ROOTS) if ((file = fileUnder(dir, url.slice(5)))) break;
  } else file = fileUnder(DEBUG_DIR, url === '/' ? 'index.html' : url.slice(1));
  if (!file) return send(response, 404, 'not found: ' + url);
  sendFile(response, file);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`debug page: http://localhost:${PORT}/  (packs from ${PET_DATA})`);
});
