const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const { chromium: playwright } = require('playwright');
const root = path.resolve(__dirname, '..');
const artifacts = path.join(root, '.test-artifacts');
fs.mkdirSync(artifacts, { recursive: true });
(async () => {
 const server=http.createServer((req,res)=>{
  const filename=path.join(root,req.url.split('?')[0]==='/'?'index.html':decodeURIComponent(req.url.split('?')[0]));
  if(!filename.startsWith(root+'/')) { res.writeHead(403).end(); return; }
  try {let content=fs.readFileSync(filename);if(filename.endsWith('/config.js'))content=Buffer.from("window.API_BASE_URL='http://127.0.0.1:4001';\n"+content);
   res.setHeader('Content-Type',filename.endsWith('.js')?'text/javascript':filename.endsWith('.css')?'text/css':'text/html');res.end(content);
  }catch{res.writeHead(404).end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 let browser;
 try {
  browser=await playwright.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH || undefined,args:process.env.CHROMIUM_ARGS ? JSON.parse(process.env.CHROMIUM_ARGS) : [],headless:true});
  const context=await browser.newContext({viewport:{width:1366,height:900}});
  const calls=[],errors=[]; let showMapSlots=false;
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin==='http://127.0.0.1:4001') {
    calls.push({url:url.pathname,headers:await route.request().allHeaders()});
    const headers={'Access-Control-Allow-Origin':base,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'Content-Type, Authorization','Content-Type':'application/json'};
    let body={};
    if(url.pathname==='/auth/refresh')body={accessToken:'browser-token'};
    if(url.pathname==='/auth/me')body={email:'browser@test.local',nombre:'Prueba'};
    if(decodeURIComponent(url.pathname)==='/club/club@test.local')body={nombre:'Club de prueba',pagoOnlineDisponible:false};
    if(url.pathname==='/reservas/hold')body={mensaje:'Reserva enviada'};
    if(url.pathname==='/ubicaciones')body={Cordoba:['Villa Maria']};
    if(url.pathname==='/clubes'||url.pathname==='/turnos-generados'||url.pathname==='/api/me/reservas')body=[];
    if(url.pathname==='/turnos-generados' && showMapSlots)body=[{canchaId:'123456789012345678901234',club:'club@test.local',deporte:'padel',fecha:'2030-01-10',hora:'10:00',precio:1000,duracionTurno:60,latitud:-32.4,longitud:-63.2},{canchaId:'123456789012345678901234',club:'club@test.local',deporte:'padel',fecha:'2030-01-10',hora:'11:00',precio:1000,duracionTurno:60,latitud:-32.4,longitud:-63.2}];
    if(url.pathname==='/api/me/reservas')body=[{_id:'browser-booking',tipo:'CONFIRMED',fecha:'2099-01-01',hora:'10:00',nombreClub:'Club <img src=x onerror=alert(1)>',nombreCancha:'Cancha de prueba',pagado:false},{_id:'past-booking',tipo:'CONFIRMED',fecha:'2000-01-01',hora:'10:00',nombreClub:'Club de prueba',nombreCancha:'Cancha de prueba',pagado:true}];
    if(url.pathname.endsWith('/payment-link'))body={pagoUrl:'https://checkout.test/pay'};
    await route.fulfill({status:200,headers,body:JSON.stringify(body)});return;
   }
   if(url.origin===base)return route.continue();
   if(url.pathname.endsWith('/leaflet.js') || url.pathname.endsWith('/leaflet.css'))return route.fulfill({status:200,contentType:url.pathname.endsWith('.css')?'text/css':'text/javascript',body:fs.readFileSync(path.join(root,'node_modules/leaflet/dist/'+(url.pathname.endsWith('.css')?'leaflet.css':'leaflet.js')))});
   if(url.pathname.endsWith('/bootstrap.min.css'))return route.fulfill({status:200,contentType:'text/css',body:fs.readFileSync(path.join(root,'node_modules/bootstrap/dist/css/bootstrap.min.css'))});
   return route.fulfill({status:200,body:'',contentType:url.pathname.endsWith('.css')?'text/css':'text/javascript'});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  await page.goto(base+'/index.html');
  await page.waitForFunction(()=>document.getElementById('usuario-logueado').textContent==='browser@test.local');
  assert.equal(await page.locator('#formulario-busqueda').count(),1);
  await page.selectOption('#deporte','padel');await page.fill('#fecha','2030-01-10');await page.click('.btn-buscar-turnos');
  await page.waitForFunction(()=>document.getElementById('estado-busqueda').dataset.state==='empty');
  assert.equal(await page.locator('#resultados').getAttribute('aria-busy'),'false');
  assert.equal(await page.locator('.btn-buscar-turnos').isDisabled(),false);
  await page.screenshot({path:path.join(artifacts, 'web-index.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);await page.screenshot({path:path.join(artifacts,'web-index-mobile.png'),fullPage:true});await page.setViewportSize({width:1366,height:900});
  showMapSlots=true;
  await page.click('.btn-buscar-turnos');await page.getByRole('button',{name:'Ver en mapa'}).waitFor();
  await page.getByRole('button',{name:'Ver en mapa'}).click();
  assert.equal(await page.locator('.leaflet-marker-icon').count(),1);
  await page.locator('.leaflet-marker-icon').click();
  assert.equal(await page.locator('.leaflet-popup-content button').count(),2);
  assert.equal(await page.locator('.leaflet-popup-content [onclick]').count(),0);
  await page.getByRole('button',{name:'Ver en mapa'}).click();
  assert.equal(await page.locator('#map').count(),1);
  await page.evaluate(()=>localStorage.setItem('turnoSeleccionado',JSON.stringify({canchaId:'123456789012345678901234',club:'club@test.local',deporte:'padel',fecha:'2030-01-10',hora:'10:00',precio:1000,duracionTurno:60})));
  await page.goto(base+'/detalle.html');await page.locator('#detalle h3').waitFor();
  assert.equal(await page.locator('option[value="online"]').count(),0);
  await page.screenshot({path:path.join(artifacts, 'web-detail.png'),fullPage:true});
  await page.click('#confirmar-reserva');await page.waitForURL(base+'/index.html');
  assert.equal(calls.find(c=>c.url==='/reservas/hold').headers.authorization,'Bearer browser-token');
  await page.waitForFunction(()=>document.getElementById('logout').style.display==='inline');
  await page.click('#logout');await page.waitForURL(base+'/login.html');
  assert.ok(calls.some(c=>c.url==='/auth/logout'));
  await page.goto(base+'/panel-usuario.html');
  await page.locator('.btn-pagar').waitFor();
  assert.equal(await page.locator('#reservas-container img').count(),0);
  await page.click('#toggle-pasadas');
  assert.equal(await page.locator('#reservas-pasadas button').count(),0);
  await page.click('.btn-pagar');await page.locator('.enlace-pago').waitFor();
  assert.equal(await page.locator('.enlace-pago').getAttribute('href'),'https://checkout.test/pay');
  await page.screenshot({path:path.join(artifacts,'web-user-panel.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  await page.screenshot({path:path.join(artifacts,'web-user-panel-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('Chromium: index, detalle, reserva con JWT, navegación y logout OK; sin errores JavaScript. API y recursos externos simulados.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
