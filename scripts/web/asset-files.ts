import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { AssetFile } from '../../src/web/assets/types';

export const root = resolve(__dirname, '../..');
export const hash = (data: string | Uint8Array): string => createHash('sha256').update(data).digest('hex');
export function writeChanged(file: string, data: string | Uint8Array): boolean {
  const bytes = Buffer.from(data);
  if (existsSync(file) && readFileSync(file).equals(bytes)) return false;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(`${file}.tmp`, bytes);
  renameSync(`${file}.tmp`, file);
  return true;
}
export function fileEntry(
  dir: string,
  url: string,
  kind: AssetFile['kind'],
  extra: Partial<AssetFile> = {},
): AssetFile {
  const bytes = readFileSync(join(dir, url));
  return { url, kind, bytes: bytes.length, sha256: hash(bytes), ...extra };
}
