document.addEventListener('DOMContentLoaded', async () => {
  const auth = window.CanchalibreAuth;
  if (!auth) return;

  const autenticado = await auth.requireUserSession();
  if (!autenticado) {
    alert('Debes iniciar sesión.');
    window.location.href = 'login.html';
    return;
  }

  const info = document.getElementById('info-usuario');
  const btnCerrarSesion = document.getElementById('cerrar-sesion');

  if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener('click', async () => {
      await auth.logoutUser();
      window.location.href = 'login.html';
    });
  }

  async function cargarDatosUsuario() {
    const res = await auth.authFetch('/auth/me');
    if (!res.ok) throw new Error('No se pudieron cargar los datos del usuario');

    const usuario = await res.json();

    if (info) {
      info.textContent = 'Estás logueado como: ' + usuario.email;
    }

    document.getElementById('nombre').value = usuario.nombre || '';
    document.getElementById('apellido').value = usuario.apellido || '';
    document.getElementById('telefono').value = usuario.telefono || '';
    document.getElementById('email').value = usuario.email || '';
  }

  const camposUsuario = ['nombre', 'apellido', 'telefono'];
  const btnEditar = document.getElementById('btn-editar');
  const btnGuardar = document.getElementById('btn-guardar');

  function modoLectura() {
    camposUsuario.forEach(id => {
      const input = document.getElementById(id);
      if (input) input.disabled = true;
    });
    if (btnEditar) btnEditar.style.display = 'inline-block';
    if (btnGuardar) btnGuardar.style.display = 'none';
  }

  function modoEdicion() {
    camposUsuario.forEach(id => {
      const input = document.getElementById(id);
      if (input) input.disabled = false;
    });
    if (btnEditar) btnEditar.style.display = 'none';
    if (btnGuardar) btnGuardar.style.display = 'inline-block';
  }

  btnEditar?.addEventListener('click', modoEdicion);

  document.getElementById('form-usuario')?.addEventListener('submit', async e => {
    e.preventDefault();

    const datos = {
      nombre: document.getElementById('nombre').value.trim(),
      apellido: document.getElementById('apellido').value.trim(),
      telefono: document.getElementById('telefono').value.trim()
    };

    try {
      const res = await auth.authFetch('/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || 'Error al actualizar los datos.');
        return;
      }

      alert(data.mensaje || 'Datos actualizados correctamente.');
      modoLectura();
      await cargarDatosUsuario();
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      alert('Error al actualizar los datos.');
    }
  });

  async function cargarReservas() {
    const contenedor = document.getElementById('reservas-container');
    if (!contenedor) return;

    try {
      const res = await auth.authFetch('/api/me/reservas');
      const reservas = await res.json();

      if (!res.ok) {
        throw new Error(reservas.error || 'Error al cargar reservas');
      }

      const ahora = new Date();

      const toDate = (fecha, hora) => {
        if (!fecha || !hora) return null;
        const partes = fecha.includes('-')
          ? fecha.split('-').map(Number)
          : [fecha.split('/')[2], fecha.split('/')[1], fecha.split('/')[0]].map(Number);
        const [h, m] = hora.split(':').map(Number);
        return new Date(partes[0], partes[1] - 1, partes[2], h, m);
      };

      const futuras = reservas
        .filter(r => {
          const d = toDate(r.fecha, r.hora);
          return d && d >= ahora;
        })
        .sort((a, b) => toDate(a.fecha, a.hora) - toDate(b.fecha, b.hora));

      const pasadas = reservas
        .filter(r => {
          const d = toDate(r.fecha, r.hora);
          return d && d < ahora;
        })
        .sort((a, b) => toDate(b.fecha, b.hora) - toDate(a.fecha, a.hora));

      const cardReserva = r => {
        const pendiente = r.tipo === 'PENDING';
        const fecha = r.fecha.includes('-')
          ? r.fecha.split('-').reverse().join('/')
          : r.fecha;

        const estado = pendiente
          ? '<span class="badge text-bg-warning">Pendiente de confirmación</span>'
          : (r.pagado
            ? '<span class="badge text-bg-success">Pagado</span>'
            : '<span class="badge text-bg-danger">Pendiente de pago</span>');

        let botones = '';

        if (pendiente) {
          botones =
            '<button class="btn btn-sm btn-outline-primary btn-reenviar" data-id="' + r._id + '">🔁 Reenviar correo</button>' +
            ' <button class="btn btn-sm btn-outline-danger btn-cancelar-pendiente" data-id="' + r._id + '">Cancelar</button>';
        } else {
          botones =
            '<button class="btn btn-sm btn-danger btn-cancelar" data-id="' + r._id + '">Cancelar</button>' +
            (!r.pagado
              ? ' <button class="btn btn-sm btn-success btn-pagar" data-id="' + r._id + '">Pagar online</button>'
              : '');
        }

        return '<div class="card mb-2 shadow-sm"><div class="card-body d-flex justify-content-between align-items-center">' +
          '<div><div class="fw-bold">' + (r.nombreClub || 'Club') + '</div>' +
          '<div class="text-muted">Cancha: ' + (r.nombreCancha || '—') + '</div>' +
          '<div>📅 ' + fecha + ' — 🕒 ' + r.hora + '</div>' +
          '<div class="mt-1">' + estado + '</div></div>' +
          '<div>' + botones + '</div></div></div>';
      };

      const htmlFuturas = futuras.length
        ? futuras.map(cardReserva).join('')
        : '<div class="alert alert-info">No tenés reservas futuras.</div>';

      const htmlPasadas = pasadas.length
        ? pasadas.map(cardReserva).join('')
        : '<div class="alert alert-secondary">No tenés reservas pasadas.</div>';

      contenedor.innerHTML =
        '<div id="reservas-futuras">' + htmlFuturas + '</div>' +
        '<div class="mt-3"><button id="toggle-pasadas" class="btn btn-outline-secondary btn-sm">Ver reservas pasadas</button></div>' +
        '<div id="reservas-pasadas" class="mt-3" style="display:none;">' + htmlPasadas + '</div>';

      document.getElementById('toggle-pasadas')?.addEventListener('click', () => {
        const box = document.getElementById('reservas-pasadas');
        const visible = box.style.display !== 'none';
        box.style.display = visible ? 'none' : 'block';
        document.getElementById('toggle-pasadas').textContent =
          visible ? 'Ver reservas pasadas' : 'Ocultar reservas pasadas';
      });
    } catch (err) {
      console.error('❌ Error al cargar reservas:', err);
      contenedor.innerHTML = '<div class="alert alert-danger">Error al cargar tus reservas.</div>';
    }
  }

  document.addEventListener('click', async e => {
    const target = e.target.closest('button');
    if (!target) return;
    const id = target.dataset.id;
    if (!id) return;

    if (target.classList.contains('btn-reenviar')) {
      target.disabled = true;
      try {
        const res = await auth.authFetch('/api/me/reservas/' + id + '/resend-confirmation', { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        alert(data.mensaje || data.error || 'Correo reenviado.');
      } finally {
        target.disabled = false;
      }
    }

    if (target.classList.contains('btn-cancelar-pendiente')) {
      if (!confirm('¿Seguro querés cancelar esta reserva pendiente?')) return;
      const res = await auth.authFetch('/api/me/reservas/' + id + '/cancel', { method: 'PATCH' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return alert(data.error || 'No se pudo cancelar.');
      await cargarReservas();
    }

    if (target.classList.contains('btn-cancelar')) {
      if (!confirm('¿Seguro querés cancelar esta reserva?')) return;
      const res = await auth.authFetch('/api/me/turnos/' + id + '/cancel', { method: 'PATCH' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return alert(data.error || 'No se pudo cancelar.');
      await cargarReservas();
    }

    if (target.classList.contains('btn-pagar')) {
      target.disabled = true;
      try {
        const res = await auth.authFetch('/api/me/turnos/' + id + '/payment-link', { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.pagoUrl) {
          alert(data.error || 'No se pudo generar el link de pago.');
        } else {
          window.open(data.pagoUrl, '_blank');
        }
      } finally {
        target.disabled = false;
      }
    }
  });

  try {
    await cargarDatosUsuario();
    modoLectura();
    await cargarReservas();
  } catch (error) {
    console.error(error);
  }
});
