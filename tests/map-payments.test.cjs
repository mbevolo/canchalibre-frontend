const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

test('map groups locations, creates popups lazily, escapes data and removes previous map', () => {
 const dom = new JSDOM('<div id="resultados"></div>', { runScripts:'outside-only',url:'https://frontend.test/' });
 try {
 const w=dom.window, markers=[];let removed=0;const centers=[];
 const source=fs.readFileSync('js/app.js','utf8');
 const start=source.indexOf('let mapaResultados = null;'),end=source.indexOf('// ==================================================',start);
 w.formatDuracion=n=>`${n} min`;let selected;
 w.guardarTurnoYRedirigir=(...args)=>{selected=args;};
 w.L={map:()=>({setView(coords){centers.push(coords);return this;},remove(){removed++;},fitBounds(){}}),tileLayer:()=>({addTo(){}}),marker:coords=>{const marker={coords,addTo(){return this;},bindPopup(popup){this.popup=popup;markers.push(this);return this;}};return marker;}};
 w.eval(source.slice(start,end));
 const fixture={latitud:-32,longitud:-63,canchaId:'court',club:"Club ');alert(1)//",deporte:'<img src=x onerror=alert(1)>',fecha:'2099-01-01',hora:'10:00',precio:1000,duracionTurno:60};
 w.mostrarMapa([fixture,{...fixture,hora:'11:00'},{...fixture,latitud:'NaN'},{...fixture,latitud:100}]);
 assert.equal(markers.length,1);assert.equal(typeof markers[0].popup,'function');
 const popup=markers[0].popup();assert.equal(popup.querySelectorAll('button').length,2);
 assert.equal(popup.querySelectorAll('img,script,[onclick]').length,0);assert.match(popup.textContent,/<img/);
 popup.querySelector('button').click();assert.equal(selected[1],fixture.club);assert.equal(selected[2],fixture.deporte);
 assert.deepEqual(Array.from(centers.at(-1)),[-32,-63]);
 w.mostrarMapa([{...fixture,latitud:0,longitud:0}]);assert.equal(removed,1);assert.equal(w.document.querySelectorAll('#map').length,1);assert.deepEqual(Array.from(markers.at(-1).coords),[0,0]);
 }finally{dom.window.close();}
});

test('featured checkout renders text and rejects executable or insecure links',()=>{
 const dom=new JSDOM('<div id="result"></div>',{runScripts:'outside-only'});
 try {const w=dom.window;const source=fs.readFileSync('js/club-advanced.js','utf8');w.eval(source.slice(0,source.indexOf('function showClubPaymentLink')));
 const container=w.document.getElementById('result');
 for(const pagoUrl of ['javascript:alert(1)','http://checkout.test','invalid'])assert.throws(()=>w.showFeaturedPaymentLink(container,{pagoUrl},'Title'));
 w.showFeaturedPaymentLink(container,{pagoUrl:'https://checkout.test/?x=%22'},'<img src=x>');
 assert.equal(container.querySelector('img'),null);assert.match(container.textContent,/<img/);assert.equal(container.querySelector('a').rel,'noopener noreferrer');
 }finally{dom.window.close();}
});
