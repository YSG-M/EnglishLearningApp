import { build } from 'vite';
import { resolve, sep } from 'node:path';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import console from 'node:console';
import { tmpdir } from 'node:os';
import { URL } from 'node:url';
import { setTimeout, clearTimeout } from 'node:timers';
const { fetch, WebSocket } = globalThis;

const home = await mkdtemp(resolve(tmpdir(), 'kaikou-storage-smoke-'));
const directory = resolve(home, 'build');
await mkdir(directory, { recursive: true });
const profile = await mkdtemp(resolve(home, 'chrome-'));
await build({
  configFile: false,
  base: '/',
  build: { outDir: directory, rollupOptions: { input: resolve('src/web/storage/validation/smoke.html') } },
});
const server = createServer(async (request, response) => {
  try {
    const file = resolve(directory, `.${new URL(request.url, 'http://localhost').pathname}`);
    if (!file.startsWith(`${directory}${sep}`)) throw new Error('Invalid path');
    response.setHeader(
      'Content-Type',
      file.endsWith('.wasm') ? 'application/wasm' : file.endsWith('.js') ? 'text/javascript' : 'text/html',
    );
    response.end(await readFile(file));
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
let socket;
let call;
async function launch() {
  browser = spawn(
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
  let port;
  for (let i = 0; i < 100; i++) {
    try {
      port = Number((await readFile(resolve(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
      if (port) {
        const response = await fetch(`http://127.0.0.1:${port}/json`);
        if (response.ok) break;
      }
    } catch {
      /* Chrome writes its debugging port after startup. */
    }
    await delay(100);
  }
  const pages = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  socket = new WebSocket(pages.find((p) => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((done, reject) => {
    socket.onopen = done;
    socket.onerror = reject;
  });
  let id = 0;
  const requests = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Log.entryAdded' || message.method === 'Runtime.exceptionThrown')
      console.log(JSON.stringify(message));
    const pending = requests.get(message.id);
    if (pending) {
      requests.delete(message.id);
      if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result);
    }
  };
  call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const current = ++id;
      const timer = setTimeout(() => {
        requests.delete(current);
        reject(new Error(`CDP timeout: ${method}`));
      }, 30000);
      requests.set(current, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      socket.send(JSON.stringify({ id: current, method, params }));
    });
  await call('Runtime.enable');
  await call('Log.enable');
  await call('Browser.setDownloadBehavior', { behavior: 'deny' });
  await call('Page.navigate', { url: `${origin}/src/web/storage/validation/smoke.html` });
  for (let i = 0; i < 100; i++) {
    if (await evaluate('!!window.storageSmoke')) break;
    await delay(100);
  }
  const ready = await evaluate('window.storageSmoke.ready');
  console.log('Browser storage initialized', ready);
  if (ready !== true) throw new Error(`Storage startup failed: ${JSON.stringify(ready)}`);
}
async function evaluate(expression) {
  const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function closeBrowser() {
  const exited = new Promise((done) => browser.once('exit', done));
  await call('Browser.close');
  await exited;
  socket.close();
}
try {
  await launch();
  console.log('Seeding synthetic data');
  const seeded = await evaluate(`(async () => {
    const r = window.storageSmoke.runtime;
    await r.api.settings.update({learnerName:'Synthetic smoke learner',reviewCap:25});
    await r.api.today.addActiveTime(60000);
    const rec = await r.api.recordings.saveChallenge({challengeId:'smoke',samples:Float32Array.from({length:1600},(_,i)=>Math.sin(i/5)),sampleRate:16000});
    const blob = await r.backup.exportFile();
    const inspected = await r.backup.inspectFile(blob);
    const conflict = await window.storageSmoke.open().then(x=>x.dispose().then(()=> 'UNEXPECTED_OPEN'),e=>e.code);
    return {recordingId:rec.id,bytes:blob.size,recordingCount:inspected.recordingCount,conflict};
  })()`);
  if (seeded.conflict !== 'STORAGE_BUSY')
    throw new Error(`Second writer was not blocked: ${JSON.stringify(seeded)}`);
  console.log('Seeded and second writer rejected', seeded);
  await closeBrowser();
  await delay(300);
  await launch();
  console.log('Checking cold reopen');
  const reopened = await evaluate(`(async () => {
    const r = window.storageSmoke.runtime;
    const settings = await r.api.settings.get();
    const records = await r.api.recordings.listChallenges();
    const wav = records[0] ? await (await fetch(records[0].url)).arrayBuffer() : null;
    return {learnerName:settings.learnerName,reviewCap:settings.reviewCap,activeMs:(await r.api.today.get()).activeMsToday,recordingIds:records.map(x=>x.id),wavBytes:wav?.byteLength};
  })()`);
  if (
    reopened.learnerName !== 'Synthetic smoke learner' ||
    reopened.reviewCap !== 25 ||
    reopened.activeMs !== 60000 ||
    reopened.recordingIds[0] !== seeded.recordingId ||
    reopened.wavBytes !== 3244
  )
    throw new Error(`Cold reopen mismatch: ${JSON.stringify(reopened)}`);
  const imported = await evaluate(`(async () => {
    const r = window.storageSmoke.runtime;
    const backup = await r.backup.exportFile();
    await r.api.settings.update({reviewCap:30});
    await r.api.recordings.saveChallenge({challengeId:'smoke',samples:new Float32Array(1600),sampleRate:16000});
    await r.backup.importFile(backup);
    return {reviewCap:(await r.api.settings.get()).reviewCap,recordings:(await r.api.recordings.listChallenges()).length};
  })()`);
  if (imported.reviewCap !== 25 || imported.recordings !== 1)
    throw new Error(`Import mismatch: ${JSON.stringify(imported)}`);
  await closeBrowser();
  await delay(300);
  await launch();
  const restored = await evaluate(`(async () => {
    const r = window.storageSmoke.runtime;
    const records = await r.api.recordings.listChallenges();
    return {reviewCap:(await r.api.settings.get()).reviewCap,recordingIds:records.map(x=>x.id),wavBytes:(await (await fetch(records[0].url)).arrayBuffer()).byteLength};
  })()`);
  if (
    restored.reviewCap !== 25 ||
    restored.recordingIds[0] !== seeded.recordingId ||
    restored.wavBytes !== 3244
  )
    throw new Error(`Imported generation cold reopen mismatch: ${JSON.stringify(restored)}`);
  const result = {
    browser: 'Headless native Chrome',
    origin,
    seeded,
    reopened,
    imported,
    restored,
    passed: true,
    iphoneVerified: false,
  };
  await writeFile(resolve(home, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await closeBrowser();
} finally {
  socket?.close();
  browser?.kill();
  server.close();
}
