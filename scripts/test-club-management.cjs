const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const back=path.resolve(__dirname,'../../canchalibre-backend');
const {MongoMemoryReplSet}=require(path.join(back,'node_modules/mongodb-memory-server'));
const front=process.env.FRONTEND_TEST_DIR || path.resolve(__dirname,'..');
const artifacts=path.join(front,'.test-artifacts');fs.mkdirSync(artifacts,{recursive:true});
const {chromium}=require(path.join(front, 'node_modules/playwright'));
(async()=>{
 const mongo=await MongoMemoryReplSet.create({binary:{version:'7.0.14'},replSet:{count:1,dbName:'canchalibre_test',storageEngine:'wiredTiger'},instanceOpts:[{args:['--nounixsocket']}]});
 let api,browser,web;const mongoose=require(back+'/node_modules/mongoose');
 try{
  let apiBase;
  web=http.createServer((req,res)=>{const file=path.join(front,decodeURIComponent(req.url.split('?')[0]));try{let body=fs.readFileSync(file);if(file.endsWith('/config.js'))body=Buffer.from('window.API_BASE_URL='+JSON.stringify(apiBase)+';\n'+body);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(body);}catch{res.writeHead(404).end();}});
  await new Promise(r=>web.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+web.address().port;
  Object.assign(process.env,{MONGO_URI:mongo.getUri('canchalibre_test'),JWT_SECRET:'web-test-secret',JWT_ACCESS_SECRET:'web-test-secret',NODE_ENV:'test',FRONT_URL:origin,ALLOWED_ORIGINS:origin,MP_ACCESS_TOKEN:'TEST-local'});
  const express=require(back+'/node_modules/express'),cron=require(back+'/node_modules/node-cron');
  const originalListen=express.application.listen;express.application.listen=function(){api=originalListen.call(this,0,'127.0.0.1');return api;};cron.schedule=()=>({stop(){}});
  const email= require.resolve(back+'/utils/email');require.cache[email]={id:email,filename:email,loaded:true,exports:{sendMail:async()=>{}}};
  await require(back+'/server').startServer();await mongoose.connection.asPromise();if(!api.listening)await new Promise(r=>api.once('listening',r));apiBase='http://127.0.0.1:'+api.address().port;
  const Usuario=require(back+'/models/Usuario'),Club=require(back+'/models/Club'),Cancha=require(back+'/models/Cancha'),Reserva=require(back+'/models/Reserva');
  const hash=await require(back+'/node_modules/bcryptjs').hash('Web-test-123!',4);
  const user=await Usuario.create({email:'web@example.com',nombre:'Prueba',apellido:'Web',telefono:'123',passwordHash:hash,emailVerificado:true});
  const club=await Club.create({email:'club@example.com',nombre:'Club Web',passwordHash:hash,emailVerificado:true,telefono:'123',provincia:'Cordoba',localidad:'Test'});
  const Superadmin=require(back+'/models/Superadmin');await Superadmin.create({email:'admin@example.com',nombre:'Web Admin',passwordHash:hash});
  const cancha=await Cancha.create({clubEmail:'club@example.com',nombre:'Cancha Web <img src=x onerror=window.clubInjection=true>',deporte:'padel',precio:1000,horaDesde:'08:00',horaHasta:'22:00',diasDisponibles:['jueves'],duracionTurno:60});
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH || undefined,args:process.env.CHROMIUM_ARGS ? JSON.parse(process.env.CHROMIUM_ARGS) : [],headless:true});
  const assets = [
    ['bootstrap.bundle.min.js','bootstrap/dist/js/bootstrap.bundle.min.js'],['bootstrap.min.css','bootstrap/dist/css/bootstrap.min.css'],
    ['leaflet.js','leaflet/dist/leaflet.js'],['leaflet.css','leaflet/dist/leaflet.css'],
    ['fullcalendar@6.1.8/index.global.min.js','fullcalendar/index.global.min.js'],['qrcode.min.js','qrcodejs/qrcode.min.js'],
    ['chart.umd.min.js','chart.js/dist/chart.umd.js'],['/npm/chart.js','chart.js/dist/chart.umd.js']
  ];
  const context=await browser.newContext();await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===origin||u.origin===apiBase)return route.continue();const asset=assets.find(([match])=>u.pathname.endsWith(match));if(asset)return route.fulfill({status:200,body:fs.readFileSync(path.join(front,'node_modules',asset[1])),contentType:asset[1].endsWith('.css')?'text/css':'text/javascript'});return route.fulfill({status:200,body:'',contentType:'text/javascript'});});
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));const dialogs=[];page.on('dialog',d=>{dialogs.push(d.message());return d.accept();});
  await page.goto(origin+'/login-club.html');await page.fill('#email',club.email);await page.fill('#password','Web-test-123!');await page.click('#form-login-club button[type="submit"]');await page.waitForURL(origin+'/panel-club.html');
  await page.click('#canchas-tab');await page.waitForFunction(()=>document.getElementById('canchas-list').textContent.includes('Cancha Web'));
  assert.equal(await page.evaluate(()=>window.clubInjection),undefined);assert.equal(await page.locator('#canchas-list img[src="x"]').count(),0);
  await page.fill('#buscar-cancha','no such court'); assert.equal(await page.locator('.court-card').count(),0); await page.fill('#buscar-cancha','');
  await page.click('#agregar-cancha');await page.waitForSelector('#modalCancha.show');await page.fill('#nombre-cancha','Nueva Cancha Web');await page.fill('#precio-cancha','1500');await page.selectOption('#hora-desde','08:30');await page.selectOption('#hora-hasta','24:00');await page.selectOption('#duracion-turno','90');
  await Promise.all([page.waitForResponse(r=>r.url()===apiBase+'/canchas'&&r.request().method()==='POST'),page.click('#guardar-cancha')]);
  await page.waitForFunction(()=>document.getElementById('canchas-list').textContent.includes('Nueva Cancha Web'));const added=await Cancha.findOne({nombre:'Nueva Cancha Web'});assert.ok(added);assert.equal(added.horaDesde,'08:30');assert.equal(added.horaHasta,'24:00');assert.equal(added.duracionTurno,90);
  const card=page.locator('#canchas-list .court-card').filter({hasText:'Nueva Cancha Web'});await card.getByRole('button',{name:'Editar',exact:true}).click();await page.waitForSelector('#modalCancha.show');await page.waitForFunction(()=>window._canchaAEditar===null&&document.getElementById('nombre-cancha').value==='Nueva Cancha Web');await page.fill('#precio-cancha','1800');
  const [editedResponse]=await Promise.all([page.waitForResponse(r=>r.url()===apiBase+'/canchas/'+added._id&&r.request().method()==='PUT'),page.click('#guardar-cancha')]);assert.equal(editedResponse.status(),200,await editedResponse.text());assert.equal((await Cancha.findById(added._id)).precio,1800);await page.waitForSelector('#modalCancha.show',{state:'hidden'});
  await Promise.all([page.waitForResponse(r=>r.url()===apiBase+'/canchas/'+added._id&&r.request().method()==='DELETE'),card.getByRole('button',{name:/Eliminar/}).click()]);assert.equal(await Cancha.findById(added._id),null);
  await page.screenshot({path:path.join(artifacts,'courts-desktop.png'),fullPage:true});
  await page.click('#agenda-tab');await page.waitForSelector('.fc-view');
  await page.evaluate(()=>document.getElementById('calendar-unico')._calendar.gotoDate('2030-01-10'));
  await page.screenshot({path:path.join(artifacts,'agenda-desktop.png'),fullPage:true});
  const freeSlot=page.locator('.fc-timegrid-col[data-date="2030-01-10"] .fc-event').filter({hasText:'Libre'}).first();await freeSlot.waitFor();await freeSlot.click();await page.waitForSelector('#modalTurno.show');
  await page.fill('#nombreCliente','Cliente Manual');await page.fill('#telefonoCliente','3534000000');await page.fill('#emailCliente','manual@example.com');
  const [bookingResponse]=await Promise.all([page.waitForResponse(r=>r.url()===apiBase+'/reservar-turno'&&r.request().method()==='POST'),page.click('#btn-reservar-turno')]);assert.equal(bookingResponse.status(),200,await bookingResponse.text());
  const Turno=require(back+'/models/Turno');const manual=await Turno.findOne({emailReservado:'manual@example.com'});assert.ok(manual);assert.equal(manual.telefonoReservado,'3534000000');
  await page.waitForSelector('#modalTurno.show',{state:'hidden'});
  assert.equal(await page.locator('#agenda-fecha').inputValue(),'2030-01-10');
  await page.waitForFunction(()=>document.getElementById('agenda-summary').textContent.includes('1 Pendientes'));
  await page.waitForFunction(()=>getComputedStyle(document.getElementById('agendaTab')).opacity==='1');
  await page.screenshot({path:path.join(artifacts,'agenda-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.click('.fc-timeGridDay-button');
  await page.waitForSelector('.fc-event');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(artifacts,'agenda-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1280,height:900});
  await page.click('#reservas-tab');
  const manualRow=page.locator('#reservas-list tr').filter({hasText:'manual@example.com'});await manualRow.waitFor();assert.ok((await manualRow.textContent()).includes('Cliente Manual'));assert.ok((await manualRow.textContent()).includes('3534000000'));
  const sdk=require(back+'/utils/mercadopago');const originalPreference=sdk.preferences.create;
  try {
    await Club.updateOne({_id:club._id},{$set:{mercadoPagoAccessToken:'TEST-browser-club'}});
    sdk.preferences.create=async(body,options)=>{assert.equal(options.access_token,'TEST-browser-club');assert.equal(body.external_reference,require(back+'/services/payments').paymentReference(manual));return {body:{init_point:'https://sandbox.example.test/manual-payment'}};};
    const [linkResponse]=await Promise.all([page.waitForResponse(r=>r.url()===apiBase+'/turnos/'+manual._id+'/payment-link'),manualRow.locator('.generar-pago').click()]).catch(e=>{console.log('Payment request diagnosis',dialogs,errors);throw e;});assert.equal(linkResponse.status(),200,await linkResponse.text());await page.waitForSelector('#club-payment-dialog[open]',{timeout:5000}).catch(e=>{console.log('Payment dialog diagnosis',dialogs,errors);throw e;});
    assert.equal(await page.locator('#club-payment-dialog a').first().getAttribute('href'),'https://sandbox.example.test/manual-payment');
    const share=page.locator('#club-payment-dialog a').filter({hasText:'Compartir por WhatsApp'});assert.ok((await share.getAttribute('href')).startsWith('https://wa.me/5493534000000?'));
    await page.locator('#club-payment-dialog').getByRole('button',{name:'Cerrar',exact:true}).click();
    await Turno.updateOne({_id:manual._id},{$set:{telefonoReservado:null}});
    await manualRow.locator('.generar-pago').click();await page.waitForSelector('#club-payment-dialog[open]');
    assert.ok((await page.locator('#club-payment-dialog').textContent()).includes('no hay un teléfono válido'));
    assert.equal(await page.locator('#club-payment-dialog a').count(),1);
    await page.locator('#club-payment-dialog').getByRole('button',{name:'Cerrar',exact:true}).click();
  }finally{sdk.preferences.create=originalPreference;}
  const [cancelResponse]=await Promise.all([page.waitForResponse(r=>r.url()===apiBase+'/turnos/'+manual._id+'/cancelar'),manualRow.locator('.cancelar-reserva').click()]);assert.equal(cancelResponse.status(),200);assert.equal((await Turno.findById(manual._id)).usuarioReservado,null);
  assert.equal((await fetch(apiBase+'/turnos/'+manual._id+'/marcar-pagado',{method:'PATCH',headers:{Authorization:'Bearer '+await page.evaluate(()=>localStorage.getItem('clubToken'))}})).status,409);
  const paid=await Turno.create({canchaId:String(cancha._id),club:club.email,deporte:'padel',fecha:'2030-01-10',hora:'09:00',precio:1000,usuarioReservado:'Pago Manual',emailReservado:'paid@example.com',bookingId:'web-paid'});
  await page.click('#info-tab');await page.click('#reservas-tab');const paidRow=page.locator('#reservas-list tr').filter({hasText:'paid@example.com'});await paidRow.waitFor();
  const [paidResponse]=await Promise.all([page.waitForResponse(r=>r.url()===apiBase+'/turnos/'+paid._id+'/marcar-pagado'),paidRow.locator('.marcar-pagada').click()]);assert.equal(paidResponse.status(),200);
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('#reservas-list tr')).some(r=>r.textContent.includes('paid@example.com')&&r.textContent.includes('Pagado')));
  const [paidCancel]=await Promise.all([page.waitForResponse(r=>r.url()===apiBase+'/turnos/'+paid._id+'/cancelar'),paidRow.locator('.cancelar-reserva').click()]);assert.equal(paidCancel.status(),409);
  await page.waitForTimeout(100);assert.ok(dialogs.some(t=>t.includes('reintegro')));assert.equal((await Turno.findById(paid._id)).pagado,true);assert.equal((await Turno.findById(paid._id)).pagoMetodo,'manual');
  await page.click('#compartir-tab');await page.waitForFunction(()=>document.getElementById('club-link-buscador').value.includes('club'));await page.click('#btn-generar-qr-buscador');await page.waitForSelector('#qr-buscador canvas');
  await page.goto(origin+'/estadisticas.html');await page.waitForFunction(()=>document.getElementById('kpi-reservas').textContent!=='—');
  assert.ok(await page.evaluate(()=>Chart.getChart('chart-reservas-dia')));
  await page.selectOption('#select-mes',{index:1});await page.waitForFunction(()=>document.getElementById('kpi-ocupacion').textContent!=='—');
  await page.goto(origin+'/panel-club.html');await page.waitForSelector('#canchas-tab');
  await page.click('#reservas-tab');await page.waitForSelector('#reservas-list tr');
  await page.waitForFunction(()=>document.getElementById('reservasTab').classList.contains('show') && getComputedStyle(document.getElementById('reservasTab')).opacity==='1');
  assert.equal(await page.locator('#clubTabs > li > .active').count(),1);
  await page.screenshot({path:path.join(artifacts,'panel-club-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(artifacts,'panel-club-mobile.png'),fullPage:true});
  await page.click('#cerrar-sesion');await page.waitForURL(origin+'/login-club.html');assert.equal(await page.evaluate(()=>localStorage.getItem('clubToken')),null);assert.deepEqual(errors,[]);
  console.log('Club management E2E passed: court CRUD, safe rendering, manual booking, preserved date, mobile agenda, payment links, cancellation, payment and logout. Isolated local database.');
 }finally{if(browser)await browser.close();if(api)await new Promise(r=>api.close(r));if(web)await new Promise(r=>web.close(r));await mongoose.disconnect();await mongo.stop();}
})().catch(e=>{console.error(e);process.exitCode=1;});
