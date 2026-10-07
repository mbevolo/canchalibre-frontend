const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const{JSDOM}=require('jsdom');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function page(file,query,fetch){const html=fs.readFileSync(file,'utf8');const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://frontend.test/'+file+query});const w=dom.window;
 await new Promise(resolve=>w.document.addEventListener('DOMContentLoaded',resolve,{once:true}));w.CanchaLibreApiUrl=p=>'https://backend.test'+p;w.fetch=fetch;
 for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))if(match[1].trim())w.eval(match[1]);return dom;}
test('recovery uses the selected account type, blocks duplicates and displays responses as text',async()=>{
 let finish,calls=[];const dom=await page('recuperar.html','?tipo=club',async(url,options)=>{calls.push({url,options});return new Promise(resolve=>{finish=resolve;});});
 try {const w=dom.window,form=w.document.getElementById('formRecuperar');w.document.getElementById('email').value='sports@example.test';
 form.dispatchEvent(new w.Event('submit',{cancelable:true}));form.dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(calls.length,1);assert.ok(calls[0].url.endsWith('/recuperar-club'));
 finish({ok:true,json:async()=>({mensaje:'<img src=x onerror=alert(1)>'})});await tick();assert.equal(w.document.querySelector('#mensaje img'),null);assert.match(w.document.getElementById('mensaje').textContent,/<img/);assert.equal(form.querySelector('button').disabled,false);
 w.document.getElementById('tipo-cuenta').value='usuario';form.dispatchEvent(new w.Event('submit',{cancelable:true}));assert.ok(calls[1].url.endsWith('/recuperar'));finish({ok:false,json:async()=>({error:'Reintentá'})});await tick();
 }finally{dom.window.close();}
});
test('reset preserves password spaces and recovers the submit button after network failure',async()=>{
 let reject,body;const dom=await page('reset.html','?tipo=club&token='+'a'.repeat(64),async(url,options)=>{assert.ok(url.endsWith('/reset-club'));body=JSON.parse(options.body);return new Promise((_,r)=>{reject=r;});});
 try {const w=dom.window,form=w.document.getElementById('formReset');w.document.getElementById('password').value=' Password123! ';
 form.dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(body.nuevaPassword,' Password123! ');reject(new Error('Offline'));await tick();assert.equal(form.querySelector('button').disabled,false);assert.match(w.document.getElementById('mensaje').textContent,/Intentá nuevamente/);
 }finally{dom.window.close();}
});
