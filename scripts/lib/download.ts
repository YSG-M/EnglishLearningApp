import { createWriteStream, existsSync, renameSync, statSync } from 'node:fs';
import { get } from 'node:https';
import type { IncomingMessage } from 'node:http';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

function request(url: string, headers: Record<string, string>, redirects = 0): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    get(url, { headers: { 'User-Agent': 'kaikou-english-build', ...headers } }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        if (redirects > 5) return reject(new Error(`Too many redirects for ${url}`));
        resolve(request(new URL(res.headers.location, url).toString(), headers, redirects + 1));
        return;
      }
      resolve(res);
    }).on('error', reject);
  });
}

/**
 * Downloads `url` to `dest`. Resumes from `dest.part` after an interruption (HTTP Range), and
 * only renames to `dest` once the byte count matches the server's size.
 */
export async function download(url: string, dest: string): Promise<void> {
  const part = `${dest}.part`;
  const have = existsSync(part) ? statSync(part).size : 0;
  const res = await request(url, have ? { Range: `bytes=${have}-` } : {});
  const status = res.statusCode ?? 0;
  if (status === 416) {
    // The partial file is already complete.
    res.resume();
    renameSync(part, dest);
    return;
  }
  if (status !== 200 && status !== 206) {
    res.resume();
    throw new Error(`Download failed (${status}) for ${url}`);
  }
  const resumed = status === 206;
  const remaining = Number(res.headers['content-length'] ?? 0);
  const total = resumed ? have + remaining : remaining;
  let done = resumed ? have : 0;
  let lastPrint = 0;
  const out = createWriteStream(part, { flags: resumed ? 'a' : 'w' });
  await new Promise<void>((resolve, reject) => {
    res.on('data', (chunk: Buffer) => {
      done += chunk.length;
      const now = Date.now();
      if (now - lastPrint > 1000) {
        lastPrint = now;
        const pct = total ? ((done / total) * 100).toFixed(1) : '?';
        process.stdout.write(`\r  ${(done / 1e6).toFixed(1)} / ${(total / 1e6).toFixed(1)} MB (${pct}%)   `);
      }
    });
    res.on('error', reject);
    out.on('error', reject);
    out.on('finish', resolve);
    res.pipe(out);
  });
  process.stdout.write('\n');
  const size = statSync(part).size;
  if (total && size !== total)
    throw new Error(`Size mismatch for ${url}: got ${size}, expected ${total}. Re-run to resume.`);
  renameSync(part, dest);
}

/**
 * Extracts a .tar.bz2 with the system tar. On Windows this is the built-in bsdtar
 * (C:\Windows\System32\tar.exe), which reads bz2 itself and accepts drive-letter paths.
 */
export function extractTarBz2(archive: string, outDir: string, members: string[] = []): void {
  const winTar = process.env.SystemRoot ? join(process.env.SystemRoot, 'System32', 'tar.exe') : '';
  const tar = process.platform === 'win32' && existsSync(winTar) ? winTar : 'tar';
  const r = spawnSync(tar, ['-xjf', archive, '-C', outDir, ...members], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`tar failed (${r.status ?? r.error?.message}) extracting ${archive}`);
}
