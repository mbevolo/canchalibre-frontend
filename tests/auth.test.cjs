const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function load(fetch) {
  const context = { window: { APP_BASE_URL: 'http://localhost:3001' }, document: { getElementById: () => null }, localStorage: { removeItem() {} }, Headers, fetch };
  vm.runInNewContext(fs.readFileSync('js/auth.js', 'utf8'), context);
  return context.window.CanchalibreAuth;
}
const response = (status, body) => ({ status, ok: status < 400, json: async () => body });
test('concurrent session restoration shares one refresh request', async () => {
  let count = 0;
  const auth = load(async (url, options) => { count++; assert.equal(url, 'http://localhost:3001/auth/refresh'); assert.equal(options.credentials, 'include'); return response(200, { accessToken: 'new-token' }); });
  assert.deepEqual(await Promise.all([auth.requireUserSession(), auth.requireUserSession()]), [true, true]);
  assert.equal(count, 1);
});
test('expired request refreshes and retries reservation with bearer token', async () => {
  const calls = [];
  const auth = load(async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/auth/refresh')) return response(200, { accessToken: 'new-token' });
    return response(calls.length === 1 ? 401 : 200, {});
  });
  const result = await auth.authFetch('/reservas/hold', { method: 'POST', body: '{"canchaId":"123"}' });
  assert.equal(result.status, 200); assert.equal(calls.length, 3);
  assert.equal(calls[2].options.headers.get('Authorization'), 'Bearer new-token');
  assert.equal(calls[2].options.body, calls[0].options.body);
});
test('failed refresh leaves session unavailable', async () => {
  const auth = load(async () => response(401, {}));
  assert.equal(await auth.requireUserSession(), false); assert.equal(auth.getAccessToken(), null);
});
test('logout calls backend and clears in-memory token', async () => {
  const calls = [];
  const auth = load(async url => { calls.push(url); return response(200, { accessToken: 'token' }); });
  await auth.requireUserSession(); await auth.logoutUser();
  assert.equal(auth.getAccessToken(), null); assert.ok(calls[1].endsWith('/auth/logout'));
});
