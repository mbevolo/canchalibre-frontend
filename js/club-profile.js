(() => {
const services = ['Estacionamiento', 'Vestuarios', 'Duchas', 'Iluminación', 'Buffet', 'Alquiler de equipos', 'Cancha cubierta', 'Acceso accesible'];
document.addEventListener('DOMContentLoaded', async () => {
 const form = document.getElementById('perfil-publico'); if (!form) return;
 let fotos = []; const status = document.getElementById('perfil-estado'); const fileInput = document.getElementById('perfil-fotos');
 const request = (path, options = {}) => fetch(window.CanchaLibreApiUrl(path), { ...options, headers: { 'Authorization': 'Bearer ' + localStorage.getItem('clubToken'), ...options.headers } });
 const container = document.getElementById('perfil-servicios');
 services.forEach(service => { const label = document.createElement('label'); const input = document.createElement('input'); input.type = 'checkbox'; input.value = service; label.append(input, ' ' + service); container.append(label); });
 function render() {
  const gallery = document.getElementById('perfil-galeria'); gallery.replaceChildren();
  fotos.forEach((src, index) => { const card = document.createElement('div'); const img = document.createElement('img'); img.src = src; img.alt = 'Foto ' + (index + 1); img.width = 140; img.height = 100; img.style.objectFit = 'cover'; card.append(img);
   for (const [label, action] of [['Eliminar', () => fotos.splice(index, 1)], [index === 0 ? 'Portada' : 'Usar de portada', () => fotos.unshift(...fotos.splice(index, 1))]]) { const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn-sm btn-outline-secondary d-block mt-1'; button.textContent = label; button.disabled = index === 0 && label === 'Portada'; button.onclick = () => { action(); render(); }; card.append(button); } gallery.append(card);
  });
 }
 async function compress(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) throw Error('Elegí imágenes JPG, PNG o WebP de hasta 10 MB.');
  const url = URL.createObjectURL(file); const img = new Image();
  try { img.src = url; await img.decode(); const canvas = document.createElement('canvas'); let scale = Math.min(1, 1200 / Math.max(img.width,img.height));
   for (let attempt=0; attempt<8; attempt++) { canvas.width = Math.max(1, Math.round(img.width*scale)); canvas.height = Math.max(1,Math.round(img.height*scale)); const ctx=canvas.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height); const data=canvas.toDataURL('image/jpeg', .78); if(data.length<=120000) return data; scale *= .8; } throw Error('No se pudo optimizar esta imagen.');
  } finally { URL.revokeObjectURL(url); }
 }
 fileInput.addEventListener('change', async () => {
  if (fileInput.files.length + fotos.length > 6) { status.textContent='Podés cargar hasta 6 fotos.'; fileInput.value=''; return; }
  form.querySelector('button[type=submit]').disabled=true; fileInput.disabled=true;
  try { const additions=[]; for (const file of fileInput.files) additions.push(await compress(file)); fotos.push(...additions); render(); status.textContent='Fotos listas. Guardá la ficha para publicarlas.'; } catch(error) { status.textContent=error.message; }
  finally { fileInput.value=''; fileInput.disabled=false; form.querySelector('button[type=submit]').disabled=false; }
 });
 form.addEventListener('submit', async event => { event.preventDefault(); const button=form.querySelector('button[type=submit]'); button.disabled=true;
  try { const response=await request('/club/perfil/publico', {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({direccion:document.getElementById('perfil-direccion').value,descripcion:document.getElementById('perfil-descripcion').value,servicios:[...container.querySelectorAll('input:checked')].map(x=>x.value),fotos})}); const data=await response.json(); if(!response.ok) throw Error(data.error||'No se pudo guardar'); status.textContent='Ficha publicada correctamente.'; } catch(error) {status.textContent=error.message;} finally {button.disabled=false;}
 });
 try { const response=await request('/api/club/me'); if(!response.ok) throw Error('No se pudo cargar la ficha'); const data=await response.json(); const club=data.club||data; document.getElementById('perfil-direccion').value=club.direccion||''; document.getElementById('perfil-descripcion').value=club.descripcion||''; container.querySelectorAll('input').forEach(x=>x.checked=(club.servicios||[]).includes(x.value)); fotos=club.fotos||[]; render(); }
 catch(error){status.textContent=error.message; form.querySelector('button[type=submit]').disabled=true; fileInput.disabled=true;}
});
})();
