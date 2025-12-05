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

    await renderBloqueDestacar();

    if (!nombreClub || !clubEmail) {
        alert('Debes iniciar sesión como club.');
        window.location.href = 'login-club.html';
        return;
    }
    try {
        const resClub = await fetch(`https://api.canchalibre.ar/club/${clubEmail}`);
        clubData = await resClub.json();
        // console.log('📦 Datos del club cargados:', clubData);

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
        const nombreInput = document.getElementById('nombreClub');
        const telefonoInput = document.getElementById('telefonoClub');
        const emailInput = document.getElementById('emailClub');
        const latitudInput = document.getElementById('latitudClub');
        const longitudInput = document.getElementById('longitudClub');
        const direccionInput = document.getElementById('direccionClub');

        if (nombreInput && telefonoInput && emailInput) {
            nombreInput.value = clubData.nombre || '';
            telefonoInput.value = clubData.telefono || '';
            emailInput.value = clubData.email || '';

            if (direccionInput) direccionInput.value = clubData.direccion || '';
            if (latitudInput) latitudInput.value = clubData.latitud || '';
            if (longitudInput) longitudInput.value = clubData.longitud || '';

            await cargarProvinciasYLocalidades();
        }

    } catch (err) {
        console.error('❌ Error al obtener datos del club:', err);
    }
    await renderBloqueDestacar();

    // === BLOQUE DESTACAR CLUB ===
    async function renderBloqueDestacar() {
        const bloque = document.getElementById('bloque-destacar-club');
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

            if (document.getElementById('btn-renovar-destacado')) {
                document.getElementById('btn-renovar-destacado').onclick = async function () {
                    const btn = this;
                    btn.disabled = true;
                    btn.textContent = "Generando link...";
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
                            document.getElementById('pago-destacado-resultado').textContent = data.error || 'No se pudo generar el link de pago';
                        }
                    } catch (err) {
                        document.getElementById('pago-destacado-resultado').textContent = 'Error generando el link de pago.';
                    }
                    btn.disabled = false;
                    btn.textContent = "Renovar destaque";
                };
            }
        } else {
            bloque.innerHTML = `
                <div class="alert alert-warning my-3">
                    <b>¿Querés que tu club aparezca primero?</b>
                    <br>
                    <span class="text-dark">
                        Destacá tu club por <b>${DIAS_DESTACADO} días</b> por solo <b>$${PRECIO_DESTACADO}</b>.<br>
                        ¡Aparecerá en primer lugar en los resultados del buscador!
                    </span>
                    <button class="btn btn-primary btn-sm ms-2 mt-2" id="btn-destacar-club">Destacar mi club</button>
                </div>
                <div id="pago-destacado-resultado"></div>
            `;
            document.getElementById('btn-destacar-club').onclick = async function () {
                const btn = this;
                btn.disabled = true;
                btn.textContent = "Generando link...";
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
                        document.getElementById('pago-destacado-resultado').textContent = data.error || 'No se pudo generar el link de pago';
                    }
                } catch (err) {
                    document.getElementById('pago-destacado-resultado').textContent = 'Error generando el link de pago.';
                }
                btn.disabled = false;
                btn.textContent = "Destacar mi club";
            };
        }
    }

    document.getElementById('cerrar-sesion').addEventListener('click', () => {
        localStorage.removeItem('clubNombre');
        localStorage.removeItem('clubEmail');
        window.location.href = 'login-club.html';
    });

    // Mapa (solo si existe el contenedor con id="map")
    if (document.getElementById('map')) {
      if (window._map) {
        window._map.remove();
      }
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
    // 👉 NUEVO: input de duración del turno
    const duracionInput = document.getElementById('duracion-turno');
    // 👉 NUEVO: tarifa nocturna
    const nocturnoDesdeInput = document.getElementById('nocturno-desde');
    const precioNocturnoInput = document.getElementById('precio-nocturno');
    
    const diasCheckboxes = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

    let turnoSeleccionado = null;

    function llenarSelectHoras() {
        const horaDesdeInput = document.getElementById('hora-desde');
        const horaHastaInput = document.getElementById('hora-hasta');

        if (!horaDesdeInput || !horaHastaInput) return; // ⚠️ Salir si no existen en el DOM

        [horaDesdeInput, horaHastaInput].forEach(select => {
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

        // 🔁 Asegurar que los inputs existen
        const nombreInput = document.getElementById('nombre-cancha');
        const tipoInput = document.getElementById('tipo-cancha');
        const precioInput = document.getElementById('precio-cancha');
        const horaDesdeInput = document.getElementById('hora-desde');
        const horaHastaInput = document.getElementById('hora-hasta');
        const duracionInput = document.getElementById('duracion-turno'); // <- dentro del modal

        if (!nombreInput || !tipoInput || !precioInput || !horaDesdeInput || !horaHastaInput) {
            alert('Faltan campos del formulario.');
            return;
        }

        nombreInput.value = '';
        tipoInput.value = 'futbol';
        precioInput.value = '';
        horaDesdeInput.value = '08:00';
        horaHastaInput.value = '22:00';
        if (duracionInput) duracionInput.value = '60'; // 👉 default 60

        diasCheckboxes.forEach(d => {
            const checkbox = document.getElementById(`dia-${d}`);
            if (checkbox) checkbox.checked = true;
        });

        modal.show();
    });

    async function cargarCanchas() {
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
                        <p><strong>Duración:</strong> ${(cancha.duracionTurno || 60)} min</p> <!-- NUEVO -->
                        <p><strong>Nocturno:</strong> ${ (cancha.nocturnoDesde !== null && cancha.nocturnoDesde !== undefined) ? (String(cancha.nocturnoDesde).padStart(2,'0') + ':00') : '—' } — $${ (cancha.precioNocturno !== null && cancha.precioNocturno !== undefined) ? cancha.precioNocturno : '—' }</p>
                        <p><strong>Días disponibles:</strong> ${cancha.diasDisponibles ? cancha.diasDisponibles.join(', ') : 'No especificado'}</p>
                        <button class="btn btn-primary btn-sm me-2" onclick="editarCancha('${cancha._id}')">Editar</button>
                        <button class="btn btn-danger btn-sm" onclick="eliminarCancha('${cancha._id}')">Eliminar</button>
                    </div>
                </div>
            `;
            canchasList.appendChild(div);
        });
    }

    // ========== BLOQUE AGENDA UN SOLO SELECT Y COLORES ==========
    async function cargarEventosSemana(canchaId, fechaInicioSemana) {
      
        const fechaParam = (fechaInicioSemana || '').split('T')[0];
        const res = await fetch(`https://api.canchalibre.ar/turnos-generados?fecha=${fechaParam}`);
        const turnos = await res.json();
        const canchaTurnos = turnos.filter(t => t.canchaId?.toString() === canchaId.toString());
        // console.log(`🎾 Turnos encontrados para cancha ${canchaId}:`, canchaTurnos.length);

        const eventos = canchaTurnos.map(t => {
            const [anio, mes, dia] = t.fecha.split('-');
            const fechaHoraTurno = new Date(Number(anio), Number(mes) - 1, Number(dia), Number(t.hora.split(':')[0]), Number(t.hora.split(':')[1]));
            const fechaDelTurno = new Date(Number(anio), Number(mes) - 1, Number(dia));
            fechaDelTurno.setHours(0, 0, 0, 0);
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);

            let color = 'green'; // Libre futuro
            if (fechaDelTurno < hoy || (fechaDelTurno.getTime() === hoy.getTime() && fechaHoraTurno < new Date())) {
                color = t.usuarioReservado ? '#7a7a7a' : '#bcbcbc'; // Reservado pasado o Libre pasado
            } else if (t.usuarioReservado) {
                color = 'red'; // Reservado futuro
            }
            return {
                title: t.usuarioReservado ? `Reservado: ${t.usuarioReservado}` : `Libre`,
                start: `${t.fecha}T${t.hora}`,
                color: color,
                id: t.realId,
                extendedProps: t
            };
        });

        // Actualizá los eventos del calendario único
        const calendarEl = document.getElementById('calendar-unico');
        if (calendarEl && calendarEl._calendar) {
            calendarEl._calendar.removeAllEvents();
            calendarEl._calendar.addEventSource(eventos);
        }
    }

async function cargarAgendas() {
    const agendasContainer = document.getElementById('agendas-container');
    agendasContainer.innerHTML = `
        <div id="calendar-unico"></div>
    `;

    const selectCancha = document.getElementById('select-cancha-agenda');
    if (!selectCancha) return;   // por las dudas

    // 🔹 Vaciar el select para que no duplique opciones al volver a la pestaña
    selectCancha.innerHTML = '';


        // Trae todas las canchas y carga el select
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

        // Función para renderizar el calendario de una cancha
        async function renderCalendario(canchaId) {
            const calendarEl = document.getElementById('calendar-unico');
            const cancha = canchas.find(c => c._id === canchaId);

            // Calcula el lunes de la semana actual
            const hoy = new Date();
            const diaSemana = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1;
            hoy.setDate(hoy.getDate() - diaSemana);
            const startDateStr = hoy.toISOString().slice(0, 10);

            // Limpia si había un calendario anterior
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
                // 👉 NUEVO: paso de grilla según duración configurada
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
                                    // Obtener reserva con teléfono
                                    const resReserva = await fetch(`https://api.canchalibre.ar/reserva/${turno.realId}`);
                                    const reserva = await resReserva.json();
                                    let telefonoOriginal = reserva.usuarioId?.telefono || '';
                                    let telefono = telefonoOriginal.replace(/[^0-9]/g, '');
                                    // console.log('📞 Teléfono desde usuarioId:', telefono);
                                    if (!telefono) {
                                            alert('El usuario no tiene un número válido en su perfil.');
                                            return;
                                    }

                                    if (telefono.startsWith('0')) telefono = telefono.slice(1);
                                    if (!telefono.startsWith('549')) telefono = '549' + telefono;
                                    const nombreClub = clubData?.nombre || reserva.club;
                                    const [anio, mes, dia] = reserva.fecha.split('-');
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
                            };
                        }
                        if (btnPagado) {
                            btnPagado.onclick = async () => {
                                const confirmar = confirm('¿Confirmás que el usuario pagó en efectivo u otro medio?');
                                if (confirmar) {
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
                                }
                            };
                        }
                    }, 0);
                },
                datesSet: async function (info) {    
                    // console.log('📆 Semana mostrada:', info.startStr);
                    // console.log('🎯 Cancha actual:', canchaId);     
                    await cargarEventosSemana(cancha._id.toString(), info.startStr);
                }
            });
            calendar.render();
            calendarEl._calendar = calendar;
            
calendar.updateSize();
calendar.render();

        }

        selectCancha.onchange = async function () {
            await renderCalendario(this.value);
        };

        await renderCalendario(canchas[0]._id);
    }

    // Mostrar agendas al entrar en la pestaña
    document.getElementById('agenda-tab').addEventListener('shown.bs.tab', async () => {
        await cargarAgendas();
        setTimeout(() => {
            const calendarEl = document.getElementById('calendar-unico');
            if (calendarEl && calendarEl._calendar) {
                calendarEl._calendar.updateSize();
                calendarEl._calendar.render();
            }
            window.dispatchEvent(new Event('resize'));
        }, 200);
    });

    await cargarCanchas();

    // Guardar cancha
document.getElementById('guardar-cancha').addEventListener('click', async () => {
    const nombre = nombreInput.value.trim();
    const deporte = tipoInput.value.trim();
    const precio = precioInput.value.trim();
    const horaDesde = horaDesdeInput.value.trim();
    const horaHasta = horaHastaInput.value.trim();
    const dias = diasCheckboxes.filter(d => document.getElementById(`dia-${d}`).checked);

    // 🧹 Limpiar errores visuales previos
    [nombreInput, tipoInput, precioInput, horaDesdeInput, horaHastaInput].forEach(i => {
        i.classList.remove('is-invalid');
        const msg = i.parentElement.querySelector('.invalid-feedback');
        if (msg) msg.remove();
    });

    // ⚠️ Validación visual de campos vacíos y errores
    let errores = [];
    function marcarError(input, mensaje) {
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

    // 🔸 Si hay errores, mostramos alerta y enfocamos el primero
    if (errores.length > 0) {
        errores[0].focus();
        alert('⚠️ Por favor corregí los campos marcados en rojo antes de guardar.');
        return;
    }

    // ✅ Si todo está correcto, construir el objeto y guardar
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

        // Guardamos temporalmente la cancha seleccionada
        window._canchaAEditar = cancha;

        document.getElementById('modalCancha').addEventListener('shown.bs.modal', () => {
            const cancha = window._canchaAEditar;
            if (!cancha) return;

            const nombreInput = document.getElementById('nombre-cancha');
            const tipoInput = document.getElementById('tipo-cancha');
            const precioInput = document.getElementById('precio-cancha');
            const horaDesdeInput = document.getElementById('hora-desde');
            const horaHastaInput = document.getElementById('hora-hasta');
            const duracionInput = document.getElementById('duracion-turno');

            if (!nombreInput || !tipoInput || !precioInput || !horaDesdeInput || !horaHastaInput) {
                alert('Faltan campos del formulario.');
                return;
            }

            editandoCanchaId = cancha._id;
            nombreInput.value = cancha.nombre || '';
            tipoInput.value = cancha.deporte || 'futbol';
            precioInput.value = cancha.precio || '';
            horaDesdeInput.value = cancha.horaDesde || '08:00';
            horaHastaInput.value = cancha.horaHasta || '22:00';
            if (duracionInput) duracionInput.value = String(cancha.duracionTurno || 60);
         
            // 👉 NUEVO: setear tarifa nocturna

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
 
            // 👉 NUEVO


            diasCheckboxes.forEach(dia => {
                const checkbox = document.getElementById(`dia-${dia}`);
                if (checkbox) {
                    checkbox.checked = cancha.diasDisponibles
                        ? cancha.diasDisponibles.includes(capitalize(dia))
                        : true;
                }
            });

            window._canchaAEditar = null;
        });

        // Mostrar el modal
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

    // Reservar/cancelar turnos
    btnCancelarTurno.addEventListener('click', async () => {
        if (turnoSeleccionado && turnoSeleccionado.realId) {
            const confirmar = confirm('¿Estás seguro de que querés cancelar este turno?');
            if (confirmar) {
                const res = await fetch(`https://api.canchalibre.ar/turnos/${turnoSeleccionado.realId}/cancelar`, { method: 'PATCH' });
                if (!res.ok) throw new Error('Error al cancelar turno');
                modalTurno.hide();
              
                await cargarReservas();
                await cargarAgendas();
            }
        }
    });

btnReservarTurno.addEventListener('click', async () => {
    const nombreCliente = document.getElementById('nombreCliente').value.trim();
    const telefonoCliente = document.getElementById('telefonoCliente').value.trim();
    const emailCliente = document.getElementById('emailCliente').value.trim();

    if (!nombreCliente || !telefonoCliente || !emailCliente) {
        return alert('Todos los campos son obligatorios.');
    }

    const usuarioReservado = `${nombreCliente} (${telefonoCliente})`;

console.log('📤 Enviando reserva:', {
  deporte: turnoSeleccionado.deporte,
  fecha: turnoSeleccionado.fecha,
  hora: turnoSeleccionado.hora,
  club: turnoSeleccionado.club,
  precio: turnoSeleccionado.precio,
  usuarioReservado: nombreCliente,
  emailReservado: emailCliente,
  metodoPago: 'efectivo',
  canchaId: turnoSeleccionado.canchaId
});

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


    // ========== RESERVAS ==========
    const reservasList = document.getElementById('reservas-list');
    async function cargarReservas() {
      const reservasList = document.getElementById('reservas-list');
      const historialList = document.getElementById('historial-list');
      reservasList.innerHTML = '';
      if (historialList) historialList.innerHTML = '';

      const res = await fetch(`https://api.canchalibre.ar/reservas/${clubEmail}`);
      const reservas = await res.json();

      // ---- SEPARAR RESERVAS FUTURAS Y PASADAS ----
      const ahora = new Date();

      function getDateTimeObj(fecha, hora) {
          // fecha: '2025-05-15' o '15/05/2025'
          let partes;
          if (fecha.includes('-')) {
              // 'AAAA-MM-DD'
              partes = fecha.split('-');
              return new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]), ...hora.split(':').map(Number));
          } else if (fecha.includes('/')) {
              // 'DD/MM/AAAA'
              partes = fecha.split('/');
              return new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]), ...hora.split(':').map(Number));
          }
          return null;
      }

      const futuras = [];
      const pasadas = [];
      reservas.forEach(r => {
          const fechaHora = getDateTimeObj(r.fecha, r.hora);
          if (fechaHora && fechaHora >= ahora) {
              futuras.push(r);
          } else {
              pasadas.push(r);
          }
      });

      function formatearTelefono(tel) {
        if (!tel) return '';

        // 1) Dejo solo dígitos
        let numero = String(tel).replace(/[^0-9]/g, '');

        // 2) Me quedo con los ÚLTIMOS 10 dígitos (número nacional sin 54 ni 9)
        if (numero.length >= 10) {
          numero = numero.slice(-10);
        }

        // 3) Armo siempre formato WhatsApp Argentina: 549 + número nacional
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
              botones += `<button class="btn btn-sm btn-success generar-pago" data-id="${r._id}">Generar link de pago</button>`;
              botones += `<button class="btn btn-sm btn-primary marcar-pagada" data-id="${r._id}">Marcar como pagada</button>`;
          }

          // ✅ Buscamos el teléfono en todos los campos posibles
          const telefonoReserva = r.telefonoReservado ||              '';

          // ✅ Normalizamos solo si hay algo
          const telefonoWa = telefonoReserva ? formatearTelefono(telefonoReserva) : '';

          const iconoWhatsApp = `
            <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
                 alt="WhatsApp"
                 style="width: 18px; vertical-align: middle; margin-left: 4px;">
          `;

          let htmlTelefono;
          if (telefonoWa) {
              // ✅ Hay teléfono → link clickeable a WhatsApp
              htmlTelefono = `
                📱 <a href="https://wa.me/${telefonoWa}" target="_blank" style="text-decoration: none;">
                      ${telefonoReserva}
                      ${iconoWhatsApp}
                   </a>
              `;
          } else {
              // ⚠️ No hay teléfono → icono gris y texto informativo
              htmlTelefono = `
                📱 <span title="No hay teléfono cargado" style="opacity: 0.6;">
                      (sin teléfono)
                      ${iconoWhatsApp}
                   </span>
              `;
          }

          const row = document.createElement('tr');
          row.innerHTML = `
              <td>${r.nombreCancha || 'Sin nombre'}</td>
              <td>${fechaFormateada}</td>
              <td>${r.hora}</td>
              <td>
                  ${r.usuarioId?.nombre || ''} ${r.usuarioId?.apellido || ''}<br>
                  📧 ${r.usuarioId?.email || r.emailReservado}<br>
                  ${htmlTelefono}
              </td>
              <td>${estadoPago}</td>
              <td>${botones}</td>
          `;
          reservasList.appendChild(row);
      });


      // ---- MOSTRAR PASADAS EN historial-list ----
      if (historialList) {
          pasadas.forEach(r => {
              const [anio, mes, dia] = r.fecha.includes('-') ? r.fecha.split('-') : [r.fecha.split('/')[2], r.fecha.split('/')[1], r.fecha.split('/')[0]];
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

      // ---- BOTONES DE ACCIÓN (solo para futuras) ----
      reservasList.querySelectorAll('.cancelar-reserva').forEach(btn => {
          btn.addEventListener('click', async () => {
              const id = btn.getAttribute('data-id');
              const confirmar = confirm('¿Estás seguro de que querés cancelar esta reserva?');
              if (confirmar) {
                  await fetch(`https://api.canchalibre.ar/turnos/${id}/cancelar`, { method: 'PATCH' });
                  await cargarReservas();
              }
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
                  let telefono = telefonoOriginal.replace(/[^0-9]/g, '');
                  // console.log('📞 Teléfono desde usuarioId:', telefono);
                  if (!telefono) {
                        alert('El usuario no tiene un número válido en su perfil.');
                        return;
                  }
                  if (telefono.startsWith('0')) telefono = telefono.slice(1);
                  if (!telefono.startsWith('549')) telefono = '549' + telefono;
                  const nombreClub = clubData?.nombre || reserva.club;
                  const [anio, mes, dia] = reserva.fecha.includes('-') ? reserva.fecha.split('-') : [reserva.fecha.split('/')[2], reserva.fecha.split('/')[1], reserva.fecha.split('/')[0]];
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
              if (confirmar) {
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
              }
          });
      });

      // ---- MENSAJE SI NO HAY RESERVAS ----
      if (futuras.length === 0) {
          reservasList.innerHTML = '<tr><td colspan="6">No hay reservas futuras.</td></tr>';
      }
      if (historialList && pasadas.length === 0) {
          historialList.innerHTML = '<tr><td colspan="5">No hay reservas pasadas.</td></tr>';
      }
    }

    await cargarReservas();

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // === CARGAR PROVINCIAS Y LOCALIDADES ===
    async function cargarProvinciasYLocalidades() {
        const provinciaSelect = document.getElementById('provinciaClub');
        const localidadSelect = document.getElementById('localidadClub');

        if (!provinciaSelect || !localidadSelect) return; // <-- ✅ evita error si no existen

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

        // === Guardar datos editados del club ===
        document.getElementById('form-editar-club').addEventListener('submit', async (e) => {
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
                    document.getElementById('alerta-edicion-club').classList.remove('d-none');
                } else {
                    alert(data.error || 'Error al actualizar los datos');
                }
            } catch (err) {
                console.error('❌ Error al guardar datos del club:', err);
                alert('Error al guardar datos del club');
            }
        });

    }

    await cargarProvinciasYLocalidades();

    // === REDIRECCIÓN A MIS DATOS ===
    document.getElementById('btn-mis-datos').addEventListener('click', () => {
        window.location.href = 'mis-datos.html';
    });

    async function cargarReservasHoy() {
      const contenedor = document.getElementById('lista-reservas-hoy');
      contenedor.innerHTML = '';

      try {
        const res = await fetch(`https://api.canchalibre.ar/reservas/${clubData.email}`);
        if (!res.ok) throw new Error('Error al obtener reservas');
        const reservas = await res.json();

        const hoy = new Date().toISOString().slice(0, 10); // formato: YYYY-MM-DD
        const reservasHoy = reservas.filter(r => r.fecha === hoy);

        if (reservasHoy.length === 0) {
          contenedor.innerHTML = `<p>No hay reservas para hoy.</p>`;
          return;
        }

        reservasHoy.sort((a, b) => a.hora.localeCompare(b.hora));

        reservasHoy.forEach(r => {
          const div = document.createElement('div');
          div.classList.add('border', 'rounded', 'p-2', 'mb-2', 'bg-white', 'shadow-sm');
          const nombre = (r.usuarioNombre || r.usuario?.nombre || r.usuarioId?.nombre || '') +
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

    // === ESCUCHADORES DE CAMBIO DE PESTAÑA ===
    const tabs = document.querySelectorAll('button[data-bs-toggle="tab"]');
    tabs.forEach(tab => {
      tab.addEventListener('shown.bs.tab', async event => {
        const id = event.target.id;

          if (id === 'reservas-tab') {
          await cargarReservas();
        }

        if (id === 'canchas-tab') {
          await cargarCanchas();
        }
      });
    });

    // === CARGA INICIAL SEGÚN PESTAÑA VISIBLE ===
    if (document.querySelector('#canchasTab').classList.contains('show')) {
      // console.log("📌 Carga inicial: canchas");
      await cargarCanchas();
    }

    if (document.querySelector('#reservasTab').classList.contains('show')) {
      //  console.log("📌 Carga inicial: reservas");
      await cargarReservas();
    }

});
