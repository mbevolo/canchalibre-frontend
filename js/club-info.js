(async () => {
 const status=document.getElementById('club-status');
 try {
  const email=new URLSearchParams(location.search).get('club'); if(!email) throw Error('Seleccioná un club desde el buscador.');
  const response=await fetch(window.CanchaLibreApiUrl('/club/'+encodeURIComponent(email))); if(!response.ok) throw Error('No se pudo cargar el club. Intentá nuevamente.'); const club=await response.json();
  document.getElementById('club-name').textContent=club.nombre;
  document.getElementById('club-address').textContent=[club.direccion,club.localidad,club.provincia].filter(Boolean).join(' · ');
  document.getElementById('club-description').textContent=club.descripcion||'El club todavía no agregó una descripción.';
  const gallery=document.getElementById('club-gallery');
  (club.fotos||[]).forEach((src,index)=>{if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(src))return;const img=document.createElement('img');img.src=src;img.alt=`${club.nombre} · Foto ${index+1}`;img.loading=index?'lazy':'eager';gallery.append(img);});
  if(!gallery.children.length)gallery.textContent='Próximamente: fotos del club.';
  (club.servicios||[]).forEach(service=>{const badge=document.createElement('span');badge.textContent=service;document.getElementById('club-services').append(badge);});
  document.getElementById('club-phone').textContent=club.telefono?'Contacto: '+club.telefono:'';
  document.getElementById('club-search').href='index.html?clubId='+encodeURIComponent(club._id);
  document.getElementById('club-detail').hidden=false;status.textContent='';
  const lat=Number(club.latitud),lon=Number(club.longitud);const valid=club.latitud!=null&&club.longitud!=null&&Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180;
  if(valid){document.getElementById('club-directions').href=`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
   if(window.L){const map=L.map('club-map').setView([lat,lon],15);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}).addTo(map);const label=document.createElement('span');label.textContent=club.nombre;L.marker([lat,lon]).addTo(map).bindPopup(label).openPopup();}
   else document.getElementById('club-map-status').textContent='El mapa no pudo cargarse. Podés usar Cómo llegar.';
  }else{document.getElementById('club-map').hidden=true;document.getElementById('club-directions').hidden=true;document.getElementById('club-map-status').textContent='El club todavía no informó su ubicación en el mapa.';}
 }catch(error){status.textContent=error.message;}
})();
