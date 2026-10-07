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
test('guest home keeps public search available', async () => {
  const dom = await page('index.html', async url => response(url.endsWith('/auth/refresh') ? 401 : 200, {}));
  try {
    await until(() => dom.window.document.getElementById('usuario-logueado').textContent === 'No has iniciado sesión');
    assert.ok(dom.window.document.getElementById('formulario-busqueda'));
    assert.doesNotMatch(dom.window.document.body.textContent, /Debes iniciar sesión para ver/);
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

test('search blocks duplicate submits, recovers after failure and renders safe reservation actions', async () => {
  const calls = [];
  let resolveSearch, attempts = 0;
  const pending = new Promise(resolve => { resolveSearch = resolve; });
  const baseFetch = sessionFetch(calls);
  const fixture = { canchaId: 'court-test', club: 'club@example.com', deporte: 'padel', fecha: '2030-01-10', hora: '10:00', precio: 1000, duracionTurno: 60 };
  const dom = await page('index.html', async (url, options) => {
    if (url.includes('/turnos-generados?')) {
      attempts++;
      if (attempts === 1) return pending;
      return response(200, attempts === 2 ? [fixture] : []);
    }
    if (url.includes('/clubes')) return response(200, [{ email: fixture.club, nombre: 'Club <img src=x onerror=alert(1)>' }]);
    return baseFetch(url, options);
  });
  try {
    await until(() => calls.some(c => c.url.endsWith('/ubicaciones')));
    await tick(); await tick();
    const doc = dom.window.document, form = doc.getElementById('formulario-busqueda'), button = form.querySelector('button[type="submit"]');
    doc.getElementById('deporte').value = fixture.deporte;
    doc.getElementById('fecha').value = fixture.fecha;
    const submit = () => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    submit(); submit();
    await until(() => attempts === 1);
    assert.equal(button.disabled, true);
    assert.equal(doc.getElementById('resultados').getAttribute('aria-busy'), 'true');
    assert.match(doc.getElementById('estado-busqueda').textContent, /Buscando/);
    resolveSearch(response(503, {}));
    await until(() => !button.disabled);
    assert.match(doc.getElementById('estado-busqueda').textContent, /volver a buscar/);
    submit(); await until(() => !button.disabled);
    assert.equal(attempts, 2);
    assert.equal(doc.getElementById('estado-busqueda').textContent, '1 turno disponible en 1 club');
    const reserve = doc.querySelector('#resultados .turno button');
    assert.equal(reserve.getAttribute('onclick'), null);
    assert.equal(doc.querySelector('#resultados img'), null);
    reserve.click();
    assert.equal(JSON.parse(dom.window.localStorage.getItem('turnoSeleccionado')).canchaId, fixture.canchaId);
    submit(); await until(() => !button.disabled);
    assert.match(doc.getElementById('estado-busqueda').textContent, /Probá otra hora/);
    assert.equal(doc.getElementById('resultados').getAttribute('aria-busy'), 'false');
  } finally { dom.window.close(); }
});

test('guest can inspect a slot but confirmation requires login without creating a hold', async () => {
  const calls = [];
  const selected = { canchaId: 'court-test', club: 'club@test.local', deporte: 'padel', fecha: '2030-01-10', hora: '10:00' };
  const dom = await page('detalle.html', async url => {
    calls.push(url);
    return response(url.endsWith('/auth/refresh') ? 401 : 200, url.includes('/club/') ? {nombre: 'Test Club'} : {});
  }, selected);
  try {
    await until(() => dom.window.document.getElementById('detalle').textContent.includes('Test Club'));
    await tick();
    dom.window.document.getElementById('confirmar-reserva').click();
    await until(() => calls.filter(url => url.endsWith('/auth/refresh')).length === 2);
    await tick();
    assert.equal(calls.some(url => url.endsWith('/reservas/hold')), false);
    assert.equal(JSON.parse(dom.window.localStorage.getItem('turnoSeleccionado')).canchaId, selected.canchaId);
  } finally { dom.window.close(); }
});

test('search groups courts by club, expands schedules and preserves the chosen slot price', async () => {
 const calls=[];const slots=Array.from({length:9},(_,i)=>({canchaId:'court-a',nombreCancha:'Pádel A',club:'club@test.local',deporte:'padel',fecha:'2030-01-10',hora:`${String(i+10).padStart(2,'0')}:00`,precio:i<6?1000:1500,duracionTurno:60}));
 slots.push({...slots[0],canchaId:'court-b',nombreCancha:'Pádel B'});
 slots.push({...slots[0],canchaId:'court-c',club:'other@test.local'});
 const base=sessionFetch(calls);
 const dom=await page('index.html',async(url,opts)=>url.includes('/turnos-generados?')?response(200,slots):url.includes('/clubes')?response(200,[{email:'club@test.local',nombre:'Club A'},{email:'other@test.local',nombre:'Club B'}]):base(url,opts));
 try{await until(()=>calls.some(c=>c.url.endsWith('/ubicaciones')));await tick();
 const d=dom.window.document;d.getElementById('deporte').value='padel';d.getElementById('fecha').value='2030-01-10';d.getElementById('formulario-busqueda').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await until(()=>d.querySelectorAll('.club-result').length===2);
 assert.equal(d.querySelectorAll('.club-result')[0].querySelectorAll('.court-slots').length,2);
 const court=d.querySelector('.court-slots');assert.equal(court.querySelectorAll('.slot-choice:not([hidden])').length,6);const more=court.querySelector('.slots-more');more.click();assert.equal(more.getAttribute('aria-expanded'),'true');assert.equal(court.querySelectorAll('.slot-choice:not([hidden])').length,9);
 court.querySelectorAll('.slot-choice')[8].click();const selected=JSON.parse(dom.window.localStorage.getItem('turnoSeleccionado'));assert.equal(selected.canchaId,'court-a');assert.equal(selected.hora,'18:00');assert.equal(selected.precio,1500);more.click();assert.equal(court.querySelectorAll('.slot-choice:not([hidden])').length,6);
 }finally{dom.window.close();}
});
