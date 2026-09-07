import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PORT = 3999;
const BASE = `http://127.0.0.1:${PORT}`;

const child = spawn('node', ['dist/main'], {
  cwd: API_ROOT,
  env: {
    ...process.env,
    PORT: String(PORT),
    DATABASE_PATH: ':memory:',
    
    
    
    
    JWT_SECRET:
      process.env.JWT_SECRET ?? randomBytes(48).toString('base64url'),
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? '1:smoke',
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID ?? '-100',
    FRONTEND_ORIGIN: 'http://localhost:5173',
    
    
    TELEGRAM_BOT_POLLING: 'false',
    
    
    
    MEMBERSHIP_TTL_SEC: '60',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', (chunk) => (output += chunk));
child.stderr.on('data', (chunk) => (output += chunk));

const failures = [];
const check = (name, condition, detail = '') => {
  if (condition) {
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

async function waitForBoot(timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`process exited during boot with code ${child.exitCode}\n${output}`);
    }
    try {
      const response = await fetch(`${BASE}/health`);
      if (response.status < 500) return;
    } catch {
      
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`did not boot within ${timeoutMs}ms\n${output}`);
}

try {
  await waitForBoot();

  console.log('\nsmoke:');

  const health = await fetch(`${BASE}/health`);
  const healthBody = await health.json();
  check('/health returns 200', health.status === 200, `got ${health.status}`);
  check('/health reports a live database', healthBody.db?.ok === true, JSON.stringify(healthBody.db));

  const publicReport = await fetch(`${BASE}/report/public`);
  const fund = await publicReport.json();
  check('/report/public returns 200 without a session', publicReport.status === 200, `got ${publicReport.status}`);
  



  check('the public payload carries every documented key',
    ['jarUrl', 'card', 'regions', 'categories', 'years', 'months', 'recent']
      .every((key) => key in fund));
  check('list fields are arrays even when unseeded',
    ['regions', 'categories', 'years', 'months', 'recent'].every((key) => Array.isArray(fund[key])));

  const secret = await fetch(`${BASE}/report/secret`);
  check('/report/secret is 401 without a cookie', secret.status === 401, `got ${secret.status}`);

  const me = await fetch(`${BASE}/auth/me`);
  check('/auth/me is 401 without a cookie', me.status === 401, `got ${me.status}`);

  const canary = JSON.stringify(fund);
  check('the private canary is absent from the public payload',
    !canary.includes('UBC-PRIVATE-CANARY'));
} catch (error) {
  failures.push(error.message);
  console.error(error.message);
} finally {
  child.kill('SIGTERM');
  await once(child, 'exit').catch(() => {});
}

if (failures.length > 0) {
  console.error(`\nsmoke failed (${failures.length}):\n${failures.map((f) => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
console.log('\nsmoke passed');
