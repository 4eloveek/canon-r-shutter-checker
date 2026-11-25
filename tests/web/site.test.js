import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path) => readFile(join(root, path), 'utf8');

test('Pages assets are referenced relatively', async () => {
  const html = await read('docs/index.html');
  assert.match(html, /href="\.\/styles\.css"/);
  assert.match(html, /src="\.\/app\.js"/);
  assert.doesNotMatch(html, /(?:src|href)="\/(?!\/)/);
  assert.doesNotMatch(html, /<script[^>]+src="https?:/);
  assert.match(html, /http-equiv="Content-Security-Policy"/);
  assert.match(html, /default-src 'none'/);
  assert.match(html, /script-src 'self'/);
  assert.doesNotMatch(html, /unsafe-(?:inline|eval)/);
});

test('browser reader does not call the network', async () => {
  const app = await read('docs/app.js');
  const parser = await read('docs/canon-parser.js');
  assert.match(app, /from '\.\/canon-parser\.js'/);

  for (const source of [app, parser]) {
    assert.doesNotMatch(source, /\bfetch\s*\(/);
    assert.doesNotMatch(source, /\bXMLHttpRequest\b/);
    assert.doesNotMatch(source, /\bsendBeacon\b/);
    assert.doesNotMatch(source, /\bWebSocket\b/);
    assert.doesNotMatch(source, /\bhttps?:\/\//);
  }

  const css = await read('docs/styles.css');
  assert.doesNotMatch(css, /url\(\s*['"]?https?:/i);
});

test('GitHub Pages disables Jekyll processing', async () => {
  assert.equal((await read('docs/.nojekyll')).length, 0);
});

test('the web test command is defined', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(pkg.type, 'module');
  assert.match(pkg.scripts['test:web'], /node --test/);
});
