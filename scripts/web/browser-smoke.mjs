import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { strict as assert } from 'node:assert';
import process from 'node:process';
import { URL } from 'node:url';
import { setTimeout, clearTimeout } from 'node:timers';
const { fetch, WebSocket } = globalThis;

const directory = resolve('dist-web');
const base = process.env.WEB_BASE ?? '/';
const mime = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.wasm': 'application/wasm',
  '.m4a': 'audio/mp4',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (!path.startsWith(base)) throw new Error('Wrong base');
    const file = resolve(directory, path.slice(base.length) || 'index.html');
    if (!file.startsWith(directory + sep)) throw new Error('Invalid path');
    response.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
    response.setHeader('Service-Worker-Allowed', base);
    response.setHeader('Cache-Control', 'no-store');
    response.end(await readFile(file));
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const url = origin + base;
const profile = await mkdtemp(resolve(tmpdir(), 'kaikou-pwa-smoke-'));
let browser, socket;
try {
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
      if (port) break;
    } catch {
      /* Wait for Chrome startup. */
    }
    await delay(100);
  }
  const pages = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  socket = new WebSocket(pages.find((page) => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((done, reject) => {
    socket.onopen = done;
    socket.onerror = reject;
  });
  let id = 0;
  const requests = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data),
      pending = requests.get(message.id);
    if (pending) {
      requests.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result);
    }
  };
  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const current = ++id;
      const timer = setTimeout(() => {
        requests.delete(current);
        reject(new Error(`CDP timeout: ${method}`));
      }, 30000);
      requests.set(current, { resolve, reject, timer });
      socket.send(JSON.stringify({ id: current, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await call('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await call('Page.navigate', { url });
  let ready = false;
  for (let i = 0; i < 250; i++) {
    ready = await evaluate(
      `(async()=>{const cache=await caches.open('kaikou-meta-v1');const res=await cache.match(${JSON.stringify(url + '__weeks')});return !!navigator.serviceWorker.controller && !!res && (await res.json()).includes(1)})()`,
    );
    if (ready) break;
    await delay(200);
  }
  assert.equal(ready, true, 'Initial week and SW control must complete');
  await evaluate(`window.__audioEvidence = []; const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      this.addEventListener('ended', () => window.__audioEvidence.push({src:this.currentSrc, duration:this.duration, ended:true}), {once:true});
      return originalPlay.apply(this,args);
    };
    const button = [...document.querySelectorAll('button')].find(b => /开始今天|开始上课/.test(b.textContent));
    if (!button) throw new Error('Today lesson entry missing'); button.click();`);
  let lessonReady = false;
  for (let i = 0; i < 100; i++) {
    lessonReady = await evaluate("!!document.querySelector('.step-nav')");
    if (lessonReady) break;
    await delay(200);
  }
  assert.equal(lessonReady, true, 'Real lesson must open');
  await evaluate(
    `const next = [...document.querySelectorAll('button')].find(b => b.textContent.includes('下一步')); if (!next) throw new Error('Lesson next missing'); next.click();`,
  );
  await delay(300);
  await evaluate(
    `const play = document.querySelector('.sentence-card .play-row button'); if (!play) throw new Error('Reference audio button missing'); play.click();`,
  );
  let playback;
  for (let i = 0; i < 100; i++) {
    playback = await evaluate('window.__audioEvidence[0]');
    if (playback) break;
    await delay(200);
  }
  assert.ok(playback?.ended && playback.duration > 0, 'Real course audio must decode and finish playback');
  assert.ok(playback.src.startsWith(url + 'audio/'), 'Audio must use built course assets');
  const manifest = JSON.parse(await readFile(resolve(directory, 'web-manifest.json'), 'utf8'));
  const audio = manifest.files.find((file) => file.kind === 'audio' && file.weeks.includes(1));
  await call('Network.enable');
  await call('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
  const range = await evaluate(
    `(async()=>{const res=await fetch(${JSON.stringify(url + audio.url)},{headers:{Range:'bytes=3-11'}});return {status:res.status,range:res.headers.get('Content-Range'),bytes:(await res.arrayBuffer()).byteLength}})()`,
  );
  assert.deepEqual(range, { status: 206, range: `bytes 3-11/${audio.bytes}`, bytes: 9 });
  await call('Page.reload', { ignoreCache: true });
  let text = '';
  for (let i = 0; i < 100; i++) {
    text = await evaluate('document.body.innerText');
    if (text.includes('开始今天') || text.includes('下一节课')) break;
    await delay(200);
  }
  assert.match(text, /今天/);
  assert.doesNotMatch(text, /启动没有完成|preload/);
  assert.equal(await evaluate('!!navigator.serviceWorker.controller'), true);
  process.stdout.write(
    JSON.stringify({
      origin: url,
      firstWeekVerified: true,
      initialControlled: true,
      lessonOpened: true,
      playback,
      speechViaProductionMicrophone: 'untested: harness has no fake microphone input',
      offlineRange: range,
      offlineReload: true,
      profile,
    }) + '\n',
  );
  await call('Browser.close');
} finally {
  socket?.close();
  browser?.kill();
  await new Promise((done) => server.close(done));
}
