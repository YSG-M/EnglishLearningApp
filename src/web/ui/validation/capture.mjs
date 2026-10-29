import { build } from 'vite';
import { resolve, sep } from 'node:path';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { strict as assert } from 'node:assert';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers';
import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import console from 'node:console';
const { fetch, WebSocket } = globalThis;

const temporary = await mkdtemp(resolve(tmpdir(), 'kaikou-mobile-'));
const directory = resolve(temporary, 'build');
const output = resolve('.agent-wiki/mobile-screenshots');
const profile = resolve(temporary, 'chrome');
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
await build({
  configFile: false,
  base: './',
  resolve: { alias: { '@shared': resolve('src/shared') } },
  esbuild: { jsx: 'automatic' },
  build: { outDir: directory, rollupOptions: { input: resolve('src/web/ui/validation/preview.html') } },
});
await mkdir(output, { recursive: true });
const server = createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(directory, `.${path}`);
    if (!file.startsWith(`${directory}${sep}`)) throw new Error('Invalid path');
    response.setHeader(
      'Content-Type',
      file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html',
    );
    response.end(await readFile(file));
  } catch {
    response.writeHead(404);
    response.end();
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
      /* Chrome writes this after opening its debugging socket. */
    }
    await sleep(100);
  }
  if (!port) throw new Error('Chrome debugging port did not become available');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((done, reject) => {
    socket.onopen = done;
    socket.onerror = reject;
  });
  let id = 0;
  const requests = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    const pending = requests.get(message.id);
    if (pending) {
      requests.delete(message.id);
      if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result);
    }
  };
  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const current = ++id;
      requests.set(current, { resolve, reject });
      socket.send(JSON.stringify({ id: current, method, params }));
    });
  const evaluate = async (expression) => {
    const response = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  const results = [];
  for (const width of [428, 320]) {
    await call('Emulation.setDeviceMetricsOverride', {
      width,
      height: 926,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await call('Page.navigate', {
      url: `http://127.0.0.1:${server.address().port}/src/web/ui/validation/preview.html`,
    });
    await sleep(600);
    for (const page of [
      '今天',
      '课程',
      '📄 汇总',
      '← 返回',
      '复习',
      '我的',
      '设置 →',
      '← 返回',
      '速查 →',
      '课程',
      '开始上课',
      '下一步 →',
    ]) {
      await evaluate(
        `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().endsWith(${JSON.stringify(page)}))?.click()`,
      );
      await sleep(250);
      if (['今天', '课程', '复习', '我的'].includes(page)) {
        assert.equal(
          await evaluate("!!document.querySelector('.mobile-topbar button')"),
          false,
          'Root tabs must not show a back button',
        );
      }
      if (page === '下一步 →')
        await evaluate(
          "document.querySelector('main').scrollTop = document.querySelector('main').scrollHeight",
        );
      results.push(
        await evaluate(
          `(() => { const main = document.querySelector('main'); const shell = document.querySelector('.shell'); if (!main) throw new Error('Preview did not render'); return { page: ${JSON.stringify(page)}, width: innerWidth, height: innerHeight, horizontalOverflow: document.documentElement.scrollWidth > innerWidth, mainOverflow: main.scrollWidth > main.clientWidth, scrollable: main.scrollHeight > main.clientHeight, shellHeight: shell.getBoundingClientRect().height, actionTop: document.querySelector('.step-nav')?.getBoundingClientRect().top, lastContentBottom: document.querySelector('.step-body')?.getBoundingClientRect().bottom }; })()`,
        ),
      );
      assert.equal(results.at(-1).horizontalOverflow, false);
      assert.equal(results.at(-1).mainOverflow, false);
      if (page === '下一步 →') {
        assert.ok(
          results.at(-1).lastContentBottom <= results.at(-1).actionTop,
          'Lesson content must remain above the fixed action',
        );
      }
      if (page !== '← 返回') {
        const screenshot = await call('Page.captureScreenshot', { format: 'png' });
        await writeFile(
          resolve(output, `${width}-${results.length}.png`),
          Buffer.from(screenshot.data, 'base64'),
        );
      }
    }
  }
  await writeFile(resolve(output, 'measurements.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  socket?.close();
  browser.kill();
  server.close();
}
