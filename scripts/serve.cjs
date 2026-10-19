'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../web');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const port = Number(process.env.PORT || 3000);
http.createServer((req, res) => {
  let request;
  try { request = decodeURIComponent(new URL(req.url, 'http://preview').pathname); }
  catch (_) { res.writeHead(400).end('Bad request'); return; }
  const file = path.resolve(root, '.' + (request === '/' ? '/index.html' : request));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end('Forbidden'); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(port, '0.0.0.0', () => console.log('Solar System Sandbox listening on 0.0.0.0:' + port));
