// ==============================
// Helpers globales (dejar al inicio)
// ==============================
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
  if (!provinciaSelect || !localidadSelect) return; // la página no tiene filtros de ubicación

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

  // 🔄 Reset del select de clubes
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
  clubSelect.innerHTML = '<option value="">Todos los clubes</option>';

  if (!localidad) {
    console.log('ℹ️ cargarClubs: localidad vacía, no cargo clubes.');
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
      opt.value = club.email;        // usamos el email como ID único
      opt.textContent = club.nombre; // lo que ve el usuario
      clubSelect.appendChild(opt);
    });

    if (data.length === 0) {
      console.warn('⚠️ No hay clubes para esa localidad (revisar datos en la BD).');
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

// ==============================
// DOMContentLoaded
// ==============================
window.addEventListener('DOMContentLoaded', () => {
// ==========================================
// 🛰 DETECCIÓN AUTOMÁTICA DE UBICACIÓN (silenciosa)
// ==========================================
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      reverseGeocode(pos.coords.latitude, pos.coords.longitude);
    },
    (err) => {
      console.warn("⚠️ No se pudo obtener la ubicación automática:", err.message);
    }
  );
}

// ==================================================
// 📍 Botón "Usar mi ubicación"
// ==================================================
const botonGPS = document.getElementById("usar-ubicacion");
if (botonGPS) {
  botonGPS.addEventListener("click", () => {
    if (navigator.geolocation) {
      const status = document.getElementById("gps-status");
 
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {

        }
      );
    }
  });
}

// ==================================================
// 🧭 Autocompletar selects según GPS
// ==================================================
async function autocompletarProvinciaLocalidad(provincia, localidad) {
  const selProv = document.getElementById("provincia");
  const selLoc = document.getElementById("localidad");

  if (!selProv || !selLoc) return;

  console.log("🎯 Autocompletar:", provincia, localidad);

  // Esperar a que cargarUbicaciones() termine
  let intentos = 0;
  const esperar = setInterval(() => {
    intentos++;

    if (selProv.options.length > 1) {
      clearInterval(esperar);
      seleccionarProvLoc();
    }

    if (intentos > 20) {
      clearInterval(esperar);
      console.warn("⏳ Timeout esperando provincias");
    }
  }, 200);

  function seleccionarProvLoc() {
    // Seleccionar provincia
    for (let opt of selProv.options) {
      if (opt.text.toLowerCase() === provincia.toLowerCase()) {
        selProv.value = opt.value;
        break;
      }
    }

    // Disparar carga de localidades
    selProv.dispatchEvent(new Event("change"));

    // Esperar carga de localidades
    setTimeout(() => {
      for (let opt of selLoc.options) {
        if (opt.text.toLowerCase() === localidad.toLowerCase()) {
          selLoc.value = opt.value;
          break;
        }
      }

      // Disparar carga de clubes
      selLoc.dispatchEvent(new Event("change"));
    }, 400);
  }
}


  // --- Login/Logout + protección de vistas ---
  const email = localStorage.getItem('usuarioLogueado');
  const spanUsuario = document.getElementById('usuario-logueado');
  const botonLogout = document.getElementById('logout');

  if (email) {
    if (spanUsuario) {
      spanUsuario.textContent = `Sesión iniciada como: ${email}`;
      const linkPanel = document.createElement('a');
      linkPanel.href = 'panel-usuario.html';
      linkPanel.textContent = 'Mi cuenta';
      linkPanel.style.marginLeft = '10px';
      spanUsuario.appendChild(linkPanel);
    }
    if (botonLogout) {
      botonLogout.style.display = 'inline';
      botonLogout.addEventListener('click', () => {
        localStorage.removeItem('usuarioLogueado');
        window.location.href = 'login.html';
      });
    }
  } else {
    if (spanUsuario) spanUsuario.textContent = 'No has iniciado sesión';

    const formulario = document.getElementById('formulario-busqueda');
    if (formulario) {
      const contenedor = document.createElement('div');
      const mensaje = document.createElement('p');
      mensaje.textContent = 'Debes iniciar sesión para ver y reservar turnos.';
      contenedor.appendChild(mensaje);

      const botonLogin = document.createElement('button');
      botonLogin.textContent = 'Iniciar sesión';
      botonLogin.style.marginTop = '10px';
      botonLogin.onclick = () => (window.location.href = 'login.html');
      contenedor.appendChild(botonLogin);

      formulario.replaceWith(contenedor);
    }

    if (window.location.pathname.includes('detalle.html')) {
      alert('Debes iniciar sesión para acceder a esta página.');
      window.location.href = 'login.html';
      return; // evitamos seguir ejecutando en detalle.html sin login
    }
  }

  // --- Carga de provincias/localidades si corresponde ---
  cargarUbicaciones();
  // ==================================================
// 🧭 Corrección de nombres de provincia
// ==================================================
function normalizarProvinciaGPS(p) {
  const t = p.toLowerCase();

  if (t.includes("buenos aires") && t.includes("provincia")) return "Buenos Aires";
  if (t.includes("ciudad autónoma") || t.includes("caba") || t.includes("capital federal")) return "CABA";
  if (t.includes("cordoba")) return "Córdoba";
  if (t.includes("neuquen")) return "Neuquén";
  if (t.includes("rio negro")) return "Río Negro";
  if (t.includes("misiones")) return "Misiones";

  // Por defecto, devolver nombre como está pero capitalizado
  return p.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ==================================================
// 🌍 Reverse Geocoding → Nominatim (OpenStreetMap)
// ==================================================
async function reverseGeocode(lat, lon) {
  try {
    const status = document.getElementById("gps-status");
  
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
    const status = document.getElementById("gps-status");

  }
}


// ==================================================
// 🧭 Autocompletar selects según GPS
// ==================================================
async function autocompletarProvinciaLocalidad(provincia, localidad) {
  const selProv = document.getElementById("provincia");
  const selLoc = document.getElementById("localidad");

  if (!selProv || !selLoc) return;

  console.log("🎯 Intentando autocompletar:", provincia, localidad);

  // Esperar a que cargarUbicaciones() termine
  let intentos = 0;
  const esperar = setInterval(() => {
    intentos++;

    // Provincias cargadas correctamente → continuar
    if (selProv.options.length > 1) {
      clearInterval(esperar);
      seleccionarProvLoc();
    }

    // Tiempo máximo de espera (4 segundos)
    if (intentos > 20) {
      clearInterval(esperar);
      console.warn("⏳ Timeout esperando carga de provincias");
    }
  }, 200);

  function seleccionarProvLoc() {
    // Seleccionar la provincia
    for (let opt of selProv.options) {
      if (opt.text.toLowerCase() === provincia.toLowerCase()) {
        selProv.value = opt.value;
        break;
      }
    }

    // Disparar carga de localidades
    selProv.dispatchEvent(new Event("change"));

    // Esperar 300ms a que se carguen las localidades
    setTimeout(() => {
      for (let opt of selLoc.options) {
        if (opt.text.toLowerCase() === localidad.toLowerCase()) {
          selLoc.value = opt.value;
          break;
        }
      }

      // Disparar carga de clubes
      selLoc.dispatchEvent(new Event("change"));
    }, 300);
  }
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
      const clubSeleccionado = document.getElementById('club')?.value || '';

      resultados.innerHTML = '';

      try {
        // Trae turnos (con provincia/localidad como filtros de backend)
        const respuesta = await fetch(
          `https://api.canchalibre.ar/turnos-generados?fecha=${encodeURIComponent(fechaSeleccionada)}&provincia=${encodeURIComponent(provinciaSeleccionada)}&localidad=${encodeURIComponent(localidadSeleccionada)}&club=${encodeURIComponent(clubSeleccionado)}`
        );

        if (!respuesta.ok) throw new Error('Respuesta no OK al obtener turnos');
        const turnos = await respuesta.json();

        const clubes = await obtenerClubes();

        // Filtro en frontend
        const ahora = new Date();
        const turnosFiltrados = turnos.filter((turno) => {
          const turnoDateTime = new Date(`${turno.fecha}T${turno.hora}`);
          const deporteOK = normalizarTexto(turno.deporte) === normalizarTexto(deporteSeleccionado);
          const fechaOK = turno.fecha === fechaSeleccionada;
          const horaOK = !horaSeleccionada || turno.hora === horaSeleccionada;
          const noReservadoOK = !turno.usuarioReservado;
          const futuroOK = turnoDateTime >= ahora;
      
          // ✅ Nuevo: filtrar por club si se seleccionó uno
            const clubOK = !clubSeleccionado || turno.club === clubSeleccionado;

            return deporteOK && fechaOK && horaOK && noReservadoOK && futuroOK && clubOK;
          });

        // Orden por club destacado
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
          '${turno.club}',   // 👈 acá siempre va el EMAIL del club
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

        // Ocultar pago online si el club no tiene MP configurado
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
          const metodoPago = document.getElementById('metodo-pago')?.value || 'club';

// 🆕 NUEVO FLUJO: reserva pendiente con confirmación por email
try {
  const respuesta = await fetch('https://api.canchalibre.ar/reservas/hold', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      canchaId: sanitizeHTML(turnoGuardado.canchaId),
      fecha: sanitizeHTML(turnoGuardado.fecha),
      hora: sanitizeHTML(turnoGuardado.hora),
      usuarioId: null, // si más adelante tenés el ID del usuario logueado, podés pasarlo acá
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

    // Pedir permisos si no están otorgados
    await Geolocation.requestPermissions();

    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true
    });

    console.log("📍 Ubicación obtenida:", pos);

    reverseGeocode(pos.coords.latitude, pos.coords.longitude);

  } catch (err) {
    console.error("❌ Error obteniendo GPS:", err);
    alert("No fue posible obtener tu ubicación.");
  }
}


