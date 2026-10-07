const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const tick=()=>new Promise(r=>setImmediate(r));
test('club data save carries club JWT, address and numeric coordinates',async()=>{
 const dom=new JSDOM(fs.readFileSync('mis-datos.html','utf8'),{url:'https://front.test/',runScripts:'outside-only'});
 const w=dom.window;try{await new Promise(r=>w.document.addEventListener('DOMContentLoaded',r,{once:true}));
 w.localStorage.setItem('clubToken','club-jwt');w.CanchaLibreApiUrl=p=>'https://api.test'+p;w.alert=()=>{};const calls=[];
 w.L={map:()=>({setView(){return this},on(){}}),tileLayer:()=>({addTo(){}}),marker:()=>({addTo(){return this},setLatLng(){return this}})};
 const club={_id:'123456789012345678901234',nombre:'Club',email:'club@test.local',telefono:'123',direccion:'Anterior',latitud:-32,longitud:-63};
 w.fetch=async(url,opt={})=>{calls.push({url,opt});return {ok:true,json:async()=>url.includes('photon.komoot.io')?{features:[{geometry:{coordinates:[-63.25,-32.41]}}]}:url.endsWith('/ubicaciones')?{}:opt.method==='PUT'?{club:{...club,...JSON.parse(opt.body)}}:club}};
 const script=[...w.document.querySelectorAll('script')].find(s=>s.textContent.includes('let clubEmail'));
 w.eval(script.textContent);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await tick();await tick();
 w.document.getElementById('btn-editar-club').click();
 w.document.getElementById('provinciaClub').innerHTML='<option selected>Córdoba</option>';w.document.getElementById('localidadClub').innerHTML='<option selected>Villa María</option>';
 const address=w.document.getElementById('direccionClub');address.value='Nueva 123';address.dispatchEvent(new w.Event('input'));assert.equal(w.document.getElementById('latitudClub').value,'');address.dispatchEvent(new w.Event('change'));await new Promise(r=>setTimeout(r,30));assert.equal(w.document.getElementById('latitudClub').value,'-32.410000');assert.match(calls.find(x=>x.url.includes('photon.komoot.io')).url,/countrycode=AR/);assert.equal(w.document.getElementById('btn-guardar-club').disabled,false);w.document.getElementById('latitudClub').value='-32.41';w.document.getElementById('longitudClub').value='-63.25';
 w.document.getElementById('form-editar-club').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
 const saved=calls.find(x=>x.opt.method==='PUT');assert.equal(saved.opt.headers.Authorization,'Bearer club-jwt');assert.equal(JSON.parse(saved.opt.body).direccion,'Nueva 123');assert.equal(JSON.parse(saved.opt.body).latitud,-32.41);assert.equal(w.document.getElementById('direccionClub').disabled,true);
 const panel=new JSDOM(fs.readFileSync('panel-club.html','utf8'));assert.equal(panel.window.document.getElementById('perfil-direccion').readOnly,true);panel.window.close();
 }finally{w.close()}
});
