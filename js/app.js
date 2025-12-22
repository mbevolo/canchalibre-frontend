// ==============================
// Helpers globales (dejar al inicio)
// ==============================

// ✅ Leer clubId desde la URL (para QR / link directo)
// Ej: https://canchalibre.ar/?clubId=6930aea8d20251679515f08c
function getClubIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const clubId = params.get('clubId');
  return clubId && clubId.trim() ? clubId.trim() : null;
}

// ✅ Resolver clubId (Mongo _id) -> email usando tu backend
async function resolverClubEmailDesdeId(clubId) {
  try {
    const res = await fetch(`https://api.canchalibre.ar/club-id/${encodeURIComponent(clubId)}`);
    if (!res.ok) throw new Error('No se pudo resolver clubId');
    const club = await res.json();
    return club?.email || null;
  } catch (e) {
    console.error('❌ Error resolviendo clubId -> email:', e);
    return null;
  }
}

// ✅ Variables globales del flujo QR
const CLUB_ID_RAW_FROM_URL = getClubIdFromUrl(); // lo que viene en la URL (normalmente _id)
let CLUB_EMAIL_FROM_URL = null;                  // el email resuelto (lo que usa el sistema actual)

window.sanitizeHTML = function (str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
};

window.normalizarTelefono = function (tel) {
  let t = String(tel || '').replace(/\D/g, '');
  if (!t.startsWith('549')) t = '549' + t;
  return t;
};

window.formatDuracion = function (min) {
  const n = Number(min) || 60;
  if (n === 90) return '1 hora y media';
  if (n === 60) return '1 hora';
  if (n % 60 === 0 && n > 60) return `${n / 60} horas`;
  return `${n} min`;
};

// 🚩 Global para que funcione el onclick de los botones "Reservar"
window.guardarTurnoYRedirigir = function (canchaId, club, deporte, fecha, hora, precio, duracionTurno) {
  localStorage.setItem(
    'turnoSeleccionado',
    JSON.stringify({ canchaId, club, deporte, fecha, hora, precio, duracionTurno })
  );
  window.location.href = 'detalle.html';
};

// ==============================
// Funciones auxiliares
// ==============================
function normalizarTexto(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

async function obtenerClubes() {
  try {
    const res = await fetch('https://api.canchalibre.ar/clubes');
    if (!res.ok) throw new Error('Respuesta no OK al obtener clubes');
    return await res.json();
  } catch (e) {
    console.error('❌ Error al obtener clubes:', e);
    return [];
  }
}

function ordenarTurnosPorDestacado(turnos, clubes) {
  const ahora = new Date();
  return turnos.sort((a, b) => {
    const clubA = clubes.find(c => c.email === a.club);
    const clubB = clubes.find(c => c.email === b.club);

    const destacadoA = !!(clubA && clubA.destacado && new Date(clubA.destacadoHasta) > ahora);
    const destacadoB = !!(clubB && clubB.destacado && new Date(clubB.destacadoHasta) > ahora);

    if (destacadoA && !destacadoB) return -1;
    if (!destacadoA && destacadoB) return 1;
    return 0;
  });
}

async function cargarUbicaciones() {
  const provinciaSelect = document.getElementById('provincia');
  const localidadSelect = document.getElementById('localidad');
  if (!provinciaSelect || !localidadSelect) return;

  try {
    const res = await fetch('https://api.canchalibre.ar/ubicaciones');
    const data = await res.json();

    provinciaSelect.innerHTML = '<option value="">Todas</option>';
    Object.keys(data).forEach(prov => {
      const option = document.createElement('option');
      option.value = prov;
      option.textContent = prov;
      provinciaSelect.appendChild(option);
    });

    localidadSelect.innerHTML = '<option value="">Todas</option>';
    localidadSelect.disabled = true;

    provinciaSelect.addEventListener('change', () => {
      const seleccion = provinciaSelect.value;

      // Reset de localidades
      localidadSelect.innerHTML = '<option value="">Todas</option>';
      localidadSelect.disabled = true;

      // Reset del select de clubes
      const clubSelect = document.getElementById('club');
      if (clubSelect) {
        clubSelect.innerHTML = '<option value="">Todos los clubes</option>';
      }

      if (data[seleccion]) {
        data[seleccion].forEach(loc => {
          const option = document.createElement('option');
          option.value = loc;
          option.textContent = loc;
          localidadSelect.appendChild(option);
        });
        localidadSelect.disabled = false;
      }
    });

    // Cuando cambia la localidad, cargamos los clubes de esa localidad
    localidadSelect.addEventListener('change', () => {
      cargarClubs(provinciaSelect.value, localidadSelect.value);
    });

  } catch (err) {
    console.error('❌ Error al cargar ubicaciones:', err);
  }
}

async function cargarClubs(provincia, localidad) {
  const clubSelect = document.getElementById('club');
  if (!clubSelect) return;

  clubSelect.innerHTML = '<option value="">Todos los clubes</option>';

  if (!localidad) {
    console.log('ℹ️ cargarClubs: localidad vacía, no cargo clubes.');

    // Si el club vino por URL y ya está resuelto, lo intento setear igual
    if (CLUB_EMAIL_FROM_URL) {
      clubSelect.value = CLUB_EMAIL_FROM_URL;
      clubSelect.disabled = true;
    }
    return;
  }

  try {
    const res = await fetch(
      `https://api.canchalibre.ar/clubes?provincia=${encodeURIComponent(provincia || '')}&localidad=${encodeURIComponent(localidad)}`
    );
    if (!res.ok) throw new Error('Respuesta no OK al obtener clubes');
    const data = await res.json();

    data.forEach(club => {
      const opt = document.createElement('option');
      opt.value = club.email;        // 👈 el sistema actual usa email
      opt.textContent = club.nombre; // lo que ve el usuario
      clubSelect.appendChild(opt);
    });

    if (data.length === 0) {
      console.warn('⚠️ No hay clubes para esa localidad (revisar datos en la BD).');
    }

    // Si el club vino por URL y ya lo resolvimos a email -> lo preseleccionamos
    if (CLUB_EMAIL_FROM_URL) {
      clubSelect.value = CLUB_EMAIL_FROM_URL;

      const existe = Array.from(clubSelect.options).some(o => o.value === CLUB_EMAIL_FROM_URL);
      if (!existe) {
        console.warn('⚠️ El club del link no existe en la lista cargada para esa provincia/localidad.');
      }

      clubSelect.disabled = true;

      // Opcional: bloquear provincia/localidad para que no lo cambien
      const provinciaSelect = document.getElementById('provincia');
      const localidadSelect = document.getElementById('localidad');
      if (provinciaSelect) provinciaSelect.disabled = true;
      if (localidadSelect) localidadSelect.disabled = true;
    }

  } catch (err) {
    console.error('❌ Error cargando clubes:', err);
  }
}

function mostrarMapa(turnos) {
  const resultados = document.getElementById('resultados');
  if (!resultados) return;

  const mapContainer = document.createElement('div');
  mapContainer.id = 'map';
  mapContainer.style.height = '500px';
  mapContainer.style.marginTop = '16px';
  resultados.appendChild(mapContainer);

  if (typeof L === 'undefined') {
    const aviso = document.createElement('p');
    aviso.textContent = 'El mapa no se pudo cargar (Leaflet no disponible).';
    resultados.appendChild(aviso);
    return;
  }

  const map = L.map('map').setView([-34.6037, -58.3816], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  turnos.forEach(turno => {
    if (turno.latitud && turno.longitud) {
      const popupContent = `
        <b>${sanitizeHTML(turno.deporte)}</b><br>
        ${sanitizeHTML(turno.club)}<br>
        ${sanitizeHTML(turno.fecha)} ${sanitizeHTML(turno.hora)}<br>
        $${Number(turno.precio) || 0}<br>
        Duración: ${formatDuracion(turno.duracionTurno)}<br>
        <button onclick="guardarTurnoYRedirigir('${sanitizeHTML(turno.canchaId)}', '${sanitizeHTML(turno.club)}', '${sanitizeHTML(turno.deporte)}', '${sanitizeHTML(turno.fecha)}', '${sanitizeHTML(turno.hora)}', ${Number(turno.precio) || 0}, ${Number(turno.duracionTurno) || 60})">Reservar</button>
      `;
      L.marker([turno.latitud, turno.longitud])
        .addTo(map)
        .bindPopup(popupContent);
    }
  });
}

// ==================================================
// 🧭 Corrección de nombres de provincia (GLOBAL)
// ==================================================
function normalizarProvinciaGPS(p) {
  const t = String(p || '').toLowerCase();

  if (t.includes("buenos aires") && t.includes("provincia")) return "Buenos Aires";
  if (t.includes("ciudad autónoma") || t.includes("caba") || t.includes("capital federal")) return "CABA";
  if (t.includes("cordoba")) return "Córdoba";
  if (t.includes("neuquen")) return "Neuquén";
  if (t.includes("rio negro")) return "Río Negro";
  if (t.includes("misiones")) return "Misiones";

  return String(p || '').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ==================================================
// 🌍 Reverse Geocoding → Nominatim (GLOBAL)
// ==================================================
async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;

    const res = await fetch(url, {
      headers: { "User-Agent": "CanchaLibre/1.0" }
    });

    const data = await res.json();
    if (!data.address) return;

    const provinciaRAW = data.address.state || "";
    const localidadRAW =
      data.address.town ||
      data.address.city ||
      data.address.village ||
      data.address.suburb ||
      "";

    const provincia = normalizarProvinciaGPS(provinciaRAW);
    const localidad = localidadRAW;

    console.log("📌 Provincia detectada:", provincia);
    console.log("📌 Localidad detectada:", localidad);

    if (provincia && localidad) {
      autocompletarProvinciaLocalidad(provincia, localidad);
    }
  } catch (err) {
    console.error("❌ Error en reverse geocoding:", err);
  }
}

// ==================================================
// 🧭 Autocompletar selects según GPS (GLOBAL)
// ==================================================
async function autocompletarProvinciaLocalidad(provincia, localidad) {
  const selProv = document.getElementById("provincia");
  const selLoc = document.getElementById("localidad");
  if (!selProv || !selLoc) return;

  console.log("🎯 Intentando autocompletar:", provincia, localidad);

  // ✅ Si viene club por URL (QR), NO autocompletamos por GPS (para no pisar el flujo)
  if (CLUB_EMAIL_FROM_URL) {
    console.log("🔒 Club fijo por URL detectado. Se omite autocompletado por GPS.");
    const clubSelect = document.getElementById('club');
    if (clubSelect) {
      clubSelect.value = CLUB_EMAIL_FROM_URL;
      clubSelect.disabled = true;
    }
    return;
  }

  let intentos = 0;
  const esperar = setInterval(() => {
    intentos++;

    if (selProv.options.length > 1) {
      clearInterval(esperar);
      seleccionarProvLoc();
    }

    if (intentos > 20) {
      clearInterval(esperar);
      console.warn("⏳ Timeout esperando carga de provincias");
    }
  }, 200);

  function seleccionarProvLoc() {
    for (let opt of selProv.options) {
      if (opt.text.toLowerCase() === provincia.toLowerCase()) {
        selProv.value = opt.value;
        break;
      }
    }

    selProv.dispatchEvent(new Event("change"));

    setTimeout(() => {
      for (let opt of selLoc.options) {
        if (opt.text.toLowerCase() === localidad.toLowerCase()) {
          selLoc.value = opt.value;
          break;
        }
      }
      selLoc.dispatchEvent(new Event("change"));
    }, 300);
  }
}

// ==============================
// DOMContentLoaded
// ==============================
window.addEventListener('DOMContentLoaded', async () => {
  // 1) Si viene ?clubId=... lo resolvemos a email para mantener compatibilidad
  if (CLUB_ID_RAW_FROM_URL) {
    CLUB_EMAIL_FROM_URL = await resolverClubEmailDesdeId(CLUB_ID_RAW_FROM_URL);

    if (CLUB_EMAIL_FROM_URL) {
      console.log('🔒 Club fijado por QR:', CLUB_EMAIL_FROM_URL);

      // Bloquear provincia/localidad para que no cambien el club fijado
      const selProv = document.getElementById('provincia');
      const selLoc = document.getElementById('localidad');
      if (selProv) selProv.disabled = true;
      if (selLoc) selLoc.disabled = true;

      const clubSelect = document.getElementById('club');
      if (clubSelect) {
        clubSelect.value = CLUB_EMAIL_FROM_URL;
        clubSelect.disabled = true;
      }
    } else {
      console.warn('⚠️ clubId inválido o no encontrado. Se ignora preselección.');
    }
  }

  // 2) GPS automático SOLO si NO hay club fijado por URL
  if (!CLUB_EMAIL_FROM_URL && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => reverseGeocode(pos.coords.latitude, pos.coords.longitude),
      (err) => console.warn("⚠️ No se pudo obtener la ubicación automática:", err.message)
    );
  }

  // Botón "Usar mi ubicación" SOLO si NO hay club fijado por URL
  const botonGPS = document.getElementById("usar-ubicacion");
  if (botonGPS) {
    botonGPS.addEventListener("click", () => {
      if (CLUB_EMAIL_FROM_URL) return; // no pisar QR
      if (!navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition(
        (pos) => reverseGeocode(pos.coords.latitude, pos.coords.longitude),
        (err) => console.error("Error geolocalización", err)
      );
    });
  }

  // --- Login/Logout + protección de vistas ---
  const email = localStorage.getItem('usuarioLogueado');
  const spanUsuario = document.getElementById('usuario-logueado');
  const botonLogout = document.getElementById('logout');

  if (email) {
    if (spanUsuario) spanUsuario.textContent = email;

    if (botonLogout) {
      botonLogout.style.display = 'inline';
      botonLogout.addEventListener('click', () => {
        localStorage.removeItem('usuarioLogueado');
        window.location.href = 'login.html';
      });
    }
  } else {
    if (spanUsuario) spanUsuario.textContent = 'No has iniciado sesión';

    const formularioTmp = document.getElementById('formulario-busqueda');
    if (formularioTmp) {
      const contenedor = document.createElement('div');
      const mensaje = document.createElement('p');
      mensaje.textContent = 'Debes iniciar sesión para ver y reservar turnos.';
      contenedor.appendChild(mensaje);

      const botonLogin = document.createElement('button');
      botonLogin.textContent = 'Iniciar sesión';
      botonLogin.style.marginTop = '10px';
      botonLogin.onclick = () => (window.location.href = 'login.html');
      contenedor.appendChild(botonLogin);

      formularioTmp.replaceWith(contenedor);
    }

    if (window.location.pathname.includes('detalle.html')) {
      alert('Debes iniciar sesión para acceder a esta página.');
      window.location.href = 'login.html';
      return;
    }
  }

  // --- Carga de provincias/localidades si corresponde ---
  await cargarUbicaciones();

  // Si el club vino por QR, intento fijar el select incluso después de cargar ubicaciones
  const clubSelectInit = document.getElementById('club');
  if (CLUB_EMAIL_FROM_URL && clubSelectInit) {
    clubSelectInit.value = CLUB_EMAIL_FROM_URL;
    clubSelectInit.disabled = true;
  }

  // --- Buscador de turnos (index.html) ---
  const formulario = document.getElementById('formulario-busqueda');
  const resultados = document.getElementById('resultados');

  if (formulario && resultados) {
    formulario.addEventListener('submit', async (event) => {
      event.preventDefault();

      const deporteSeleccionado = document.getElementById('deporte')?.value || '';
      const fechaSeleccionada = document.getElementById('fecha')?.value || '';
      const horaSeleccionada = document.getElementById('hora')?.value || '';
      const provinciaSeleccionada = document.getElementById('provincia')?.value || '';
      const localidadSeleccionada = document.getElementById('localidad')?.value || '';

      // ✅ Prioridad: club fijado por URL (QR)
      const clubSeleccionado = CLUB_EMAIL_FROM_URL || (document.getElementById('club')?.value || '');

      resultados.innerHTML = '';

      try {
        const respuesta = await fetch(
          `https://api.canchalibre.ar/turnos-generados?fecha=${encodeURIComponent(fechaSeleccionada)}&provincia=${encodeURIComponent(provinciaSeleccionada)}&localidad=${encodeURIComponent(localidadSeleccionada)}&club=${encodeURIComponent(clubSeleccionado)}`
        );

        if (!respuesta.ok) throw new Error('Respuesta no OK al obtener turnos');
        const turnos = await respuesta.json();

        const clubes = await obtenerClubes();

        const ahora = new Date();
        const turnosFiltrados = turnos.filter((turno) => {
          const turnoDateTime = new Date(`${turno.fecha}T${turno.hora}`);
          const deporteOK = normalizarTexto(turno.deporte) === normalizarTexto(deporteSeleccionado);
          const fechaOK = turno.fecha === fechaSeleccionada;
          const horaOK = !horaSeleccionada || turno.hora === horaSeleccionada;
          const noReservadoOK = !turno.usuarioReservado;
          const futuroOK = turnoDateTime >= ahora;

          // ✅ Filtrar por club si corresponde (email)
          const clubOK = !clubSeleccionado || turno.club === clubSeleccionado;

          return deporteOK && fechaOK && horaOK && noReservadoOK && futuroOK && clubOK;
        });

        const turnosOrdenados = ordenarTurnosPorDestacado(turnosFiltrados, clubes);

        if (turnosOrdenados.length > 0) {
          turnosOrdenados.forEach((turno) => {
            const turnoDiv = document.createElement('div');
            turnoDiv.classList.add('turno');

            const clubInfo = clubes.find((c) => c.email === turno.club);
            const esDestacado =
              clubInfo && clubInfo.destacado && new Date(clubInfo.destacadoHasta) > new Date();

            turnoDiv.innerHTML = `
              <h3>${sanitizeHTML(clubInfo ? clubInfo.nombre : turno.club)} 
                ${esDestacado ? '<span style="color:gold;font-size:1.2em;">⭐ Club Destacado</span>' : ''}
              </h3>
              <p>Deporte: ${sanitizeHTML(turno.deporte)}</p>
              <p>Fecha: ${sanitizeHTML(turno.fecha)}</p>
              <p>Hora: ${sanitizeHTML(turno.hora)}</p>
              <p>Precio: $${Number(turno.precio) || 0}</p>
              <p>Duración: ${formatDuracion(turno.duracionTurno)}</p>
              <button onclick="guardarTurnoYRedirigir(
                '${turno.canchaId}',
                '${turno.club}',
                '${turno.deporte}',
                '${turno.fecha}',
                '${turno.hora}',
                ${Number(turno.precio) || 0},
                ${Number(turno.duracionTurno) || 60}
              )">Reservar</button>
            `;

            resultados.appendChild(turnoDiv);
          });

          const botonMapa = document.createElement('button');
          botonMapa.textContent = 'Ver en mapa';
          botonMapa.style.marginTop = '20px';
          botonMapa.addEventListener('click', () => mostrarMapa(turnosOrdenados));
          resultados.appendChild(botonMapa);
        } else {
          resultados.innerHTML = '<p>No se encontraron turnos disponibles para esa búsqueda.</p>';
        }
      } catch (error) {
        console.error('Error al cargar turnos:', error);
        resultados.innerHTML = '<p>Error al cargar los turnos. Intenta nuevamente más tarde.</p>';
      }
    });
  }

  // --- Página detalle.html ---
  if (window.location.pathname.includes('detalle.html')) {
    const turnoGuardado = JSON.parse(localStorage.getItem('turnoSeleccionado') || 'null');
    if (!turnoGuardado) return;

    const detalleDiv = document.getElementById('detalle');
    if (!detalleDiv) return;

    fetch(`https://api.canchalibre.ar/club/${encodeURIComponent(turnoGuardado.club)}`)
      .then((res) => res.json())
      .then((club) => {
        detalleDiv.innerHTML = `
          <h3>${sanitizeHTML(club?.nombre || turnoGuardado.club)}</h3>
          <p>Deporte: ${sanitizeHTML(turnoGuardado.deporte)}</p>
          <p>Fecha: ${sanitizeHTML(turnoGuardado.fecha)}</p>
          <p>Hora: ${sanitizeHTML(turnoGuardado.hora)}</p>
          <p>Precio: $${Number(turnoGuardado.precio) || 0}</p>
          <p>Duración: ${formatDuracion(turnoGuardado.duracionTurno)}</p>
        `;

        const selectPago = document.getElementById('metodo-pago');
        if (selectPago && !club?.mercadoPagoAccessToken) {
          const opcionOnline = selectPago.querySelector('option[value="online"]');
          if (opcionOnline) opcionOnline.remove();
        }

        agregarEventosDetalle();
      })
      .catch(() => {
        detalleDiv.innerHTML = `
          <h3>${sanitizeHTML(turnoGuardado.club)}</h3>
          <p>Deporte: ${sanitizeHTML(turnoGuardado.deporte)}</p>
          <p>Fecha: ${sanitizeHTML(turnoGuardado.fecha)}</p>
          <p>Hora: ${sanitizeHTML(turnoGuardado.hora)}</p>
          <p>Precio: $${Number(turnoGuardado.precio) || 0}</p>
          <p>Duración: ${formatDuracion(turnoGuardado.duracionTurno)}</p>
        `;
        agregarEventosDetalle();
      });

    function agregarEventosDetalle() {
      const checkboxGrupal = document.getElementById('reserva-grupal');
      const divGrupoJugadores = document.getElementById('grupo-jugadores');

      if (checkboxGrupal && divGrupoJugadores) {
        checkboxGrupal.addEventListener('change', function () {
          divGrupoJugadores.style.display = this.checked ? 'block' : 'none';
        });
      }

      const botonConfirmar = document.getElementById('confirmar-reserva');
      if (botonConfirmar) {
        botonConfirmar.addEventListener('click', async function () {
          const usuarioEmail = localStorage.getItem('usuarioLogueado');

          try {
            const respuesta = await fetch('https://api.canchalibre.ar/reservas/hold', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                canchaId: sanitizeHTML(turnoGuardado.canchaId),
                fecha: sanitizeHTML(turnoGuardado.fecha),
                hora: sanitizeHTML(turnoGuardado.hora),
                usuarioId: null,
                email: sanitizeHTML(usuarioEmail)
              })
            });

            const data = await respuesta.json();

            if (respuesta.ok) {
              alert('✅ Te enviamos un correo electrónico para confirmar tu reserva. Revisá tu bandeja de entrada o SPAM.');
              window.location.href = 'index.html';
            } else {
              alert('❌ No se pudo crear la reserva: ' + (data.error || 'Error desconocido.'));
            }
          } catch (error) {
            console.error('❌ Error en /reservas/hold:', error);
            alert('❌ No se pudo conectar con el servidor.');
          }
        });
      }
    }
  }
});

// ==============================
// 🔥 GPS con Capacitor (Android)
// ==============================
async function obtenerUbicacion() {
  try {
    const { Geolocation } = Capacitor.Plugins;

    await Geolocation.requestPermissions();

    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true
    });

    console.log("📍 Ubicación obtenida:", pos);

    // ✅ usa reverseGeocode global
    reverseGeocode(pos.coords.latitude, pos.coords.longitude);

  } catch (err) {
    console.error("❌ Error obteniendo GPS:", err);
    alert("No fue posible obtener tu ubicación.");
  }
}
