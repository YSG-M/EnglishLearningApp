import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { isIP } from 'node:net';

const index = process.argv.indexOf('--lan-ip');
const ip = index >= 0 ? process.argv[index + 1] : undefined;
if (!ip || isIP(ip) !== 4) throw new Error('Provide --lan-ip with your fixed private LAN IPv4 address');
const parts = ip.split('.').map(Number);
if (!(
  parts[0] === 10 ||
  parts[0] === 127 ||
  (parts[0] === 192 && parts[1] === 168) ||
  (parts[0] === 172 && parts[1]! >= 16 && parts[1]! <= 31)
))
  throw new Error('Use a private LAN address');
const dir = resolve('.certs');
mkdirSync(dir, { recursive: true });
const openssl =
  process.env.OPENSSL_PATH ??
  (existsSync('C:/Program Files/Git/usr/bin/openssl.exe')
    ? 'C:/Program Files/Git/usr/bin/openssl.exe'
    : 'openssl');
const config = join(dir, 'request.cnf');
writeFileSync(config, '[req]\ndistinguished_name=dn\n[dn]\n', 'utf8');
function run(args: string[]) {
  const result = spawnSync(openssl, args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`OpenSSL failed: ${result.error?.message ?? result.stderr}`);
}
const caKey = join(dir, 'ca.key'),
  ca = join(dir, 'ca.pem');
if (existsSync(caKey) !== existsSync(ca))
  throw new Error('Incomplete local CA: keep the original CA files together');
if (!existsSync(ca))
  run([
    'req',
    '-x509',
    '-newkey',
    'rsa:3072',
    '-nodes',
    '-sha256',
    '-days',
    '3650',
    '-config',
    config,
    '-subj',
    '/CN=Kaikou Local Development CA',
    '-addext',
    'basicConstraints=critical,CA:TRUE',
    '-addext',
    'keyUsage=critical,keyCertSign,cRLSign',
    '-keyout',
    caKey,
    '-out',
    ca,
  ]);
const key = join(dir, 'server.key'),
  cert = join(dir, 'server.pem'),
  csr = join(dir, 'server.csr');
if (existsSync(key) || existsSync(cert))
  throw new Error(
    'Server certificate exists; keep the fixed origin or explicitly move old server files before regenerating',
  );
run([
  'req',
  '-new',
  '-newkey',
  'rsa:2048',
  '-nodes',
  '-sha256',
  '-config',
  config,
  '-subj',
  '/CN=Kaikou LAN',
  '-keyout',
  key,
  '-out',
  csr,
]);
const ext = join(dir, 'server.ext');
writeFileSync(
  ext,
  `basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:${ip},IP:127.0.0.1,DNS:localhost\n`,
  'utf8',
);
run([
  'x509',
  '-req',
  '-in',
  csr,
  '-CA',
  ca,
  '-CAkey',
  caKey,
  '-CAcreateserial',
  '-days',
  '365',
  '-sha256',
  '-extfile',
  ext,
  '-out',
  cert,
]);
run(['verify', '-CAfile', ca, cert]);
run(['x509', '-in', ca, '-outform', 'DER', '-out', join(dir, 'ca.cer')]);
console.log(
  `Created local HTTPS certificate for ${ip}. Install only .certs/ca.cer on iPhone; keep all private keys on this computer.`,
);
