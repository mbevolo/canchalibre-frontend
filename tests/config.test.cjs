const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function load(window) {
  const context = { window, document: { getElementById: () => null }, Headers };
  vm.runInNewContext(fs.readFileSync('config.js', 'utf8'), context);
  vm.runInNewContext(fs.readFileSync('js/auth.js', 'utf8'), context);
  return window;
}
test('default configuration keeps existing API', () => {
  assert.equal(load({}).CanchalibreAuth.apiUrl('/auth/me'), 'https://api.canchalibre.ar/auth/me');
});
test('test deployment proxies authentication while reservations use the API', () => {
  const window = load({
    API_BASE_URL: 'https://canchalibre-backend-v2-test.onrender.com',
    location: { hostname: 'canchalibre-frontend-v2-test.vercel.app', origin: 'https://canchalibre-frontend-v2-test.vercel.app' }
  });
  assert.equal(window.CanchalibreAuth.apiUrl('/auth/refresh'), 'https://canchalibre-frontend-v2-test.vercel.app/auth/refresh');
  assert.equal(window.CanchalibreAuth.apiUrl('/reservas/hold'), 'https://canchalibre-backend-v2-test.onrender.com/reservas/hold');
  assert.equal(window.CanchalibreAuth.apiUrl('/registrar'), 'https://canchalibre-backend-v2-test.onrender.com/registrar');
});
test('local API override is preserved and used by authentication', () => {
  const window = load({ API_BASE_URL: 'http://localhost:3001/' });
  assert.equal(window.CanchalibreAuth.apiUrl('/reservas/hold'), 'http://localhost:3001/reservas/hold');
});
test('existing APP_BASE_URL override remains supported', () => {
  assert.equal(load({ APP_BASE_URL: 'http://localhost:3002' }).CanchalibreAuth.apiUrl('/auth/me'), 'http://localhost:3002/auth/me');
});
test('booking pages load configuration before app code', () => {
  for (const page of ['index.html', 'detalle.html', 'login.html', 'registro.html', 'panel-usuario.html', 'confirmar-reserva.html']) {
    const html = fs.readFileSync(page, 'utf8');
    assert.ok(html.indexOf('src="config.js"') < html.indexOf('</head>'), page);
  }
  assert.equal(fs.readFileSync('js/app.js', 'utf8').includes('https://api.canchalibre.ar'), false);
});
test('club and admin use the same configurable API origin', () => {
  const window = load({ API_BASE_URL: 'http://localhost:3001/' });
  assert.equal(window.CanchaLibreApiUrl('/api/club/me'), 'http://localhost:3001/api/club/me');
  for (const file of ['js/club-advanced.js', 'js/club.js', 'js/login-club.js', 'js/superadmin.js']) {
    assert.equal(fs.readFileSync(file, 'utf8').includes('https://api.canchalibre.ar'), false, file);
  }
});
