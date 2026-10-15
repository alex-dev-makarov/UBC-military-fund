// Loaded only by scripts/smoke.mjs (node --import): the smoke run uses a fake
// bot token, so answer Telegram's getMe locally instead of calling the network.
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) =>
  String(input).endsWith('/getMe')
    ? Promise.resolve(new Response(JSON.stringify({ ok: true, result: { username: 'smoke_bot' } })))
    : realFetch(input, init);
