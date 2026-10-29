import { build } from 'vite';
import { resolve, sep, basename } from 'node:path';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import console from 'node:console';
import { URL } from 'node:url';
import { setTimeout, clearTimeout } from 'node:timers';
const { fetch, WebSocket } = globalThis;

const scratch = await mkdtemp(resolve(tmpdir(), 'kaikou-speech-smoke-'));
const directory = resolve(scratch, 'build');
const profile = resolve(scratch, 'chrome');
const manifest = JSON.parse(await readFile('resources/web-models/manifest.json', 'utf8'));
const bundle = JSON.parse(await readFile('resources/content/bundle.json', 'utf8'));
const clips = bundle.units.u01.chunks.slice(0, 3).map((c) => `${c.audio}.wav`);
await build({
  configFile: false,
  base: './',
  worker: { format: 'es' },
  build: {
    outDir: directory,
    rollupOptions: { input: resolve('src/web/speech/validation/preview.html') },
  },
});
const requested = [];
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    requested.push(path);
    if (path === '/models-manifest.json' || path === '/clips.json') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(path === '/clips.json' ? clips : manifest));
      return;
    }
    const model = manifest.files.find((f) => `/${f.url}` === path);
    const file = model
      ? model.path
      : path.startsWith('/audio/')
        ? resolve('resources/audio', basename(path))
        : resolve(directory, `.${path}`);
    if (
      !model &&
      !file.startsWith(`${directory}${sep}`) &&
      !file.startsWith(`${resolve('resources/audio')}${sep}`)
    )
      throw new Error('Invalid path');
    res.setHeader(
      'Content-Type',
      file.endsWith('.js') ? 'text/javascript' : file.endsWith('.wav') ? 'audio/wav' : 'text/html',
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const browser = spawn(
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  [
    '--headless',
    '--disable-gpu',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' },
);
let socket;
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try {
      port = Number((await readFile(resolve(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
      if (port) break;
    } catch {
      /* Wait for Chrome. */
    }
    await delay(100);
  }
  if (!port) throw new Error('Chrome debug port unavailable');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  socket = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((done, reject) => {
    socket.onopen = done;
    socket.onerror = reject;
  });
  let id = 0;
  const pending = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (request) {
      pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.done(message.result);
    }
  };
  const call = (method, params = {}) =>
    new Promise((done, reject) => {
      const current = ++id;
      const timer = setTimeout(() => {
        pending.delete(current);
        reject(new Error(`CDP timeout: ${method}`));
      }, 180000);
      pending.set(current, { done, reject, timer });
      socket.send(JSON.stringify({ id: current, method, params }));
    });
  await call('Page.navigate', {
    url: `http://127.0.0.1:${server.address().port}/src/web/speech/validation/preview.html`,
  });
  await delay(1000);
  const result = await call('Runtime.evaluate', {
    expression: 'runSpeech()',
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  const output = {
    browser: await call('Browser.getVersion'),
    expected: bundle.units.u01.chunks.slice(0, 3).map((c) => c.en),
    ...result.result.value,
    requested,
  };
  await mkdir(resolve('.agent-wiki/speech-validation'), { recursive: true });
  await writeFile(resolve('.agent-wiki/speech-validation/results.json'), JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));
} finally {
  socket?.close();
  browser.kill();
  server.close();
}
