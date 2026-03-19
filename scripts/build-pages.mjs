import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const pagesDir = resolve(rootDir, 'pages-dist');
const bundlePath = resolve(rootDir, 'dist', 'quran-ref-linker.min.js');
const docsPath = resolve(rootDir, 'docs', 'index.html');
const docsDemoPath = resolve(rootDir, 'docs', 'demo');

if (!existsSync(bundlePath)) {
  throw new Error('Missing dist/quran-ref-linker.min.js. Run `npm run build` first.');
}

if (!existsSync(docsPath)) {
  throw new Error('Missing docs/index.html.');
}

if (!existsSync(docsDemoPath)) {
  throw new Error('Missing docs/demo.');
}

rmSync(pagesDir, { recursive: true, force: true });
mkdirSync(pagesDir, { recursive: true });

cpSync(bundlePath, resolve(pagesDir, 'quran-ref-linker.min.js'));
cpSync(docsPath, resolve(pagesDir, 'index.html'));
cpSync(docsDemoPath, resolve(pagesDir, 'demo'), { recursive: true });
writeFileSync(resolve(pagesDir, '.nojekyll'), '');
