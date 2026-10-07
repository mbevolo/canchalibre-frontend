const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('late admin section responses cannot overwrite the selected section',async()=>{
 const dom=new JSDOM('<div id="menu-superadmin"><button class="list-group-item" data-section="clubes">Clubes</button><button class="list-group-item" data-section="usuarios">Usuarios</button><button class="list-group-item" data-section="dashboard">Inicio</button></div><div id="superadmin-content"></div><button id="cerrar-sesion">Salir</button>',{runScripts:'outside-only',url:'https://frontend.test/'});
 try {const w=dom.window;await new Promise(resolve=>w.document.addEventListener('DOMContentLoaded',resolve,{once:true}));
 w.localStorage.setItem('superadminToken','test-token');w.CanchaLibreApiUrl=p=>'https://backend.test'+p;
 let resolveClubs;
 w.fetch=async url=>url.endsWith('/clubes')?new Promise(resolve=>{resolveClubs=resolve;}):({json:async()=>({ok:true,usuarios:[]})});
 w.eval(fs.readFileSync('js/superadmin.js','utf8'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 w.document.querySelector('[data-section="clubes"]').click();w.document.querySelector('[data-section="usuarios"]').click();await tick();
 assert.match(w.document.getElementById('superadmin-content').textContent,/No hay usuarios/);
 resolveClubs({json:async()=>({ok:true,clubes:[]})});await tick();
 assert.match(w.document.getElementById('superadmin-content').textContent,/No hay usuarios/);
 w.document.querySelector('[data-section="clubes"]').click();w.document.querySelector('[data-section="dashboard"]').click();
 resolveClubs({json:async()=>{throw new Error('Late failure');}});await tick();
 assert.match(w.document.getElementById('superadmin-content').textContent,/Dashboard/);
 }finally{dom.window.close();}
});
