const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(predicate) {
  for (let i = 0; i < 100; i++) { if (predicate()) return; await tick(); }
  throw new Error('La página no terminó la operación esperada');
}
function response(status, data) { return { ok: status < 400, status, json: async () => data }; }
async function page(name, fetch, selected) {
  const dom = new JSDOM(fs.readFileSync(name, 'utf8'), {
    url: 'http://localhost:8080/' + name, runScripts: 'outside-only', virtualConsole: new VirtualConsole()
  });
  await new Promise(resolve => dom.window.document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  const { window } = dom;
  window.API_BASE_URL = 'http://localhost:3001';
  window.Headers = Headers;
  window.fetch = fetch;
  window.alerts = [];
  window.alert = message => window.alerts.push(message);
  if (selected) window.localStorage.setItem('turnoSeleccionado', JSON.stringify(selected));
  for (const file of ['config.js', 'js/auth.js', 'js/app.js']) window.eval(fs.readFileSync(file, 'utf8'));
  window.dispatchEvent(new window.Event('DOMContentLoaded'));
  return dom;
}
function sessionFetch(calls, hold) {
  return async (url, options = {}) => {
    assert.ok(url.startsWith('http://localhost:3001/'), 'Se intentó llamar un backend fuera de pruebas');
    calls.push({ url, options });
    if (url.endsWith('/auth/refresh')) return response(200, { accessToken: 'test-jwt' });
    if (url.endsWith('/auth/me')) return response(200, { email: 'owner@canchalibre.local' });
    if (url.endsWith('/ubicaciones')) return response(200, {});
    if (url.includes('/club/')) return response(200, { nombre: 'Test Club' });
    if (url.endsWith('/reservas/hold')) return hold();
    return response(200, {});
  };
}
test('home restores JWT session and logout calls the server', async () => {
  const calls = [];
  const dom = await page('index.html', sessionFetch(calls));
  try {
    await until(() => dom.window.document.getElementById('logout').style.display === 'inline');
    assert.equal(dom.window.document.getElementById('usuario-logueado').textContent, 'owner@canchalibre.local');
    assert.ok(dom.window.document.getElementById('formulario-busqueda'));
    dom.window.document.getElementById('logout').click();
    await until(() => calls.some(call => call.url.endsWith('/auth/logout')));
    await until(() => dom.window.CanchalibreAuth.getAccessToken() === null);
  } finally { dom.window.close(); }
});
test('guest home offers login instead of protected search', async () => {
  const dom = await page('index.html', async url => response(url.endsWith('/auth/refresh') ? 401 : 200, {}));
  try {
    await until(() => !dom.window.document.getElementById('formulario-busqueda'));
    assert.match(dom.window.document.body.textContent, /Debes iniciar sesión/);
  } finally { dom.window.close(); }
});
test('reservation sends JWT, blocks double click, and can retry after failure', async () => {
  const calls = [];
  let resolveHold;
  const pending = new Promise(resolve => { resolveHold = resolve; });
  const dom = await page('detalle.html', sessionFetch(calls, () => pending), {
    canchaId: 'court-test', club: 'club@canchalibre.local', deporte: 'padel', fecha: '2030-01-10', hora: '10:00', precio: 1000
  });
  try {
    await until(() => dom.window.document.getElementById('detalle').textContent.includes('Test Club'));
    await tick();
    const button = dom.window.document.getElementById('confirmar-reserva');
    button.click(); button.click();
    await until(() => calls.some(call => call.url.endsWith('/reservas/hold')));
    assert.equal(button.disabled, true);
    const holds = calls.filter(call => call.url.endsWith('/reservas/hold'));
    assert.equal(holds.length, 1);
    assert.equal(holds[0].options.headers.get('Authorization'), 'Bearer test-jwt');
    const body = JSON.parse(holds[0].options.body);
    assert.equal(body.canchaId, 'court-test');
    assert.equal(body.metodoPago, 'efectivo');
    assert.equal('email' in body, false); assert.equal('usuarioId' in body, false);
    assert.equal(dom.window.document.querySelector('option[value="online"]'), null);
    resolveHold(response(400, { error: 'Turno ocupado' }));
    await until(() => !button.disabled);
    assert.match(dom.window.alerts[0], /Turno ocupado/);
    button.click();
    await until(() => calls.filter(call => call.url.endsWith('/reservas/hold')).length === 2);
  } finally { dom.window.close(); }
});
