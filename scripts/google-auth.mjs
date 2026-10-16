#!/usr/bin/env node

// One-time: get a Google refresh token for the bot account.
// Run on your Mac: pnpm google:auth, then sign in with the BOT Google account.

import { createServer } from 'node:http';
import { createInterface } from 'node:readline/promises';
import { spawn } from 'node:child_process';

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const clientId = (await rl.question('Client ID: ')).trim();
const clientSecret = (await rl.question('Client secret: ')).trim();
rl.close();

const server = createServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const redirect = `http://127.0.0.1:${server.address().port}`;

const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
url.search = new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirect,
  response_type: 'code',
  scope: SCOPES,
  access_type: 'offline',
  prompt: 'consent',
}).toString();

console.log('\nВідкриваю браузер. Увійдіть АКАУНТОМ БОТА і дозвольте доступ.');
console.log('Якщо браузер не відкрився, відкрийте посилання вручну:\n' + url + '\n');
spawn('open', [url.toString()], { stdio: 'ignore' }).on('error', () => undefined);

const code = await new Promise((resolve, reject) => {
  server.on('request', (req, res) => {
    const params = new URL(req.url, redirect).searchParams;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<p style="font:16px sans-serif">Готово. Поверніться в Terminal.</p>');
    server.close();
    params.get('code') ? resolve(params.get('code')) : reject(new Error(params.get('error') ?? 'no code'));
  });
});

const response = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirect,
    grant_type: 'authorization_code',
  }),
});
const data = await response.json();
if (!data.refresh_token) {
  console.error('Не вдалося отримати токен:', data.error_description ?? data.error ?? response.status);
  process.exit(1);
}

console.log('\nДодайте в deploy/prod.env на сервері (nano), не надсилайте в чат:\n');
console.log(`GOOGLE_CLIENT_ID=${clientId}`);
console.log(`GOOGLE_CLIENT_SECRET=${clientSecret}`);
console.log(`GOOGLE_REFRESH_TOKEN=${data.refresh_token}`);
