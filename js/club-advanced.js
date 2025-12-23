// ====== Configuración dinámica de precio y plazo de destaque ======
let PRECIO_DESTACADO = 4999;
let DIAS_DESTACADO = 30;

// Función global para cargar valores desde el backend
async function cargarConfigDestacado() {
  try {
    const res = await fetch('https://api.canchalibre.ar/configuracion-destacado');
    const data = await res.json();
    PRECIO_DESTACADO = data.precioDestacado;
    DIAS_DESTACADO = data.diasDestacado;
  } catch (e) {}
}

// ============================
// Lógica principal del panel
// ============================
document.addEventListener('DOMContentLoaded', async () => {
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

  const qrLogo = document.getElementById('qr-logo-centro'); // <img> (ideal: archivo local)
  let ultimoQRDataUrl = null;

  btnCopiar.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch (e) {
      inputLink.select();
      document.execCommand('copy');
    }
  });

  function esperarImagen(img) {
    return new Promise((resolve) => {
      if (!img) return resolve(false);
      if (img.complete && img.naturalWidth > 0) return resolve(true);
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
    });
  }

  function redondeado(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function incrustarLogo(canvas, logoImg) {
    if (!canvas || !logoImg) return false;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    // ✅ más chico => más escaneable
    const logoSize = 44;     // antes 52
    const padding = 7;       // antes 8
    const bgSize = logoSize + padding * 2;

    const x = (canvas.width - bgSize) / 2;
    const y = (canvas.height - bgSize) / 2;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    redondeado(ctx, x, y, bgSize, bgSize, 10);
    ctx.fill();
    ctx.restore();

    const lx = (canvas.width - logoSize) / 2;
    const ly = (canvas.height - logoSize) / 2;

    try {
      ctx.drawImage(logoImg, lx, ly, logoSize, logoSize);
      return true;
    } catch (e) {
      return false;
    }
  }

  btnGenerarQR.addEventListener('click', async () => {
    if (typeof QRCode === 'undefined') {
      alert('❌ No se pudo cargar la librería de QR. Revisá qrcode.min.js');
      return;
    }

    // ✅ limpiamos UNA sola vez
    contQR.innerHTML = '';
    ultimoQRDataUrl = null;
    btnDescargarQR.disabled = true;

    // Generar QR
    new QRCode(contQR, {
      text: link,
      width: 220,
      height: 220,
      correctLevel: QRCode.CorrectLevel.H
    });

    // Esperar a que exista canvas/img
    setTimeout(async () => {
      let canvas = contQR.querySelector('canvas');
      const img = contQR.querySelector('img');

      // Si qrcodejs generó <img>, convertir a canvas
      if (!canvas && img && img.src) {
        const ok = await esperarImagen(img);
        if (!ok) return;

        const c = document.createElement('canvas');
        c.width = 220;
        c.height = 220;
        const ctx = c.getContext('2d');

        try {
          ctx.drawImage(img, 0, 0, 220, 220);
          canvas = c;

          // ✅ reemplazo SIN “parpadeo”: solo si era img
          contQR.innerHTML = '';
          contQR.appendChild(canvas);
        } catch (e) {
          return;
        }
      }

      if (!canvas) return;

      // Incrustar logo en el canvas final (si existe)
      if (qrLogo && qrLogo.tagName === 'IMG') {
        const okLogo = await esperarImagen(qrLogo);
        if (okLogo) {
          incrustarLogo(canvas, qrLogo);
        }
      }

      // Preparar PNG
      try {
        ultimoQRDataUrl = canvas.toDataURL('image/png');
        btnDescargarQR.disabled = false;
      } catch (e) {
        btnDescargarQR.disabled = true;
        alert('⚠️ No se pudo preparar la descarga. Revisá que el logo sea local (mismo dominio) para evitar CORS.');
      }
    }, 180); // un poco más de margen para qrcodejs
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
            const res = await fetch(`https://api.canchalibre.ar/club/${clubEmail}/destacar-pago`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.pagoUrl) {
              document.getElementById('pago-destacado-resultado').innerHTML = `
                <div class="alert alert-info mt-2">
                  <b>Link para renovar tu destaque por ${DIAS_DESTACADO} días ($${PRECIO_DESTACADO}):</b><br>
                  <a href="${data.pagoUrl}" target="_blank">${data.pagoUrl}</a>
                </div>
              `;
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
            const res = await fetch(`https://api.canchalibre.ar/club/${clubEmail}/destacar-pago`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.pagoUrl) {
              document.getElementById('pago-destacado-resultado').innerHTML = `
                <div class="alert alert-info mt-2">
                  <b>Link para destacar tu club por ${DIAS_DESTACADO} días ($${PRECIO_DESTACADO}):</b><br>
                  <a href="${data.pagoUrl}" target="_blank">${data.pagoUrl}</a>
                </div>
              `;
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
    const resClub = await fetch(`https://api.canchalibre.ar/club/${clubEmail}`);
    clubData = await resClub.json();

    // Mostrar mensaje de bienvenida (solo si existe el div en esta página)
    const bienvenida = document.getElementById('info-bienvenida');
    if (bienvenida) {
      bienvenida.innerHTML = `
        <div class="alert alert-info">
          Bienvenido, <strong>${clubData.nombre}</strong>. Hoy hay reservas activas para tus canchas.
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
    console.error('❌ Error al obtener datos del club:', err);
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
      const res = await fetch(`https://api.canchalibre.ar/club/${clubEmail}`);
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
      console.error('Error al cargar club:', error);
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

      const res = await fetch(`https://api.canchalibre.ar/club/${clubEmail}/access-token`, {
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
        select.innerHTML += `<option value="${hora}">${hora}</option>`;
      }
    });
  }

  document.getElementById('agregar-cancha')?.addEventListener('click', () => {
    editandoCanchaId = null;
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

  async function cargarCanchas() {
    if (!canchasList) return;

    canchasList.innerHTML = '';
    const res = await fetch(`https://api.canchalibre.ar/canchas/${clubEmail}`);
    if (!res.ok) throw new Error('Error al cargar canchas');
    const canchas = await res.json();

    canchas.forEach(cancha => {
      const div = document.createElement('div');
      div.classList.add('col-md-4');
      div.innerHTML = `
        <div class="card">
          <div class="card-body">
            <h5 class="card-title">${cancha.nombre}</h5>
            <p><strong>Deporte:</strong> ${cancha.deporte}</p>
            <p><strong>Precio:</strong> $${cancha.precio || '0'}/hora</p>
            <p><strong>Horario:</strong> ${cancha.horaDesde || '08:00'} a ${cancha.horaHasta || '22:00'}</p>
            <p><strong>Duración:</strong> ${(cancha.duracionTurno || 60)} min</p>
            <p><strong>Nocturno:</strong> ${
              (cancha.nocturnoDesde !== null && cancha.nocturnoDesde !== undefined)
                ? (String(cancha.nocturnoDesde).padStart(2, '0') + ':00')
                : '—'
            } — $${(cancha.precioNocturno !== null && cancha.precioNocturno !== undefined) ? cancha.precioNocturno : '—'}</p>
            <p><strong>Días disponibles:</strong> ${cancha.diasDisponibles ? cancha.diasDisponibles.join(', ') : 'No especificado'}</p>
            <button class="btn btn-primary btn-sm me-2" onclick="editarCancha('${cancha._id}')">Editar</button>
            <button class="btn btn-danger btn-sm" onclick="eliminarCancha('${cancha._id}')">Eliminar</button>
          </div>
        </div>
      `;
      canchasList.appendChild(div);
    });
  }

  // ========== AGENDA ==========
  async function cargarEventosSemana(canchaId, fechaInicioSemana) {
    const fechaParam = (fechaInicioSemana || '').split('T')[0];
    const res = await fetch(`https://api.canchalibre.ar/turnos-generados?fecha=${fechaParam}`);
    const turnos = await res.json();
    const canchaTurnos = turnos.filter(t => t.canchaId?.toString() === canchaId.toString());

    const eventos = canchaTurnos.map(t => {
      const [anio, mes, dia] = t.fecha.split('-');
      const fechaHoraTurno = new Date(
        Number(anio), Number(mes) - 1, Number(dia),
        Number(t.hora.split(':')[0]), Number(t.hora.split(':')[1])
      );
      const fechaDelTurno = new Date(Number(anio), Number(mes) - 1, Number(dia));
      fechaDelTurno.setHours(0, 0, 0, 0);

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      let color = 'green';
      if (fechaDelTurno < hoy || (fechaDelTurno.getTime() === hoy.getTime() && fechaHoraTurno < new Date())) {
        color = t.usuarioReservado ? '#7a7a7a' : '#bcbcbc';
      } else if (t.usuarioReservado) {
        color = 'red';
      }

      return {
        title: t.usuarioReservado ? `Reservado: ${t.usuarioReservado}` : `Libre`,
        start: `${t.fecha}T${t.hora}`,
        color: color,
        id: t.realId,
        extendedProps: t
      };
    });

    const calendarEl = document.getElementById('calendar-unico');
    if (calendarEl && calendarEl._calendar) {
      calendarEl._calendar.removeAllEvents();
      calendarEl._calendar.addEventSource(eventos);
    }
  }

  async function cargarAgendas() {
    const agendasContainer = document.getElementById('agendas-container');
    if (!agendasContainer) return;

    agendasContainer.innerHTML = `<div id="calendar-unico"></div>`;

    const selectCancha = document.getElementById('select-cancha-agenda');
    if (!selectCancha) return;

    // Evitar duplicados
    selectCancha.innerHTML = '';

    const resCanchas = await fetch(`https://api.canchalibre.ar/canchas/${clubEmail}`);
    const canchas = await resCanchas.json();

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
        initialView: 'timeGridWeek',
        locale: 'es',
        firstDay: 1,
        height: 'auto',
        expandRows: true,
        timeZone: 'local',
        allDaySlot: false,
        slotMinTime: cancha.horaDesde || '08:00',
        slotMaxTime: cancha.horaHasta || '22:00',
        slotDuration: (Number(cancha.duracionTurno) === 90 ? '01:30:00' : '01:00:00'),
        events: [],
        eventClick: async function (info) {
          const turno = info.event.extendedProps;
          turnoSeleccionado = turno;

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
              <p><strong>Usuario:</strong> ${turno.usuarioReservado}</p>
              <p><strong>Fecha:</strong> ${fechaFormateada}</p>
              <p><strong>Hora:</strong> ${turno.hora} hs</p>
              <p><strong>Estado:</strong> ${turno.pagado ? 'Pagado' : 'Pendiente de pago'}</p>
              <div class="mt-2">${botonesDetalle}</div>
            `;

            btnCancelarTurno.style.display = 'block';
            btnReservarTurno.style.display = 'none';
          } else {
            turnoDetalleBody.innerHTML = `
              <p><strong>Fecha:</strong> ${fechaFormateada}</p>
              <p><strong>Hora:</strong> ${turno.hora} hs</p>
              <p>Este turno está libre.</p>
              <input type="text" id="nombreCliente" placeholder="Nombre del cliente" class="form-control mb-2">
              <input type="text" id="telefonoCliente" placeholder="Teléfono del cliente" class="form-control mb-2">
              <input type="email" id="emailCliente" placeholder="Email del cliente" class="form-control mb-2">
            `;

            btnCancelarTurno.style.display = 'none';
            btnReservarTurno.style.display = 'block';
          }

          modalTurno.show();

          setTimeout(() => {
            const btnPago = document.getElementById('detalle-generar-pago');
            const btnPagado = document.getElementById('detalle-marcar-pagado');

            if (btnPago) {
              btnPago.onclick = async () => {
                try {
                  const res = await fetch(`https://api.canchalibre.ar/generar-link-pago/${turno.realId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                  });
                  const data = await res.json();
                  if (!res.ok || !data.pagoUrl) {
                    alert(data.error || 'No se pudo generar el link de pago.');
                    return;
                  }

                  const resReserva = await fetch(`https://api.canchalibre.ar/reserva/${turno.realId}`);
                  const reserva = await resReserva.json();

                  let telefonoOriginal = reserva.usuarioId?.telefono || '';
                  let telefono = String(telefonoOriginal).replace(/[^0-9]/g, '');
                  if (!telefono) {
                    alert('El usuario no tiene un número válido en su perfil.');
                    return;
                  }
                  if (telefono.startsWith('0')) telefono = telefono.slice(1);
                  if (!telefono.startsWith('549')) telefono = '549' + telefono;

                  const nombreClub = clubData?.nombre || reserva.club;
                  const [aa, mm, dd] = reserva.fecha.split('-');
                  const fechaF = `${dd}/${mm}/${aa}`;

                  const mensajeTexto =
                    `Hola! Te compartimos el link para pagar tu reserva en ${nombreClub}:\n\n` +
                    `📅 ${fechaF}\n` +
                    `🕐 ${reserva.hora} hs\n` +
                    `🏅 Deporte: ${reserva.deporte}\n\n` +
                    `💳 Link de pago:\n${data.pagoUrl}`;

                  const mensaje = encodeURIComponent(mensajeTexto);
                  const linkWhatsapp = `https://wa.me/${telefono}?text=${mensaje}`;

                  const popup = window.open('', '_blank', 'width=500,height=300');
                  popup.document.write(`
                    <html><head><title>Link de Pago</title></head>
                    <body style="font-family: Arial; padding: 20px;">
                      <h3>✅ Link de pago generado:</h3>
                      <p><a href="${data.pagoUrl}" target="_blank">${data.pagoUrl}</a></p>
                      <button onclick="navigator.clipboard.writeText('${data.pagoUrl}')">📋 Copiar enlace</button>
                      <br><br>
                      <a href="${linkWhatsapp}" target="_blank">📲 Enviar por WhatsApp</a>
                    </body></html>
                  `);
                } catch (err) {
                  alert('Error generando el link de pago.');
                }
              };
            }

            if (btnPagado) {
              btnPagado.onclick = async () => {
                const confirmar = confirm('¿Confirmás que el usuario pagó en efectivo u otro medio?');
                if (!confirmar) return;

                try {
                  const res = await fetch(`https://api.canchalibre.ar/turnos/${turno.realId}/marcar-pagado`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' }
                  });
                  if (!res.ok) {
                    const errorData = await res.json();
                    alert(errorData.error || 'No se pudo marcar como pagada.');
                  } else {
                    await cargarReservas();
                    modalTurno.hide();
                  }
                } catch (err) {
                  alert('Error al marcar como pagada.');
                }
              };
            }
          }, 0);
        },
        datesSet: async function (info) {
          await cargarEventosSemana(cancha._id.toString(), info.startStr);
        }
      });

      calendar.render();
      calendarEl._calendar = calendar;

      calendar.updateSize();
    }

    selectCancha.onchange = async function () {
      await renderCalendario(this.value);
    };

    await renderCalendario(canchas[0]._id);
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
    [nombreInput, tipoInput, precioInput, horaDesdeInput, horaHastaInput].forEach(i => {
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

    const desde = parseInt(horaDesde.split(':')[0]);
    const hasta = parseInt(horaHasta.split(':')[0]);
    if (horaDesde && horaHasta && hasta <= desde) {
      marcarError(horaHastaInput, '"Hasta" debe ser mayor que "Desde"');
    }

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

    if (editandoCanchaId) {
      const res = await fetch(`https://api.canchalibre.ar/canchas/${editandoCanchaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(canchaData)
      });
      if (!res.ok) throw new Error('Error al actualizar cancha');
    } else {
      await fetch('https://api.canchalibre.ar/canchas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(canchaData)
      });
    }

    modal.hide();
    await cargarCanchas();
  });

  // Editar cancha
  window.editarCancha = async function (id) {
    const res = await fetch(`https://api.canchalibre.ar/canchas/${clubEmail}`);
    if (!res.ok) throw new Error('Error al cargar canchas');
    const canchas = await res.json();

    const cancha = canchas.find(c => c._id === id);
    if (!cancha) return alert('Cancha no encontrada');

    window._canchaAEditar = cancha;

    document.getElementById('modalCancha')?.addEventListener('shown.bs.modal', () => {
      const cancha = window._canchaAEditar;
      if (!cancha) return;

      editandoCanchaId = cancha._id;

      nombreInput.value = cancha.nombre || '';
      tipoInput.value = cancha.deporte || 'futbol';
      precioInput.value = cancha.precio || '';
      horaDesdeInput.value = cancha.horaDesde || '08:00';
      horaHastaInput.value = cancha.horaHasta || '22:00';
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
            ? cancha.diasDisponibles.includes(capitalize(dia))
            : true;
        }
      });

      window._canchaAEditar = null;
    }, { once: true });

    modal.show();
  };

  // Eliminar cancha
  window.eliminarCancha = async function (id) {
    try {
      const res = await fetch(`https://api.canchalibre.ar/canchas/${id}`, { method: 'DELETE' });
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

      const res = await fetch(`https://api.canchalibre.ar/turnos/${turnoSeleccionado.realId}/cancelar`, {
        method: 'PATCH'
      });
      if (!res.ok) throw new Error('Error al cancelar turno');

      modalTurno.hide();
      await cargarReservas();
      await cargarAgendas();
    }
  });

  // Reservar turno manual
  btnReservarTurno?.addEventListener('click', async () => {
    const nombreCliente = document.getElementById('nombreCliente')?.value.trim();
    const telefonoCliente = document.getElementById('telefonoCliente')?.value.trim();
    const emailCliente = document.getElementById('emailCliente')?.value.trim();

    if (!nombreCliente || !telefonoCliente || !emailCliente) {
      return alert('Todos los campos son obligatorios.');
    }

    const res = await fetch('https://api.canchalibre.ar/reservar-turno', {
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
        metodoPago: 'efectivo',
        canchaId: turnoSeleccionado.canchaId
      })
    });

    if (!res.ok) throw new Error('Error al reservar turno');

    modalTurno.hide();
    await cargarReservas();
    await cargarAgendas();
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

    const res = await fetch(`https://api.canchalibre.ar/reservas/${clubEmail}`);
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
        <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
             alt="WhatsApp"
             style="width: 18px; vertical-align: middle; margin-left: 4px;">
      `;

      let htmlTelefono;
      if (telefonoWa) {
        htmlTelefono = `
          📱 <a href="https://wa.me/${telefonoWa}" target="_blank" style="text-decoration: none;">
            ${telefonoReserva} ${iconoWhatsApp}
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
        <td>${r.nombreCancha || 'Sin nombre'}</td>
        <td>${fechaFormateada}</td>
        <td>${r.hora}</td>
        <td>
          ${r.usuarioNombre || ''} ${r.usuarioApellido || ''}<br>
          📧 ${r.usuarioEmail || r.emailReservado}<br>
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
          <td>${r.nombreCancha || 'Sin nombre'}</td>
          <td>${fechaFormateada}</td>
          <td>${r.hora}</td>
          <td>${r.emailReservado}</td>
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
        await fetch(`https://api.canchalibre.ar/turnos/${id}/cancelar`, { method: 'PATCH' });
        await cargarReservas();
      });
    });

    reservasList.querySelectorAll('.generar-pago').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        try {
          const res = await fetch(`https://api.canchalibre.ar/generar-link-pago/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          const data = await res.json();
          if (!res.ok || !data.pagoUrl) {
            alert(data.error || 'No se pudo generar el link de pago.');
            return;
          }

          const resReserva = await fetch(`https://api.canchalibre.ar/reserva/${id}`);
          const reserva = await resReserva.json();

          let telefonoOriginal = reserva.usuarioId?.telefono || '';
          let telefono = String(telefonoOriginal).replace(/[^0-9]/g, '');
          if (!telefono) {
            alert('El usuario no tiene un número válido en su perfil.');
            return;
          }
          if (telefono.startsWith('0')) telefono = telefono.slice(1);
          if (!telefono.startsWith('549')) telefono = '549' + telefono;

          const nombreClub = clubData?.nombre || reserva.club;
          const [anio, mes, dia] = reserva.fecha.includes('-')
            ? reserva.fecha.split('-')
            : [reserva.fecha.split('/')[2], reserva.fecha.split('/')[1], reserva.fecha.split('/')[0]];
          const fechaFormateada = `${dia}/${mes}/${anio}`;

          const mensajeTexto =
            `Hola! Te compartimos el link para pagar tu reserva en ${nombreClub}:\n\n` +
            `📅 ${fechaFormateada}\n` +
            `🕐 ${reserva.hora} hs\n` +
            `🏅 Deporte: ${reserva.deporte}\n\n` +
            `💳 Link de pago:\n${data.pagoUrl}`;

          const mensaje = encodeURIComponent(mensajeTexto);
          const linkWhatsapp = `https://wa.me/${telefono}?text=${mensaje}`;

          const popup = window.open('', '_blank', 'width=500,height=300');
          popup.document.write(`
            <html><head><title>Link de Pago</title></head>
            <body style="font-family: Arial; padding: 20px;">
              <h3>✅ Link de pago generado:</h3>
              <p><a href="${data.pagoUrl}" target="_blank">${data.pagoUrl}</a></p>
              <button onclick="navigator.clipboard.writeText('${data.pagoUrl}')">📋 Copiar enlace</button>
              <br><br>
              <a href="${linkWhatsapp}" target="_blank">📲 Enviar por WhatsApp</a>
            </body></html>
          `);
        } catch (err) {
          alert('Error generando el link de pago.');
        }
      });
    });

    reservasList.querySelectorAll('.marcar-pagada').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const confirmar = confirm('¿Confirmás que el usuario pagó en efectivo u otro medio?');
        if (!confirmar) return;

        try {
          const res = await fetch(`https://api.canchalibre.ar/turnos/${id}/marcar-pagado`, {
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
        }
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
      const res = await fetch('https://api.canchalibre.ar/ubicaciones');
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
      console.error('Error al cargar provincias y localidades:', error);
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
          const res = await fetch(`https://api.canchalibre.ar/club/${clubData._id}`, {
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
          console.error('❌ Error al guardar datos del club:', err);
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
      const res = await fetch(`https://api.canchalibre.ar/reservas/${clubData.email}`);
      if (!res.ok) throw new Error('Error al obtener reservas');
      const reservas = await res.json();

      const hoy = new Date().toISOString().slice(0, 10);
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
          <strong>${r.hora} hs</strong> - <b>${r.nombreCancha || 'Cancha'}</b><br>
          ${nombre.trim() || '-'} ${telefono ? ' - ' + telefono : ''}<br>
          Estado: <b>${r.pagado ? 'Pagado' : 'Pendiente'}</b>
        `;

        contenedor.appendChild(div);
      });
    } catch (err) {
      contenedor.innerHTML = `<p class="text-danger">Error al cargar reservas de hoy.</p>`;
      console.error(err);
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
