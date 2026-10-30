import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import list from './api/r2/list.js';
import signUpload from './api/r2/sign-upload.js';
import deleteItem from './api/r2/delete.js';
import metadata from './api/r2/metadata.js';
import upload from './api/r2/upload.js';
import multipart from './api/r2/multipart.js';
import config from './vercel.json' with { type: 'json' };

const root = fileURLToPath(new URL('./dist/', import.meta.url));
const routes = new Map([
  ['/api/r2/list', list], ['/api/r2/sign-upload', signUpload],
  ['/api/r2/delete', deleteItem], ['/api/r2/metadata', metadata],
]);
const spaRoutes = new Set(['/', '/fotos', '/videos', '/contato', '/login', '/admin', '/admin/login']);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2' };

export const server = createServer(async (req, res) => {
  for (const header of config.headers.find(rule => rule.source === '/(.*)').headers) {
    res.setHeader(header.key, header.value);
  }
  res.status = code => { res.statusCode = code; return res; };
  res.json = body => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
  };
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === '/healthz') return res.status(200).json({ ok: true });
    if (pathname.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
      if (pathname === '/api/r2/upload') {
        req.query = Object.fromEntries(url.searchParams);
        return await upload(req, res);
      }
      if (pathname === '/api/r2/multipart') {
        req.query = Object.fromEntries(url.searchParams);
        return await multipart(req, res);
      }
      const handler = routes.get(pathname);
      if (!handler) return res.status(404).json({ error: 'Rota nao encontrada.' });
      req.query = Object.fromEntries(url.searchParams);
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 1048576) return res.status(413).json({ error: 'Corpo da requisicao muito grande.' });
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks).toString('utf8');
      if (body) {
        try { req.body = JSON.parse(body); }
        catch { return res.status(400).json({ error: 'JSON invalido.' }); }
      }
      return await handler(req, res);
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return res.status(405).json({ error: 'Metodo nao permitido.' });
    }
    const file = resolve(root, '.' + pathname);
    if (file !== resolve(root) && !file.startsWith(root.endsWith(sep) ? root : root + sep)) {
      return res.status(404).json({ error: 'Arquivo nao encontrado.' });
    }
    let target = file;
    let status = 200;
    let info = await stat(target).catch(() => null);
    if (!info?.isFile()) {
      if (spaRoutes.has(pathname.replace(/\/$/, '') || '/')) target = resolve(root, 'index.html');
      else { target = resolve(root, '404.html'); status = 404; }
      info = await stat(target);
    }
    res.statusCode = status;
    res.setHeader('Content-Type', mime[extname(target)] || 'application/octet-stream');
    res.setHeader('Content-Length', info.size);
    res.setHeader('Cache-Control', /\/assets\/.*-[\w-]+\.(js|css)$/.test(pathname) ? 'public, max-age=31536000, immutable' : 'no-cache');
    if (req.method === 'HEAD') return res.end();
    createReadStream(target).on('error', () => res.destroy()).pipe(res);
  } catch {
    if (!res.headersSent) res.status(500).json({ error: 'Erro interno do servidor.' });
    else res.destroy();
  }
});

server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('Servidor iniciado.'));
