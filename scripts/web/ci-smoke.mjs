import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import console from 'node:console';
import process from 'node:process';

const root = resolve(import.meta.dirname, '../..');
const copy = mkdtempSync(join(tmpdir(), 'kaikou-pages-ci-'));
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean);
for (const file of new Set(files)) {
  if (existsSync(join(root, file))) cpSync(join(root, file), join(copy, file), { recursive: true });
}
for (const path of ['resources/audio', 'resources/models', 'resources/web-models', '.models', '.certs']) {
  if (existsSync(join(copy, path))) throw new Error(`Unexpected private/development input: ${path}`);
}
console.log(`Clean copy: ${copy}; ${files.length} git-visible files`);
const env = { ...process.env, WEB_BASE: '/EnglishLearningApp/' };
function run(command) {
  const result = spawnSync(command, { cwd: copy, env, shell: true, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command}: ${result.status}`);
}
run('npm ci --ignore-scripts');
if (
  existsSync(join(copy, 'node_modules/ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'))
)
  throw new Error('Clean copy unexpectedly has ffmpeg');
run('npm run web:build:ci');
run('node scripts/web/browser-smoke.mjs');
console.log(`Clean-copy CI build and browser smoke passed: ${copy}`);
