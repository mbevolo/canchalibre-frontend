const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(predicate) { for (let i=0;i<100;i++) { if (predicate()) return; await tick(); } throw new Error('Panel did not finish'); }
const response = (data, ok=true) => ({ ok, json: async () => data });
const booking = { _id: 'booking-1', fecha: '2099-01-01', hora: '10:00', nombreClub: '<img src=x onerror=alert(1)>', nombreCancha: '<script>bad()</script>', tipo: 'CONFIRMED', pagado: false };
async function page(fetch) {
  const dom = new JSDOM(fs.readFileSync('panel-usuario.html','utf8'), { runScripts: 'outside-only', url: 'https://frontend.test/panel-usuario.html', virtualConsole: new VirtualConsole() });
  const w=dom.window;
  await new Promise(resolve => w.document.addEventListener('DOMContentLoaded',resolve,{once:true}));
  w.alerts=[];w.alert=x=>w.alerts.push(x);w.confirm=()=>true;
  w.CanchalibreAuth={requireUserSession:async()=>true,authFetch:async(path,options)=>path==='/auth/me'&&!options?response({email:'user@example.test'}):fetch(path,options)};
  w.eval(fs.readFileSync('js/panel-usuario.js','utf8'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  await until(()=>w.document.getElementById('reservas-container').getAttribute('aria-busy')==='false');
  return dom;
}
test('user bookings escape stored HTML and past bookings have no mutation actions',async()=>{
 const dom=await page(async()=>response([booking,{...booking,_id:'past',fecha:'2000-01-01'}]));
 try { const d=dom.window.document;
 assert.match(d.getElementById('reservas-futuras').textContent,/<img/);
 assert.equal(d.getElementById('reservas-container').querySelectorAll('img,script').length,0);
 assert.equal(d.getElementById('reservas-pasadas').querySelectorAll('button').length,0);
 assert.equal(d.querySelectorAll('.btn-pagar').length,1);
 }finally{dom.window.close();}
});
test('booking actions block duplicates, recover network errors and preserve failed cancellations',async()=>{
 let finish, calls=0;
 const pending=new Promise(resolve=>{finish=resolve;});
 const dom=await page(async(path)=>path==='/api/me/reservas'?response([booking]):(++calls===1?pending:response({error:'Reintegro pendiente'},false)));
 try { const w=dom.window, button=w.document.querySelector('.btn-cancelar');
 button.click();button.click();assert.equal(calls,1);assert.equal(button.disabled,true);
 finish(Promise.reject(new Error('Offline')));
 await until(()=>!button.disabled);assert.match(w.alerts[0],/Intentá nuevamente/);
 button.click();await until(()=>w.alerts.length===2);assert.equal(calls,2);
 assert.match(w.alerts[1],/Reintegro pendiente/);assert.ok(w.document.querySelector('.card'));
 }finally{dom.window.close();}
});
test('booking load offers retry and payment links require HTTPS and an explicit click',async()=>{
 let loads=0,url='javascript:alert(1)';
 const dom=await page(async(path)=>{
 if(path==='/api/me/reservas'){if(++loads===1)throw new Error('Offline');return response([booking]);}
 return response({pagoUrl:url});
 });
 try {const w=dom.window;
 w.document.getElementById('reintentar-reservas').click();await until(()=>w.document.querySelector('.btn-pagar'));
 w.document.querySelector('.btn-pagar').click();await until(()=>w.alerts.length===1);
 assert.equal(w.document.querySelector('.enlace-pago'),null);
 url='https://checkout.test/pay';w.document.querySelector('.btn-pagar').click();await until(()=>w.document.querySelector('.enlace-pago'));
 const link=w.document.querySelector('.enlace-pago');assert.equal(link.href,url);assert.equal(link.rel,'noopener noreferrer');assert.equal(w.document.activeElement,link);
 }finally{dom.window.close();}
});
