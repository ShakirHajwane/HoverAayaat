import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const host = process.env.HOST || '127.0.0.1';
const port = Number.parseInt(process.env.PORT || '4173', 10);

const CONTENT_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

function resolveRequestPath(urlPath) {
  const pathname = decodeURIComponent(urlPath.split('?')[0] || '/');
  const relativePath = pathname === '/' ? 'demo/index.html' : pathname.replace(/^\/+/, '');
  const absolutePath = path.resolve(rootDir, relativePath);

  if (!absolutePath.startsWith(rootDir)) {
    return null;
  }

  return absolutePath;
}

async function readResponseFile(absolutePath) {
  const fileStat = await stat(absolutePath);

  if (fileStat.isDirectory()) {
    return readResponseFile(path.join(absolutePath, 'index.html'));
  }

  const body = await readFile(absolutePath);
  return { body, absolutePath };
}

const server = createServer(async (request, response) => {
  try {
    const absolutePath = resolveRequestPath(request.url || '/');

    if (!absolutePath) {
      response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Forbidden');
      return;
    }

    const { body, absolutePath: resolvedPath } = await readResponseFile(absolutePath);
    const extension = path.extname(resolvedPath).toLowerCase();
    const contentType = CONTENT_TYPES.get(extension) || 'application/octet-stream';

    response.writeHead(200, { 'Content-Type': contentType });
    response.end(body);
  } catch (error) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

server.on('error', (error) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`Demo server failed: ${errorMessage}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`Quran Reference Linker demo: http://${host}:${port}/demo/`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
