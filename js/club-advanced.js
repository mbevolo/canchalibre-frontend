function showFeaturedPaymentLink(container, data, title) {
  const url = new URL(data.pagoUrl);
  if (url.protocol !== 'https:') throw new Error('Enlace de pago inválido');
  const box = document.createElement('div'); box.className = 'alert alert-info mt-2';
  const label = document.createElement('p'); label.textContent = title;
  const link = document.createElement('a'); link.href = url.href; link.textContent = 'Abrir pago seguro';
  link.target = '_blank'; link.rel = 'noopener noreferrer';
  box.append(label, link); container.replaceChildren(box);
}

function showClubPaymentLink(data, reserva, nombreClub) {
  const paymentUrl = new URL(data.pagoUrl);
  if (paymentUrl.protocol !== 'https:') throw new Error('Enlace de pago inválido');
  document.getElementById('club-payment-dialog')?.remove();
  const dialog = document.createElement('dialog');
  dialog.id = 'club-payment-dialog';
  dialog.style.cssText = 'max-width:520px;width:90%;padding:24px;border:1px solid #ddd;border-radius:12px';
  const title = document.createElement('h3'); title.textContent = 'Link de pago generado'; dialog.appendChild(title);
  const link = document.createElement('a'); link.href = paymentUrl.href; link.textContent = paymentUrl.href;
  link.target = '_blank'; link.rel = 'noopener noreferrer'; link.style.overflowWrap = 'anywhere'; dialog.appendChild(link);
  const copy = document.createElement('button'); copy.textContent = 'Copiar enlace'; copy.className = 'btn btn-primary m-2';
  copy.onclick = async () => { try { await navigator.clipboard.writeText(paymentUrl.href); copy.textContent = 'Copiado'; } catch { copy.textContent = 'Seleccioná el enlace para copiarlo'; } }; dialog.appendChild(copy);
  const original = reserva.telefonoReservado || reserva.usuarioId?.telefono || '';
  let phone = String(original).replace(/[^0-9]/g, '');
  if (phone.startsWith('0')) phone = phone.slice(1);
  if (phone && !phone.startsWith('549')) phone = '549' + phone;
  if (phone.length >= 12 && phone.length <= 15) {
    const whatsapp = document.createElement('a');
    const message = `Hola! Te compartimos el link para pagar tu reserva en ${nombreClub || reserva.club}:\n${reserva.fecha} ${reserva.hora} hs\n${reserva.deporte}\n${paymentUrl.href}`;
    whatsapp.href = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(message);
    whatsapp.textContent = 'Compartir por WhatsApp'; whatsapp.target = '_blank'; whatsapp.rel = 'noopener noreferrer'; whatsapp.className = 'btn btn-success m-2'; dialog.appendChild(whatsapp);
  } else {
    const note = document.createElement('p'); note.textContent = 'Podés copiar el enlace; no hay un teléfono válido para compartir por WhatsApp.'; dialog.appendChild(note);
  }
  const close = document.createElement('button'); close.textContent = 'Cerrar'; close.className = 'btn btn-secondary m-2'; close.onclick = () => { dialog.close(); dialog.remove(); }; dialog.appendChild(close);
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  document.body.appendChild(dialog); dialog.showModal();
}

function escapeClubHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

// V2: adjuntar automáticamente el JWT del club a las llamadas protegidas del panel.
(() => {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    try {
      const url = typeof input === 'string' ? input : input.url;
      const token = localStorage.getItem('clubToken');
      if (token && url && url.startsWith(window.CanchaLibreApiUrl('/'))) {
        const headers = new Headers(
          init.headers || (typeof input !== 'string' && input.headers) || {}
        );
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        init = { ...init, headers };
      }
    } catch (e) {
      console.warn("No se pudo adjuntar autenticación de club a la solicitud.");
    }
    return originalFetch(input, init);
  };
})();

// ====== Configuración dinámica de precio y plazo de destaque ======
let PRECIO_DESTACADO = 4999;
let DIAS_DESTACADO = 30;

// Función global para cargar valores desde el backend
async function cargarConfigDestacado() {
  try {
    const res = await fetch(window.CanchaLibreApiUrl('/configuracion-destacado'));
    const data = await res.json();
    PRECIO_DESTACADO = data.precioDestacado;
    DIAS_DESTACADO = data.diasDestacado;
  } catch (e) {}
}

// ============================
// Lógica principal del panel
// ============================
document.addEventListener('DOMContentLoaded', async () => {
  const clubNav = document.getElementById('clubTabs');
  function alignSelectedClubTab() {
    const selected = clubNav?.querySelector('.nav-link.active');
    if (selected && clubNav.scrollWidth > clubNav.clientWidth) clubNav.scrollLeft = selected.offsetLeft - clubNav.offsetLeft;
  }
  clubNav?.addEventListener('shown.bs.tab', alignSelectedClubTab);
  window.addEventListener('resize', alignSelectedClubTab);
  await cargarConfigDestacado();

  const nombreClub = localStorage.getItem('clubNombre');
  const clubEmail = localStorage.getItem('clubEmail');
  let editandoCanchaId = null;
  let clubData = null;

  if (!nombreClub || !clubEmail) {
    alert('Debes iniciar sesión como club.');
    window.location.href = 'login-club.html';
    return;
  }

  // ============================
  // Helpers
  // ============================
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ============================================
// 🔗 Link + QR del buscador (para compartir)
// ============================================
function initLinkYQRBuscadorClub() {
  const inputLink = document.getElementById('club-link-buscador');
  const btnCopiar = document.getElementById('btn-copiar-link-buscador');
  const btnGenerarQR = document.getElementById('btn-generar-qr-buscador');
  const btnDescargarQR = document.getElementById('btn-descargar-qr-buscador');
  const contQR = document.getElementById('qr-buscador');

  if (!inputLink || !btnCopiar || !btnGenerarQR || !btnDescargarQR || !contQR) return;

  const clubId = (localStorage.getItem('clubId') || '').trim();
  if (!clubId) {
    inputLink.value = '⚠️ No se encontró clubId. Volvé a iniciar sesión como club.';
    btnCopiar.disabled = true;
    btnGenerarQR.disabled = true;
    btnDescargarQR.disabled = true;
    return;
  }

  const link = `https://canchalibre.ar/?clubId=${encodeURIComponent(clubId)}`;
  inputLink.value = link;

// ---- Generar QR / Descargar (con logo y sin alerts)
let ultimoQRDataUrl = null;

// Calidad real (descarga) vs tamaño visible (pantalla)
const QR_SIZE_REAL = 600;   // descargado (más nítido)
const QR_SIZE_VIEW = 220;   // visto en panel

// Logo (tiene que ser MISMO ORIGEN o data URL para evitar CORS)
const qrLogo = document.getElementById('qr-logo-centro');

// Cargar imagen (promesa)
function cargarImagen(imgEl) {
  return new Promise((resolve, reject) => {
    if (!imgEl) return reject(new Error('No hay logo'));
    if (imgEl.complete && imgEl.naturalWidth > 0) return resolve(true);
    imgEl.onload = () => resolve(true);
    imgEl.onerror = () => reject(new Error('No se pudo cargar el logo'));
  });
}

// Dibuja logo centrado + fondo blanco redondeado (para que no "ensucie" el QR)
function dibujarLogoEnCanvas(canvas, logoImg) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Mejorar nitidez del escalado del logo
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Tamaño del logo en el QR (ajustable)
  const logoSize = Math.round(canvas.width * 0.18); // ~18% del QR
  const padding = Math.round(logoSize * 0.18);
  const bgSize = logoSize + padding * 2;

  const x = (canvas.width - bgSize) / 2;
  const y = (canvas.height - bgSize) / 2;

  // Fondo blanco redondeado
  const r = Math.round(bgSize * 0.18);
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + bgSize, y, x + bgSize, y + bgSize, r);
  ctx.arcTo(x + bgSize, y + bgSize, x, y + bgSize, r);
  ctx.arcTo(x, y + bgSize, x, y, r);
  ctx.arcTo(x, y, x + bgSize, y, r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Dibujar logo centrado
  const lx = (canvas.width - logoSize) / 2;
  const ly = (canvas.height - logoSize) / 2;
  ctx.drawImage(logoImg, lx, ly, logoSize, logoSize);
}

// Convierte el QR generado a un canvas grande, le incrusta logo, y lo muestra a 220px
async function construirCanvasFinalQR(link) {
  // qrcodejs genera a veces <img> o <canvas>.
  const imgQR = contQR.querySelector('img');
  const canvasQR = contQR.querySelector('canvas');

  // Siempre vamos a terminar con un CANVAS grande
  const out = document.createElement('canvas');
  out.width = QR_SIZE_REAL;
  out.height = QR_SIZE_REAL;
  const ctx = out.getContext('2d');

  // Fondo blanco
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);

  if (canvasQR) {
    // Si ya es canvas, lo escalamos al grande
    ctx.imageSmoothingEnabled = false; // QR mejor sin smoothing
    ctx.drawImage(canvasQR, 0, 0, QR_SIZE_REAL, QR_SIZE_REAL);
  } else if (imgQR && imgQR.src) {
    // Si es imagen, esperamos a que cargue y la dibujamos
    await new Promise((resolve, reject) => {
      if (imgQR.complete && imgQR.naturalWidth > 0) return resolve();
      imgQR.onload = resolve;
      imgQR.onerror = reject;
    });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(imgQR, 0, 0, QR_SIZE_REAL, QR_SIZE_REAL);
  } else {
    throw new Error('No se pudo generar el QR');
  }

  // Incrustar logo (si existe)
  if (qrLogo && qrLogo.tagName === 'IMG') {
    await cargarImagen(qrLogo);

    // ⚠️ Si el logo viene de OTRO dominio sin CORS, toDataURL falla.
    // Solución: que el logo sea local: /img/logo-qr.png (mismo dominio).
    dibujarLogoEnCanvas(out, qrLogo);
  }

  // Mostrar en pantalla en tamaño chico (sin cambiar la calidad real)
  out.style.width = QR_SIZE_VIEW + 'px';
  out.style.height = QR_SIZE_VIEW + 'px';

  return out;
}

btnGenerarQR.addEventListener('click', async () => {
  if (typeof QRCode === 'undefined') {
    alert('❌ No se pudo cargar la librería de QR. Revisá que agregaste qrcode.min.js en el HTML.');
    return;
  }

  // No parpadea: no vaciamos y mostramos rápido; armamos final y reemplazamos 1 sola vez
  btnGenerarQR.disabled = true;
  btnDescargarQR.disabled = true;
  ultimoQRDataUrl = null;

  // Generar QR grande primero
  contQR.innerHTML = '';
  new QRCode(contQR, {
    text: link,
    width: QR_SIZE_REAL,
    height: QR_SIZE_REAL,
    correctLevel: QRCode.CorrectLevel.H
  });

  // Esperar un toque a que qrcodejs inserte
  setTimeout(async () => {
    try {
      const canvasFinal = await construirCanvasFinalQR(link);

      // Reemplazar una sola vez (evita "aparece/desaparece")
      contQR.innerHTML = '';
      contQR.appendChild(canvasFinal);

      // Preparar descarga (incluye logo)
      ultimoQRDataUrl = canvasFinal.toDataURL('image/png');
      btnDescargarQR.disabled = false;
    } catch (e) {
      console.error("Error en la interfaz");
      // Si falla toDataURL casi seguro es CORS del logo
      alert('⚠️ No se pudo preparar la descarga con logo. Asegurate de que el logo sea local (mismo dominio) o un dataURL.');
    } finally {
      btnGenerarQR.disabled = false;
    }
  }, 120);
});

btnDescargarQR.addEventListener('click', () => {
  if (!ultimoQRDataUrl) return;
  const a = document.createElement('a');
  a.href = ultimoQRDataUrl;
  a.download = `qr-canchalibre-club-${clubId}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

}



  // === BLOQUE DESTACAR CLUB ===
  async function renderBloqueDestacar() {
    const bloque = document.getElementById('bloque-destacar-club');
    if (!bloque) return;

    if (!clubData) {
      bloque.innerHTML = '';
      return;
    }

    if (clubData.destacado && clubData.destacadoHasta) {
      const hasta = new Date(clubData.destacadoHasta);
      const ahora = new Date();
      const diasRestantes = Math.ceil((hasta - ahora) / (1000 * 60 * 60 * 24));
      let advertencia = '';

      if (diasRestantes <= 3 && diasRestantes > 0) {
        advertencia = `
          <div class="alert alert-warning mb-2">
            ⚠️ <b>¡Atención!</b> El destaque de tu club vence en <b>${diasRestantes} día${diasRestantes === 1 ? '' : 's'}</b>.<br>
            <button class="btn btn-sm btn-outline-primary mt-2" id="btn-renovar-destacado">Renovar destaque</button>
          </div>
        `;
      } else if (diasRestantes <= 0) {
        advertencia = `
          <div class="alert alert-danger mb-2">
            ⏰ <b>¡El destaque de tu club venció!</b><br>
            <button class="btn btn-sm btn-primary mt-2" id="btn-renovar-destacado">Volver a destacar</button>
          </div>
        `;
      }

      bloque.innerHTML = `
        <div class="alert alert-success my-3">
          ⭐ <b>¡Tu club está destacado!</b> Aparecerá primero en los resultados hasta el <b>${hasta.toLocaleDateString('es-AR')}</b>
        </div>
        ${advertencia}
        <div id="pago-destacado-resultado"></div>
      `;

      const btnRenovar = document.getElementById('btn-renovar-destacado');
      if (btnRenovar) {
        btnRenovar.onclick = async function () {
          const btn = this;
          btn.disabled = true;
          btn.textContent = 'Generando link...';
          try {
            const res = await fetch(window.CanchaLibreApiUrl(`/club/${clubEmail}/destacar-pago`), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (res.ok && data.pagoUrl) {
              showFeaturedPaymentLink(document.getElementById('pago-destacado-resultado'), data, `Destaque por ${DIAS_DESTACADO} días ($${PRECIO_DESTACADO})`);
            } else {
              document.getElementById('pago-destacado-resultado').textContent =
                data.error || 'No se pudo generar el link de pago';
            }
          } catch (err) {
            document.getElementById('pago-destacado-resultado').textContent = 'Error generando el link de pago.';
          }
          btn.disabled = false;
          btn.textContent = 'Renovar destaque';
        };
      }
    } else {
      bloque.innerHTML = `
        <div class="alert alert-warning my-3">
          <b>¿Querés que tu club aparezca primero?</b><br>
          <span class="text-dark">
            Destacá tu club por <b>${DIAS_DESTACADO} días</b> por solo <b>$${PRECIO_DESTACADO}</b>.<br>
            ¡Aparecerá en primer lugar en los resultados del buscador!
          </span>
          <button class="btn btn-primary btn-sm ms-2 mt-2" id="btn-destacar-club">Destacar mi club</button>
        </div>
        <div id="pago-destacado-resultado"></div>
      `;

      const btnDestacar = document.getElementById('btn-destacar-club');
      if (btnDestacar) {
        btnDestacar.onclick = async function () {
          const btn = this;
          btn.disabled = true;
          btn.textContent = 'Generando link...';
          try {
            const res = await fetch(window.CanchaLibreApiUrl(`/club/${clubEmail}/destacar-pago`), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (res.ok && data.pagoUrl) {
              showFeaturedPaymentLink(document.getElementById('pago-destacado-resultado'), data, `Destaque por ${DIAS_DESTACADO} días ($${PRECIO_DESTACADO})`);
            } else {
              document.getElementById('pago-destacado-resultado').textContent =
                data.error || 'No se pudo generar el link de pago';
            }
          } catch (err) {
            document.getElementById('pago-destacado-resultado').textContent = 'Error generando el link de pago.';
          }
          btn.disabled = false;
          btn.textContent = 'Destacar mi club';
        };
      }
    }
  }

  // ============================
  // Cargar datos club
  // ============================
  try {
    const resClub = await fetch(window.CanchaLibreApiUrl(`/club/${clubEmail}`));
    clubData = await resClub.json();

    // Mostrar mensaje de bienvenida (solo si existe el div en esta página)
    const bienvenida = document.getElementById('info-bienvenida');
    if (bienvenida) {
      bienvenida.innerHTML = `
        <div class="alert alert-info">
          Bienvenido, <strong>${escapeClubHtml(clubData.nombre)}</strong>. Hoy hay reservas activas para tus canchas.
        </div>
      `;
      await cargarReservasHoy();
    }

    // Si estamos en la sección de edición de datos (mis-datos.html)
    const nombreInputEdit = document.getElementById('nombreClub');
    const telefonoInputEdit = document.getElementById('telefonoClub');
    const emailInputEdit = document.getElementById('emailClub');
    const latitudInput = document.getElementById('latitudClub');
    const longitudInput = document.getElementById('longitudClub');
    const direccionInput = document.getElementById('direccionClub');

    if (nombreInputEdit && telefonoInputEdit && emailInputEdit) {
      nombreInputEdit.value = clubData.nombre || '';
      telefonoInputEdit.value = clubData.telefono || '';
      emailInputEdit.value = clubData.email || '';

      if (direccionInput) direccionInput.value = clubData.direccion || '';
      if (latitudInput) latitudInput.value = clubData.latitud || '';
      if (longitudInput) longitudInput.value = clubData.longitud || '';

      await cargarProvinciasYLocalidades();
    }
  } catch (err) {
    console.error("❌ Error al obtener datos del club:");
  }

  // Render destaque + init QR/link
  await renderBloqueDestacar();
  initLinkYQRBuscadorClub();

  // ============================
  // Cerrar sesión
  // ============================
  const btnCerrar = document.getElementById('cerrar-sesion');
  if (btnCerrar) {
    btnCerrar.addEventListener('click', () => {
      localStorage.removeItem('clubToken');
      localStorage.removeItem('clubNombre');
      localStorage.removeItem('clubEmail');
      localStorage.removeItem('clubId');
      window.location.href = 'login-club.html';
    });
  }

  // ============================
  // Mapa (solo si existe #map)
  // ============================
  if (document.getElementById('map')) {
    if (window._map) window._map.remove();
    window._map = L.map('map').setView([-34.6, -58.38], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(window._map);

    let marker;
    try {
      const res = await fetch(window.CanchaLibreApiUrl(`/club/${clubEmail}`));
      if (!res.ok) throw new Error('Error al cargar club');
      const club = await res.json();

      if (club.latitud && club.longitud) {
        window._map.setView([club.latitud, club.longitud], 15);
        marker = L.marker([club.latitud, club.longitud]).addTo(window._map);
      }

      if (club.mercadoPagoAccessToken) {
        const inputToken = document.getElementById('input-access-token');
        if (inputToken) inputToken.value = club.mercadoPagoAccessToken;
      }
    } catch (error) {
      console.error("Error al cargar club:");
      alert('No se pudo cargar la información del club');
    }
  }

  // ============================
  // Guardar MP Token (si existe)
  // ============================
  const btnGuardarToken = document.getElementById('btn-guardar-access-token');
  if (btnGuardarToken) {
    btnGuardarToken.addEventListener('click', async () => {
      const token = document.getElementById('input-access-token').value.trim();
      if (!token) return alert('Debes ingresar el Access Token');

      const id = clubData?._id || localStorage.getItem('clubId');
      if (!id) return alert('Volvé a iniciar sesión como club.');
      const res = await fetch(window.CanchaLibreApiUrl(`/club/${id}/access-token`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token })
      });

      const data = await res.json();
      document.getElementById('mensaje-access-token').textContent = data.mensaje || data.error;
    });
  }

  // ============================
  // Canchas / Agenda / Reservas
  // ============================
  const canchasList = document.getElementById('canchas-list');
  const modal = new bootstrap.Modal(document.getElementById('modalCancha'));
  const modalTurno = new bootstrap.Modal(document.getElementById('modalTurno'));
  const turnoDetalleBody = document.getElementById('turno-detalle-body');
  const btnCancelarTurno = document.getElementById('btn-cancelar-turno');
  const btnReservarTurno = document.getElementById('btn-reservar-turno');

  const nombreInput = document.getElementById('nombre-cancha');
  const tipoInput = document.getElementById('tipo-cancha');
  const precioInput = document.getElementById('precio-cancha');
  const horaDesdeInput = document.getElementById('hora-desde');
  const horaHastaInput = document.getElementById('hora-hasta');

  const duracionInput = document.getElementById('duracion-turno');
  const nocturnoDesdeInput = document.getElementById('nocturno-desde');
  const precioNocturnoInput = document.getElementById('precio-nocturno');

  const diasCheckboxes = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  let turnoSeleccionado = null;

  function llenarSelectHoras() {
    const hDesde = document.getElementById('hora-desde');
    const hHasta = document.getElementById('hora-hasta');
    if (!hDesde || !hHasta) return;

    [hDesde, hHasta].forEach(select => {
      select.innerHTML = '';
      for (let h = 0; h < 24; h++) {
        const hora = `${h.toString().padStart(2, '0')}:00`;
        select.innerHTML += `<option value="${hora}">${hora}</option><option value="${hora.slice(0, 2)}:30">${hora.slice(0, 2)}:30</option>`;
      }
    });
    hHasta.insertAdjacentHTML('beforeend', '<option value="24:00">00:00 (medianoche)</option>');
  }

  document.getElementById('agregar-cancha')?.addEventListener('click', () => {
    editandoCanchaId = null;
    document.getElementById('modalCanchaLabel').textContent = 'Agregar cancha';
    document.querySelectorAll('#modalCancha .is-invalid').forEach(el => el.classList.remove('is-invalid'));
    document.querySelectorAll('#modalCancha .invalid-feedback').forEach(el => el.remove());
    llenarSelectHoras();

    if (!nombreInput || !tipoInput || !precioInput || !horaDesdeInput || !horaHastaInput) {
      alert('Faltan campos del formulario.');
      return;
    }

    nombreInput.value = '';
    tipoInput.value = 'futbol';
    precioInput.value = '';
    horaDesdeInput.value = '08:00';
    horaHastaInput.value = '22:00';
    if (duracionInput) duracionInput.value = '60';

    if (nocturnoDesdeInput) nocturnoDesdeInput.value = '';
    if (precioNocturnoInput) precioNocturnoInput.value = '';

    diasCheckboxes.forEach(d => {
      const checkbox = document.getElementById(`dia-${d}`);
      if (checkbox) checkbox.checked = true;
    });

    modal.show();
  });

  let courtsCache = [];
  const money = value => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value || 0));
  const normalizeDay = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function mostrarCanchas() {
    const query = document.getElementById('buscar-cancha').value.toLowerCase().trim();
    const courts = courtsCache.filter(c => `${c.nombre} ${c.deporte}`.toLowerCase().includes(query));
    document.getElementById('canchas-count').textContent = courtsCache.length;
    canchasList.innerHTML = '';
    if (!courts.length) canchasList.innerHTML = `<div class="col-12"><div class="management-empty">${courtsCache.length ? 'No hay canchas que coincidan con tu búsqueda.' : 'Todavía no agregaste canchas. Creá la primera para comenzar a recibir reservas.'}</div></div>`;
    courts.forEach(cancha => {
      const div = document.createElement('div'); div.className = 'col-md-6 col-xl-4';
      const days = new Set((cancha.diasDisponibles || []).map(normalizeDay));
      div.innerHTML = `<article class="court-card"><span class="court-sport">${escapeClubHtml(cancha.deporte)}</span><h3>${escapeClubHtml(cancha.nombre)}</h3><div class="court-price">${money(cancha.precio)} <small>/ turno</small></div><div class="court-meta"><span>${Number(cancha.duracionTurno || 60)} min por turno</span><span>${escapeClubHtml(cancha.horaDesde || '08:00')} a ${escapeClubHtml(cancha.horaHasta || '22:00')}</span></div><div class="court-days" aria-label="Días disponibles">${diasCheckboxes.map((d,i) => `<span class="${days.has(d) ? 'active' : ''}" title="${d}">${['Lu','Ma','Mi','Ju','Vi','Sá','Do'][i]}</span>`).join('')}</div><p class="court-night">${cancha.nocturnoDesde != null && cancha.precioNocturno != null ? `Tarifa nocturna desde ${String(cancha.nocturnoDesde).padStart(2,'0')}:00 · ${money(cancha.precioNocturno)}` : 'Misma tarifa durante todo el día'}</p><div class="court-actions"><button class="btn btn-primary btn-sm" data-action="agenda">Ver agenda</button><button class="btn btn-outline-primary btn-sm" data-action="edit">Editar</button><button class="btn btn-outline-danger btn-sm" data-action="delete" aria-label="Eliminar ${escapeClubHtml(cancha.nombre)}">Eliminar</button></div></article>`;
      div.querySelector('[data-action="edit"]').onclick = () => window.editarCancha(cancha._id);
      div.querySelector('[data-action="delete"]').onclick = () => window.eliminarCancha(cancha._id);
      div.querySelector('[data-action="agenda"]').onclick = () => { agendaCourt = cancha._id; bootstrap.Tab.getOrCreateInstance(document.getElementById('agenda-tab')).show(); };
      canchasList.appendChild(div);
    });
  }
  document.getElementById('buscar-cancha').addEventListener('input', mostrarCanchas);
  async function cargarCanchas() {
    canchasList.innerHTML = '<p role="status">Cargando canchas…</p>';
    try {
      const res = await fetch(window.CanchaLibreApiUrl(`/canchas/${clubEmail}`));
      if (!res.ok) throw new Error('No se pudieron cargar las canchas.');
      courtsCache = await res.json(); mostrarCanchas();
    } catch (error) {
      canchasList.innerHTML = '<div class="management-empty">No se pudieron cargar las canchas. <button class="btn btn-outline-primary btn-sm">Reintentar</button></div>';
      canchasList.querySelector('button').onclick = cargarCanchas;
    }
  }

  // ========== AGENDA ==========
  let agendaCourt = null, agendaDate = null, agendaView = null, activeCalendar = null, agendaRequest = 0, agendaBuild = 0;
  const localDate = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  async function cargarEventosSemana(canchaId, fechaInicioSemana) {
    const request = ++agendaRequest, calendar = activeCalendar;
    const status = document.getElementById('agenda-status');
    status.textContent = 'Cargando turnos…';
    calendar?.removeAllEvents();
    document.getElementById('agenda-summary').textContent = '';
    try {
      const res = await fetch(window.CanchaLibreApiUrl(`/turnos-generados?fecha=${fechaInicioSemana.split('T')[0]}`));
      if (!res.ok) throw new Error('No se pudieron cargar los turnos. Usá Actualizar para reintentar.');
      const turnos = await res.json();
      if (request !== agendaRequest || calendar !== activeCalendar) return;
      const slots = turnos.filter(t => String(t.canchaId) === String(canchaId));
      const events = slots.map(t => {
        const start = new Date(`${t.fecha}T${t.hora}`), past = start < new Date();
        const end = new Date(start.getTime() + Number(t.duracionTurno || 60)*60000);
        const color = past ? '#64748b' : !t.usuarioReservado ? '#16836a' : t.pagado ? '#2563eb' : '#b66b13';
        return { title: t.usuarioReservado ? `${t.pagado ? 'Pagado' : 'Pendiente'} · ${t.usuarioReservado}` : 'Libre', start, end, color, id: t.realId || `${t.canchaId}-${t.fecha}-${t.hora}`, extendedProps: {...t, pasado: past} };
      });
      calendar.addEventSource(events);
      const visible = events.filter(e => e.start >= calendar.view.activeStart && e.start < calendar.view.activeEnd);
      document.getElementById('agenda-summary').innerHTML = [['Libres','#16836a',e=>!e.extendedProps.usuarioReservado&&!e.extendedProps.pasado],['Pendientes','#b66b13',e=>e.extendedProps.usuarioReservado&&!e.extendedProps.pagado],['Pagados','#2563eb',e=>e.extendedProps.usuarioReservado&&e.extendedProps.pagado]].map(([label,color,filter])=>`<span><i style="background:${color}"></i><strong>${visible.filter(filter).length}</strong> ${label}</span>`).join('');
      status.textContent = visible.length ? 'Los turnos pasados se muestran en gris.' : 'No hay turnos para este período. Revisá los días y horarios de la cancha.';
    } catch(error) { if (request === agendaRequest) status.textContent = error.message; }
  }
  document.getElementById('agenda-refresh').onclick = () => cargarAgendas();
  document.getElementById('agenda-fecha').onchange = function() { if(this.value) activeCalendar?.gotoDate(this.value); };

  async function cargarAgendas() {
    const build = ++agendaBuild;
    const agendasContainer = document.getElementById('agendas-container');
    if (!agendasContainer) return;

    if (activeCalendar) { agendaDate = activeCalendar.getDate(); agendaView = activeCalendar.view.type; activeCalendar.destroy(); activeCalendar = null; }
    ++agendaRequest;
    agendasContainer.innerHTML = `<div id="calendar-unico"></div>`;

    const selectCancha = document.getElementById('select-cancha-agenda');
    if (!selectCancha) return;

    // Evitar duplicados
    selectCancha.innerHTML = '';

    let resCanchas;
    try { resCanchas = await fetch(window.CanchaLibreApiUrl(`/canchas/${clubEmail}`)); } catch { document.getElementById('agenda-status').textContent = 'No se pudo conectar. Usá Actualizar para reintentar.'; return; }
    if (!resCanchas.ok) { document.getElementById('agenda-status').textContent = 'No se pudieron cargar las canchas. Usá Actualizar para reintentar.'; return; }
    const canchas = await resCanchas.json();
    if (build !== agendaBuild) return;

    if (!canchas || canchas.length === 0) {
      agendasContainer.innerHTML = '<div class="alert alert-warning">No hay canchas creadas.</div>';
      return;
    }

    canchas.forEach((cancha, i) => {
      const opt = document.createElement('option');
      opt.value = cancha._id;
      opt.textContent = `${cancha.nombre} (${cancha.deporte})`;
      if (i === 0) opt.selected = true;
      selectCancha.appendChild(opt);
    });

    async function renderCalendario(canchaId) {
      if (activeCalendar) { agendaDate = activeCalendar.getDate(); agendaView = activeCalendar.view.type; }
      const calendarEl = document.getElementById('calendar-unico');
      const cancha = canchas.find(c => c._id === canchaId);
      if (!calendarEl || !cancha) return;

      // Semana actual (lunes)
      const hoy = new Date();
      const diaSemana = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1;
      hoy.setDate(hoy.getDate() - diaSemana);

      if (calendarEl._calendar) {
        calendarEl._calendar.destroy();
      }

      const calendar = new FullCalendar.Calendar(calendarEl, {
        themeSystem: 'bootstrap5',
        initialView: agendaView || (window.innerWidth < 768 ? 'timeGridDay' : 'timeGridWeek'),
        initialDate: agendaDate || new Date(),
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGridDay,timeGridWeek,listWeek' },
        buttonText: { today: 'Hoy', day: 'Día', week: 'Semana', list: 'Lista' },
        nowIndicator: true,
        eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
        locale: 'es',
        firstDay: 1,
        height: 'auto',
        expandRows: true,
        timeZone: 'local',
        allDaySlot: false,
        slotMinTime: cancha.horaDesde || '08:00',
        slotMaxTime: cancha.horaHasta === '00:00' ? '24:00' : cancha.horaHasta || '22:00',
        slotDuration: '00:30:00',
        events: [],
        eventClick: async function (info) {
          const turno = info.event.extendedProps;
          turnoSeleccionado = turno;
          document.getElementById('modalTurnoLabel')?.replaceChildren(document.createTextNode(cancha.nombre));

          const [anio, mes, dia] = turno.fecha.split('-');
          const fechaFormateada = `${dia}/${mes}/${anio}`;

          if (turno.usuarioReservado) {
            let botonesDetalle = '';
            if (!turno.pagado) {
              botonesDetalle = `
                <button class="btn btn-sm btn-success me-2" id="detalle-generar-pago">Generar link de pago</button>
                <button class="btn btn-sm btn-primary" id="detalle-marcar-pagado">Marcar como pagado</button>
              `;
            }

            turnoDetalleBody.innerHTML = `
              <p><strong>Importe:</strong> ${money(turno.precio)} · ${Number(turno.duracionTurno || 60)} min</p><p><strong>Usuario:</strong> ${escapeClubHtml(turno.usuarioReservado)}</p>
              <p><strong>Fecha:</strong> ${fechaFormateada}</p>
              <p><strong>Hora:</strong> ${escapeClubHtml(turno.hora)} hs</p>
              <p><strong>Estado:</strong> ${turno.pagado ? 'Pagado' : 'Pendiente de pago'}</p>
              <div class="mt-2">${botonesDetalle}</div>
            `;

            btnCancelarTurno.style.display = 'block';
            btnReservarTurno.style.display = 'none';
          } else {
            turnoDetalleBody.innerHTML = `
              <p><strong>Fecha:</strong> ${fechaFormateada}</p>
              <p><strong>Hora:</strong> ${escapeClubHtml(turno.hora)} hs</p>
              <p><strong>Importe:</strong> ${money(turno.precio)} · ${Number(turno.duracionTurno || 60)} min</p><p>${turno.pasado ? 'Este turno ya pasó y no puede reservarse.' : 'Completá los datos del cliente para reservar.'}</p>
              <label class="form-label" for="nombreCliente">Nombre del cliente</label><input type="text" id="nombreCliente" placeholder="Nombre del cliente" class="form-control mb-2">
              <label class="form-label" for="telefonoCliente">Teléfono</label><input type="text" id="telefonoCliente" placeholder="Teléfono del cliente" class="form-control mb-2">
              <label class="form-label" for="emailCliente">Email</label><input type="email" id="emailCliente" placeholder="Email del cliente" class="form-control mb-2">
            `;

            btnCancelarTurno.style.display = 'none';
            btnReservarTurno.style.display = turno.pasado ? 'none' : 'block';
          }

          modalTurno.show();

          setTimeout(() => {
            const btnPago = document.getElementById('detalle-generar-pago');
            const btnPagado = document.getElementById('detalle-marcar-pagado');

            if (btnPago) {
              btnPago.onclick = async () => {
                if (btnPago.disabled) return;
                btnPago.disabled = true;
                try {
                  const res = await fetch(window.CanchaLibreApiUrl(`/turnos/${turno.realId}/payment-link`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                  });
                  const data = await res.json();
                  if (!res.ok || !data.pagoUrl) {
                    alert(data.error || 'No se pudo generar el link de pago.');
                    return;
                  }

                  const resReserva = await fetch(window.CanchaLibreApiUrl(`/turnos/${turno.realId}`));
                  const reserva = await resReserva.json();
                  if (!resReserva.ok) throw new Error(reserva.error || 'No se pudo consultar la reserva');

                  showClubPaymentLink(data, reserva, clubData?.nombre);
                } catch (err) {
                  alert('Error generando el link de pago: ' + err.message);
                } finally { btnPago.disabled = false; }
              };
            }

            if (btnPagado) {
              btnPagado.onclick = async () => {
                if (btnPagado.disabled) return;
                const confirmar = confirm('¿Confirmás que el usuario pagó en efectivo u otro medio?');
                if (!confirmar) return;

                btnPagado.disabled = true;
                try {
                  const res = await fetch(window.CanchaLibreApiUrl(`/turnos/${turno.realId}/marcar-pagado`), {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' }
                  });
                  if (!res.ok) {
                    const errorData = await res.json();
                    alert(errorData.error || 'No se pudo marcar como pagada.');
                  } else {
                    await cargarReservas();
                    modalTurno.hide();
                    await cargarAgendas();
                  }
                } catch (err) {
                  alert('Error al marcar como pagada.');
                } finally { btnPagado.disabled = false; }
              };
            }
          }, 0);
        },
        datesSet: async function (info) {
          agendaDate = info.view.calendar.getDate(); agendaView = info.view.type;
          document.getElementById('agenda-fecha').value = localDate(agendaDate);
          await cargarEventosSemana(cancha._id.toString(), info.startStr);
        }
      });

      activeCalendar = calendar;
      calendarEl._calendar = calendar;
      calendar.render();

      calendar.updateSize();
    }

    selectCancha.onchange = async function () {
      agendaCourt = this.value;
      await renderCalendario(this.value);
    };

    agendaCourt = canchas.some(c => c._id === agendaCourt) ? agendaCourt : canchas[0]._id;
    selectCancha.value = agendaCourt;
    await renderCalendario(agendaCourt);
  }

  // Mostrar agendas al entrar en la pestaña
  document.getElementById('agenda-tab')?.addEventListener('shown.bs.tab', async () => {
    await cargarAgendas();
    setTimeout(() => {
      const calendarEl = document.getElementById('calendar-unico');
      if (calendarEl && calendarEl._calendar) {
        calendarEl._calendar.updateSize();
      }
      window.dispatchEvent(new Event('resize'));
    }, 200);
  });

  await cargarCanchas();

  // Guardar cancha
  document.getElementById('guardar-cancha')?.addEventListener('click', async () => {
    const nombre = nombreInput.value.trim();
    const deporte = tipoInput.value.trim();
    const precio = precioInput.value.trim();
    const horaDesde = horaDesdeInput.value.trim();
    const horaHasta = horaHastaInput.value.trim();
    const dias = diasCheckboxes.filter(d => document.getElementById(`dia-${d}`)?.checked);

    // limpiar errores previos
    [nombreInput, tipoInput, precioInput, horaDesdeInput, horaHastaInput, precioNocturnoInput].forEach(i => {
      if (!i) return;
      i.classList.remove('is-invalid');
      const msg = i.parentElement?.querySelector('.invalid-feedback');
      if (msg) msg.remove();
    });

    let errores = [];
    function marcarError(input, mensaje) {
      if (!input) return;
      input.classList.add('is-invalid');
      if (!input.parentElement.querySelector('.invalid-feedback')) {
        const div = document.createElement('div');
        div.className = 'invalid-feedback';
        div.textContent = mensaje;
        input.parentElement.appendChild(div);
      }
      errores.push(input);
    }

    if (!nombre) marcarError(nombreInput, 'Campo obligatorio');
    if (!deporte) marcarError(tipoInput, 'Campo obligatorio');
    if (!precio) marcarError(precioInput, 'Campo obligatorio');
    if (!horaDesde) marcarError(horaDesdeInput, 'Campo obligatorio');
    if (!horaHasta) marcarError(horaHastaInput, 'Campo obligatorio');

    if (precio && (isNaN(precio) || Number(precio) <= 0)) {
      marcarError(precioInput, 'Debe ser un número mayor que 0');
    }

    const toMinutes = value => { const [h, m] = value.split(':').map(Number); return h * 60 + m; };
    const desde = toMinutes(horaDesde);
    const hasta = toMinutes(horaHasta);
    if (horaDesde && horaHasta && hasta <= desde) {
      marcarError(horaHastaInput, '"Hasta" debe ser mayor que "Desde"');
    }

    if (!dias.length) marcarError(nombreInput, 'Seleccioná al menos un día disponible.');
    if (Boolean(nocturnoDesdeInput.value) !== Boolean(precioNocturnoInput.value) || (precioNocturnoInput.value && Number(precioNocturnoInput.value) <= 0)) marcarError(precioNocturnoInput, 'Completá el horario y un precio nocturno mayor a cero.');

    if (errores.length > 0) {
      errores[0].focus();
      alert('⚠️ Por favor corregí los campos marcados en rojo antes de guardar.');
      return;
    }

    const canchaData = {
      nombre,
      deporte,
      precio,
      horaDesde,
      horaHasta,
      diasDisponibles: dias,
      clubEmail: clubEmail,
      duracionTurno: duracionInput ? Number(duracionInput.value) : 60,
      nocturnoDesde: (nocturnoDesdeInput && nocturnoDesdeInput.value !== '') ? Number(nocturnoDesdeInput.value) : null,
      precioNocturno: (precioNocturnoInput && precioNocturnoInput.value !== '') ? Number(precioNocturnoInput.value) : null
    };

    const save = document.getElementById('guardar-cancha');
    if (save.disabled) return;
    save.disabled = true; save.textContent = 'Guardando…';
    try {
      const res = await fetch(window.CanchaLibreApiUrl(editandoCanchaId ? `/canchas/${editandoCanchaId}` : '/canchas'), { method: editandoCanchaId ? 'PUT' : 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(canchaData) });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'No se pudo guardar la cancha'); }
      modal.hide(); await cargarCanchas();
    } catch(error) { alert(error.message); }
    finally { save.disabled = false; save.textContent = 'Guardar cancha'; }

  });

  // Editar cancha
  window.editarCancha = async function (id) {
    try {
    document.getElementById('modalCanchaLabel').textContent = 'Editar cancha';
    document.querySelectorAll('#modalCancha .is-invalid').forEach(el => el.classList.remove('is-invalid'));
    document.querySelectorAll('#modalCancha .invalid-feedback').forEach(el => el.remove());
    const res = await fetch(window.CanchaLibreApiUrl(`/canchas/${clubEmail}`));
    if (!res.ok) throw new Error('Error al cargar canchas');
    const canchas = await res.json();

    const cancha = canchas.find(c => c._id === id);
    if (!cancha) return alert('Cancha no encontrada');

    llenarSelectHoras();
    window._canchaAEditar = cancha;

    document.getElementById('modalCancha')?.addEventListener('shown.bs.modal', () => {
      const cancha = window._canchaAEditar;
      if (!cancha) return;

      editandoCanchaId = cancha._id;
// ✅ Asegurar que los selects tengan opciones antes de setear value
if (horaDesdeInput && horaHastaInput) {
  const horas = [];
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, '0');
    horas.push(`${hh}:00`, `${hh}:30`);
  }

  // Si están vacíos, los rellenamos
  if (!horaDesdeInput.options.length) {
    horaDesdeInput.innerHTML = horas.map(x => `<option value="${x}">${x}</option>`).join('');
  }
  if (!horaHastaInput.options.length) {
    horaHastaInput.innerHTML = horas.map(x => `<option value="${x}">${x}</option>`).join('');
  }
}

      nombreInput.value = cancha.nombre || '';
      tipoInput.value = cancha.deporte || 'futbol';
      precioInput.value = cancha.precio || '';
     if (horaDesdeInput) horaDesdeInput.value = cancha.horaDesde || '08:00';
if (horaHastaInput) horaHastaInput.value = cancha.horaHasta || '22:00';
if (duracionInput) duracionInput.value = String(cancha.duracionTurno || 60);

      if (nocturnoDesdeInput) {
        nocturnoDesdeInput.value = (cancha.nocturnoDesde !== null && cancha.nocturnoDesde !== undefined)
          ? String(cancha.nocturnoDesde)
          : '';
      }
      if (precioNocturnoInput) {
        precioNocturnoInput.value = (cancha.precioNocturno !== null && cancha.precioNocturno !== undefined)
          ? String(cancha.precioNocturno)
          : '';
      }

      diasCheckboxes.forEach(dia => {
        const checkbox = document.getElementById(`dia-${dia}`);
        if (checkbox) {
          checkbox.checked = cancha.diasDisponibles
            ? cancha.diasDisponibles.some(value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === dia)
            : true;
        }
      });

      window._canchaAEditar = null;
    }, { once: true });

    modal.show();
    } catch(error) { alert(error.message || 'No se pudo abrir la cancha.'); }
  };

  // Eliminar cancha
  window.eliminarCancha = async function (id) {
    if (!confirm('¿Eliminar esta cancha? Sus turnos dejarán de estar disponibles.')) return;
    try {
      const res = await fetch(window.CanchaLibreApiUrl(`/canchas/${id}`), { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar cancha');
      await cargarCanchas();
    } catch (error) {
      alert(error.message);
    }
  };

  // Cancelar turno
  btnCancelarTurno?.addEventListener('click', async () => {
    if (turnoSeleccionado && turnoSeleccionado.realId) {
      const confirmar = confirm('¿Estás seguro de que querés cancelar este turno?');
      if (!confirmar) return;

      btnCancelarTurno.disabled = true;
      try {
      const res = await fetch(window.CanchaLibreApiUrl(`/turnos/${turnoSeleccionado.realId}/cancelar`), {
        method: 'PATCH'
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Error al cancelar turno'); }

      modalTurno.hide();
      await cargarReservas();
      await cargarAgendas();
      } catch (error) { alert(error.message || 'No se pudo cancelar el turno'); }
      finally { btnCancelarTurno.disabled = false; }
    }
  });

  // Reservar turno manual
  btnReservarTurno?.addEventListener('click', async () => {
    if (btnReservarTurno.disabled) return;
    const nombreCliente = document.getElementById('nombreCliente')?.value.trim();
    const telefonoCliente = document.getElementById('telefonoCliente')?.value.trim();
    const emailCliente = document.getElementById('emailCliente')?.value.trim();

    if (!nombreCliente || !telefonoCliente || !emailCliente) {
      return alert('Todos los campos son obligatorios.');
    }

    btnReservarTurno.disabled = true;
    try {
    const res = await fetch(window.CanchaLibreApiUrl('/reservar-turno'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deporte: turnoSeleccionado.deporte,
        fecha: turnoSeleccionado.fecha,
        hora: turnoSeleccionado.hora,
        club: turnoSeleccionado.club,
        precio: turnoSeleccionado.precio,
        usuarioReservado: nombreCliente,
        emailReservado: emailCliente,
        telefonoReservado: telefonoCliente,
        metodoPago: 'efectivo',
        canchaId: turnoSeleccionado.canchaId
      })
    });

    if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Error al reservar turno'); }

    modalTurno.hide();
    await cargarReservas();
    await cargarAgendas();
    } catch (error) { alert(error.message || 'No se pudo reservar el turno'); }
    finally { btnReservarTurno.disabled = false; }
  });

  // ============================
  // RESERVAS
  // ============================
  async function cargarReservas() {
    const reservasList = document.getElementById('reservas-list');
    const historialList = document.getElementById('historial-list');
    if (!reservasList) return;

    reservasList.innerHTML = '';
    if (historialList) historialList.innerHTML = '';

    const res = await fetch(window.CanchaLibreApiUrl(`/reservas/${clubEmail}`));
    const reservas = await res.json();

    const ahora = new Date();

    function getDateTimeObj(fecha, hora) {
      let partes;
      if (fecha.includes('-')) {
        partes = fecha.split('-');
        return new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]), ...hora.split(':').map(Number));
      } else if (fecha.includes('/')) {
        partes = fecha.split('/');
        return new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]), ...hora.split(':').map(Number));
      }
      return null;
    }

    const futuras = [];
    const pasadas = [];
    reservas.forEach(r => {
      const fechaHora = getDateTimeObj(r.fecha, r.hora);
      if (fechaHora && fechaHora >= ahora) futuras.push(r);
      else pasadas.push(r);
    });

    function formatearTelefono(tel) {
      if (!tel) return '';
      let numero = String(tel).replace(/[^0-9]/g, '');
      if (numero.length >= 10) numero = numero.slice(-10);
      return '549' + numero;
    }

    futuras.forEach(r => {
      const [anio, mes, dia] = r.fecha.includes('-')
        ? r.fecha.split('-')
        : [r.fecha.split('/')[2], r.fecha.split('/')[1], r.fecha.split('/')[0]];

      const fechaFormateada = `${dia}/${mes}/${anio}`;
      const estadoPago = r.pagado ? 'Pagado' : 'Pendiente';

      let botones = `<button class="btn btn-sm btn-danger cancelar-reserva me-2" data-id="${r._id}">Cancelar</button>`;
      if (!r.pagado) {
        botones += `<button class="btn btn-sm btn-success generar-pago me-2" data-id="${r._id}">Generar link de pago</button>`;
        botones += `<button class="btn btn-sm btn-primary marcar-pagada" data-id="${r._id}">Marcar como pagada</button>`;
      }

      const telefonoReserva = r.usuarioTelefono || '';
      const telefonoWa = telefonoReserva ? formatearTelefono(telefonoReserva) : '';

      const iconoWhatsApp = `
        WhatsApp
      `;

      let htmlTelefono;
      if (telefonoWa) {
        htmlTelefono = `
          📱 <a href="https://wa.me/${telefonoWa}" target="_blank" style="text-decoration: none;">
            ${escapeClubHtml(telefonoReserva)} ${iconoWhatsApp}
          </a>
        `;
      } else {
        htmlTelefono = `
          📱 <span title="No hay teléfono cargado" style="opacity: 0.6;">
            (sin teléfono) ${iconoWhatsApp}
          </span>
        `;
      }

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${escapeClubHtml(r.nombreCancha || 'Sin nombre')}</td>
        <td>${fechaFormateada}</td>
        <td>${escapeClubHtml(r.hora)}</td>
        <td>
          ${escapeClubHtml(r.usuarioNombre || r.usuarioReservado || '')} ${escapeClubHtml(r.usuarioApellido || '')}<br>
          📧 ${escapeClubHtml(r.usuarioEmail || r.emailReservado)}<br>
          ${htmlTelefono}
        </td>
        <td>${estadoPago}</td>
        <td>${botones}</td>
      `;
      reservasList.appendChild(row);
    });

    if (historialList) {
      pasadas.forEach(r => {
        const [anio, mes, dia] = r.fecha.includes('-')
          ? r.fecha.split('-')
          : [r.fecha.split('/')[2], r.fecha.split('/')[1], r.fecha.split('/')[0]];
        const fechaFormateada = `${dia}/${mes}/${anio}`;
        const estadoPago = r.pagado ? 'Pagado' : 'Pendiente';

        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${escapeClubHtml(r.nombreCancha || 'Sin nombre')}</td>
          <td>${fechaFormateada}</td>
          <td>${escapeClubHtml(r.hora)}</td>
          <td>${escapeClubHtml(r.emailReservado)}</td>
          <td>${estadoPago}</td>
        `;
        historialList.appendChild(row);
      });
    }

    // Acciones
    reservasList.querySelectorAll('.cancelar-reserva').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const confirmar = confirm('¿Estás seguro de que querés cancelar esta reserva?');
        if (!confirmar) return;
        btn.disabled = true;
        try {
          const res = await fetch(window.CanchaLibreApiUrl(`/turnos/${id}/cancelar`), { method: 'PATCH' });
          if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'No se pudo cancelar la reserva'); }
          await cargarReservas();
        } catch (error) { alert(error.message); }
        finally { btn.disabled = false; }
      });
    });

    reservasList.querySelectorAll('.generar-pago').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (btn.disabled) return;
        const id = btn.getAttribute('data-id');
        btn.disabled = true;
        try {
          const res = await fetch(window.CanchaLibreApiUrl(`/turnos/${id}/payment-link`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          const data = await res.json();
          if (!res.ok || !data.pagoUrl) {
            alert(data.error || 'No se pudo generar el link de pago.');
            return;
          }

          const resReserva = await fetch(window.CanchaLibreApiUrl(`/turnos/${id}`));
          const reserva = await resReserva.json();
                  if (!resReserva.ok) throw new Error(reserva.error || 'No se pudo consultar la reserva');

          showClubPaymentLink(data, reserva, clubData?.nombre);
        } catch (err) {
          alert('Error generando el link de pago: ' + err.message);
        } finally { btn.disabled = false; }
      });
    });

    reservasList.querySelectorAll('.marcar-pagada').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (btn.disabled) return;
        const id = btn.getAttribute('data-id');
        const confirmar = confirm('¿Confirmás que el usuario pagó en efectivo u otro medio?');
        if (!confirmar) return;

        btn.disabled = true;
        try {
          const res = await fetch(window.CanchaLibreApiUrl(`/turnos/${id}/marcar-pagado`), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' }
          });
          if (!res.ok) {
            const errorData = await res.json();
            alert(errorData.error || 'No se pudo marcar como pagada.');
          } else {
            await cargarReservas();
          }
        } catch (err) {
          alert('Error al marcar como pagada.');
        } finally { btn.disabled = false; }
      });
    });

    if (futuras.length === 0) reservasList.innerHTML = '<tr><td colspan="6">No hay reservas futuras.</td></tr>';
    if (historialList && pasadas.length === 0) historialList.innerHTML = '<tr><td colspan="5">No hay reservas pasadas.</td></tr>';
  }

  await cargarReservas();

  // ============================
  // Provincias/Localidades (Mis Datos)
  // ============================
  async function cargarProvinciasYLocalidades() {
    const provinciaSelect = document.getElementById('provinciaClub');
    const localidadSelect = document.getElementById('localidadClub');
    if (!provinciaSelect || !localidadSelect) return;

    localidadSelect.disabled = true;

    try {
      const res = await fetch(window.CanchaLibreApiUrl('/ubicaciones'));
      const data = await res.json();

      provinciaSelect.innerHTML = '<option value="">Seleccionar provincia</option>';
      Object.keys(data).forEach(prov => {
        const option = document.createElement('option');
        option.value = prov;
        option.textContent = prov;
        provinciaSelect.appendChild(option);
      });

      if (clubData?.provincia) {
        provinciaSelect.value = clubData.provincia;
        provinciaSelect.dispatchEvent(new Event('change'));
      }

      if (clubData?.localidad) {
        setTimeout(() => {
          localidadSelect.value = clubData.localidad;
        }, 500);
      }

      provinciaSelect.addEventListener('change', () => {
        const provinciaSeleccionada = provinciaSelect.value;
        localidadSelect.innerHTML = '<option value="">Seleccionar localidad</option>';
        localidadSelect.disabled = !provinciaSeleccionada;

        if (provinciaSeleccionada && data[provinciaSeleccionada]) {
          data[provinciaSeleccionada].forEach(localidad => {
            const option = document.createElement('option');
            option.value = localidad;
            option.textContent = localidad;
            localidadSelect.appendChild(option);
          });
        }
      });
    } catch (error) {
      console.error("Error al cargar provincias y localidades:");
    }

    // Guardar datos editados del club
    const formEditar = document.getElementById('form-editar-club');
    if (formEditar) {
      formEditar.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nombre = document.getElementById('nombreClub').value;
        const telefono = document.getElementById('telefonoClub').value;
        const provincia = document.getElementById('provinciaClub').value;
        const localidad = document.getElementById('localidadClub').value;

        const body = { nombre, telefono, provincia, localidad };

        try {
          const res = await fetch(window.CanchaLibreApiUrl(`/club/${clubData._id}`), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });

          const data = await res.json();
          if (res.ok) {
            document.getElementById('alerta-edicion-club')?.classList.remove('d-none');
          } else {
            alert(data.error || 'Error al actualizar los datos');
          }
        } catch (err) {
          console.error("❌ Error al guardar datos del club:");
          alert('Error al guardar datos del club');
        }
      });
    }
  }

  await cargarProvinciasYLocalidades();

  // Redirección a Mis Datos
  document.getElementById('btn-mis-datos')?.addEventListener('click', () => {
    window.location.href = 'mis-datos.html';
  });

  // Reservas hoy (Info)
  async function cargarReservasHoy() {
    const contenedor = document.getElementById('lista-reservas-hoy');
    if (!contenedor) return;

    contenedor.innerHTML = '';

    try {
      const res = await fetch(window.CanchaLibreApiUrl(`/reservas/${clubData.email}`));
      if (!res.ok) throw new Error('Error al obtener reservas');
      const reservas = await res.json();

      const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const reservasHoy = reservas.filter(r => r.fecha === hoy);

      if (reservasHoy.length === 0) {
        contenedor.innerHTML = `<p>No hay reservas para hoy.</p>`;
        return;
      }

      reservasHoy.sort((a, b) => a.hora.localeCompare(b.hora));

      reservasHoy.forEach(r => {
        const div = document.createElement('div');
        div.classList.add('border', 'rounded', 'p-2', 'mb-2', 'bg-white', 'shadow-sm');

        const nombre =
          (r.usuarioNombre || r.usuario?.nombre || r.usuarioId?.nombre || '') +
          ' ' +
          (r.usuarioApellido || r.usuario?.apellido || r.usuarioId?.apellido || '');

        const telefono = r.usuarioTelefono || r.usuario?.telefono || r.usuarioId?.telefono || '';

        div.innerHTML = `
          <strong>${escapeClubHtml(r.hora)} hs</strong> - <b>${escapeClubHtml(r.nombreCancha || 'Cancha')}</b><br>
          ${escapeClubHtml(nombre.trim() || '-')} ${telefono ? ' - ' + escapeClubHtml(telefono) : ''}<br>
          Estado: <b>${r.pagado ? 'Pagado' : 'Pendiente'}</b>
        `;

        contenedor.appendChild(div);
      });
    } catch (err) {
      contenedor.innerHTML = `<p class="text-danger">Error al cargar reservas de hoy.</p>`;
      console.error("Error en la interfaz");
    }
  }

  // Cambios de pestaña
  const tabs = document.querySelectorAll('button[data-bs-toggle="tab"]');
  tabs.forEach(tab => {
    tab.addEventListener('shown.bs.tab', async event => {
      const id = event.target.id;

      if (id === 'reservas-tab') await cargarReservas();
      if (id === 'canchas-tab') await cargarCanchas();
    });
  });

  // Carga inicial según pestaña visible
  if (document.querySelector('#canchasTab')?.classList.contains('show')) {
    await cargarCanchas();
  }
  if (document.querySelector('#reservasTab')?.classList.contains('show')) {
    await cargarReservas();
  }
});
