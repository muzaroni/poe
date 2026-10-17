import { createServer } from 'node:http';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const builds = path.join(root, 'src', 'content', 'builds');
const uploads = path.join(root, 'public', 'images', 'uploads');
const allowedOrigins = new Set(['http://127.0.0.1:4321', 'http://localhost:4321']);

function send(response, status, body, origin) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...(allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}) });
  response.end(JSON.stringify(body));
}

async function readBody(request, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error(`File is too large (limit ${Math.round(limit / 1024 / 1024)} MB)`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

createServer(async (request, response) => {
  const origin = request.headers.origin ?? '';
  if (!allowedOrigins.has(origin)) return send(response, 403, { error: 'Local editor only' }, origin);
  if (request.method === 'OPTIONS') {
    response.writeHead(204, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' });
    return response.end();
  }
  const url = new URL(request.url ?? '/', 'http://127.0.0.1:4322');
  if (request.method === 'GET' && url.pathname === '/health') return send(response, 200, { ok: true }, origin);
  try {
    if (request.method === 'POST' && url.pathname === '/save') {
      const guide = JSON.parse((await readBody(request, 8 * 1024 * 1024)).toString('utf8'));
      if (guide.kind != null && !['build', 'article'].includes(guide.kind)) throw new Error('Choose a build guide or article');
      if (guide.tags != null && (!Array.isArray(guide.tags) || guide.tags.some((tag) => typeof tag !== 'string'))) throw new Error('Tags must be text');
      guide.tags = [...new Set((guide.tags ?? []).map((tag) => tag.trim().replace(/\s+/g, ' ').toLowerCase()).filter(Boolean))];
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(guide.slug ?? '') || !guide.title?.trim() || guide.content?.type !== 'doc' || !Array.isArray(guide.content.content)) throw new Error('Guide needs a title, valid page address, and content');
      const output = path.join(builds, `${guide.slug}.json`);
      await mkdir(builds, { recursive: true });
      const temporary = `${output}.${randomUUID()}.tmp`;
      await writeFile(temporary, `${JSON.stringify(guide, null, 2)}\n`, 'utf8');
      await rename(temporary, output);
      return send(response, 200, { ok: true, file: `src/content/builds/${guide.slug}.json` }, origin);
    }
    if (request.method === 'POST' && url.pathname === '/upload') {
      const type = request.headers['content-type'] ?? '';
      const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }[type];
      if (!extension) throw new Error('Choose a PNG, JPG, WebP, or GIF image');
      const original = (url.searchParams.get('name') ?? 'image').replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 50) || 'image';
      const filename = `${original}-${randomUUID().slice(0, 8)}.${extension}`;
      await mkdir(uploads, { recursive: true });
      await writeFile(path.join(uploads, filename), await readBody(request, 10 * 1024 * 1024));
      return send(response, 200, { src: `/images/uploads/${filename}` }, origin);
    }
    return send(response, 404, { error: 'Not found' }, origin);
  } catch (error) {
    return send(response, 400, { error: error instanceof Error ? error.message : 'Request failed' }, origin);
  }
}).listen(4322, '127.0.0.1', () => console.log('Local guide save server: http://127.0.0.1:4322'));
