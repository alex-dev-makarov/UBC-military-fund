const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) =>
  String(input).endsWith('/getMe')
    ? Promise.resolve(new Response(JSON.stringify({ ok: true, result: { username: 'smoke_bot' } })))
    : realFetch(input, init);
