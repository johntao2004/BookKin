import { spawn, execFileSync } from 'node:child_process';
import { mkdir, open, readFile, writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const run = path.join(root, '.local/run');
const logs = path.join(root, '.local/logs');
const savedWebPort = await readFile(path.join(root, '.local/preview-port'), 'utf8').catch(() => '4173');
const webPort = process.env.BOOKKIN_WEB_PORT ?? savedWebPort.trim();
if (!/^\d+$/.test(webPort) || Number(webPort) < 1 || Number(webPort) > 65535) throw new Error('Invalid BOOKKIN_WEB_PORT');
process.env.BOOKKIN_WEB_PORT = webPort;
const apiPort = process.env.BOOKKIN_API_PORT ?? '8080';
const services = [
  { name: 'backend-supervisor', args: ['start:local'], url: `http://127.0.0.1:${apiPort}/actuator/health`, identity: 'start:local' },
  { name: 'web-supervisor', args: ['dev'], url: `http://127.0.0.1:${webPort}/api/v1/auth/csrf`, identity: 'dev' },
];
const command = process.argv[2] ?? 'start';
if (!['start', 'status', 'stop'].includes(command)) throw new Error('Use start, status or stop');
await mkdir(run, { recursive: true });
await mkdir(logs, { recursive: true });

async function healthy(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'error' });
    if (!response.ok) return false;
    const body = await response.json();
    return url.endsWith('/csrf') ? body.headerName === 'X-XSRF-TOKEN' : body.status === 'UP';
  }
  catch { return false; }
}
async function managedPid(service) {
  try {
    const pid = Number(await readFile(path.join(run, `${service.name}.pid`), 'utf8'));
    if (!Number.isInteger(pid) || pid <= 1) return null;
    process.kill(pid, 0);
    const state = execFileSync('ps', ['-p', String(pid), '-o', 'stat='], { encoding: 'utf8' });
    if (state.trim().startsWith('Z')) return null;
    const executable = execFileSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' });
    if (!executable.includes('pnpm') || !executable.includes(root) || !executable.trim().endsWith(service.identity)) {
      throw new Error(`Refusing to control reused PID ${pid}`);
    }
    return pid;
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ESRCH') return null;
    throw error;
  }
}

if (command === 'stop') {
  for (const service of [...services].reverse()) {
    const pid = await managedPid(service);
    if (pid) process.kill(-pid, 'SIGTERM');
    await unlink(path.join(run, `${service.name}.pid`)).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
  console.log('Stopped preview processes owned by this launcher.');
} else {
  for (const service of services) {
    const ready = await healthy(service.url);
    if (command === 'status') {
      console.log(`${service.name}: ${ready ? 'ready' : 'unavailable'} (${service.url})`);
      if (!ready) process.exitCode = 1;
      continue;
    }
    if (ready) { console.log(`${service.name}: reusing healthy service`); continue; }
    let pid = await managedPid(service);
    if (!pid) {
      // An occupied frontend port is not ours to replace (it may point to a different backend).
      if (service.name === 'web-supervisor' && await fetch(`http://127.0.0.1:${webPort}/login`, {signal: AbortSignal.timeout(5000)}).then(() => true).catch(() => false)) {
        throw new Error(`Port ${webPort} is occupied. Choose BOOKKIN_WEB_PORT or check BOOKKIN_API_PROXY_TARGET.`);
      }
      const output = await open(path.join(logs, `${service.name}.log`), 'a', 0o600);
      const child = spawn('pnpm', ['--dir', root, ...service.args], { cwd: root, detached: true, stdio: ['ignore', output.fd, output.fd], env: process.env });
      await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
      pid = child.pid;
      child.unref();
      await output.close();
      await writeFile(path.join(run, `${service.name}.pid`), `${pid}\n`, { mode: 0o600 });
    }
    let readyAfterStart = false;
    for (let attempt = 0; attempt < 240; attempt += 1) {
      if (await healthy(service.url)) { readyAfterStart = true; break; }
      try { process.kill(pid, 0); } catch { break; }
      if (attempt % 10 === 0) console.log(`Waiting for ${service.name}; see .local/logs/${service.name}.log`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!readyAfterStart) throw new Error(`${service.name} did not become healthy; see .local/logs/${service.name}.log`);
    console.log(`${service.name}: ready`);
  }
  if (command === 'start') {
    await writeFile(path.join(root, '.local/preview-port'), webPort);
    console.log(`Preview ready: http://127.0.0.1:${webPort} — survives terminal closure. Stop with pnpm stop:preview.`);
  }
}
