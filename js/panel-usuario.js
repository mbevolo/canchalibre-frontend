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

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let guardando = false;

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
    if (guardando) return;
    guardando = true;
    if (btnGuardar) btnGuardar.disabled = true;

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
      alert('No se pudieron guardar los datos. Intentá nuevamente.');
    } finally {
      guardando = false;
      if (btnGuardar) btnGuardar.disabled = false;
    }
  });

  async function cargarReservas() {
    const contenedor = document.getElementById('reservas-container');
    if (!contenedor) return;

    contenedor.setAttribute('aria-busy', 'true');
    contenedor.textContent = 'Cargando tus reservas…';
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
        // Court schedules are in Argentina, independently of browser timezone.
        return new Date(`${partes[0]}-${String(partes[1]).padStart(2, '0')}-${String(partes[2]).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-03:00`);
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

      const cardReserva = (r, pasada = false) => {
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

        if (pasada) {
          botones = '';
        } else if (pendiente) {
          botones =
            '<button class="btn btn-sm btn-outline-primary btn-reenviar" data-id="' + escapeHtml(r._id) + '">🔁 Reenviar correo</button>' +
            ' <button class="btn btn-sm btn-outline-danger btn-cancelar-pendiente" data-id="' + escapeHtml(r._id) + '">Cancelar</button>';
        } else {
          botones =
            '<button class="btn btn-sm btn-danger btn-cancelar" data-id="' + escapeHtml(r._id) + '">Cancelar</button>' +
            (!r.pagado
              ? ' <button class="btn btn-sm btn-success btn-pagar" data-id="' + escapeHtml(r._id) + '">Pagar online</button>'
              : '');
        }

        return '<div class="card mb-2 shadow-sm"><div class="card-body d-flex flex-wrap gap-3 justify-content-between align-items-center">' +
          '<div><div class="fw-bold">' + escapeHtml(r.nombreClub || 'Club') + '</div>' +
          '<div class="text-muted">Cancha: ' + escapeHtml(r.nombreCancha || '—') + '</div>' +
          '<div>📅 ' + escapeHtml(fecha) + ' — 🕒 ' + escapeHtml(r.hora) + '</div>' +
          '<div class="mt-1">' + estado + '</div></div>' +
          '<div class="d-flex flex-wrap gap-2">' + botones + '</div></div></div>';
      };

      const htmlFuturas = futuras.length
        ? futuras.map(r => cardReserva(r)).join('')
        : '<div class="alert alert-info">No tenés reservas futuras.</div>';

      const htmlPasadas = pasadas.length
        ? pasadas.map(r => cardReserva(r, true)).join('')
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
      contenedor.innerHTML = '<div class="alert alert-danger">No se pudieron cargar tus reservas. <button class="btn btn-sm btn-outline-danger" id="reintentar-reservas">Reintentar</button></div>';
      document.getElementById('reintentar-reservas').addEventListener('click', cargarReservas);
    } finally {
      contenedor.setAttribute('aria-busy', 'false');
    }
  }

  document.addEventListener('click', async e => {
    const target = e.target.closest('button');
    if (!target || target.disabled) return;
    const id = target.dataset.id;
    if (!id) return;
    const resend = target.classList.contains('btn-reenviar');
    const pending = target.classList.contains('btn-cancelar-pendiente');
    const cancel = target.classList.contains('btn-cancelar');
    const pay = target.classList.contains('btn-pagar');
    if (!resend && !pending && !cancel && !pay) return;
    if ((pending || cancel) && !confirm('¿Seguro querés cancelar esta reserva?')) return;
    const card = target.closest('.card');
    const buttons = [...card.querySelectorAll('button')];
    buttons.forEach(button => { button.disabled = true; });
    try {
      const resource = resend || pending ? 'reservas' : 'turnos';
      const action = resend ? 'resend-confirmation' : pay ? 'payment-link' : 'cancel';
      const res = await auth.authFetch(`/api/me/${resource}/${encodeURIComponent(id)}/${action}`, {
        method: resend || pay ? 'POST' : 'PATCH'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'No se pudo completar la operación. Intentá nuevamente.');
        return;
      }
      if (resend) {
        alert(data.mensaje || 'Correo reenviado.');
      } else if (pay) {
        let url;
        try { url = new URL(data.pagoUrl); } catch (_) { throw new Error('Link inválido'); }
        if (url.protocol !== 'https:') throw new Error('Link inválido');
        // A second explicit click works even when popups after async requests are blocked.
        card.querySelector('.enlace-pago')?.remove();
        const link = document.createElement('a');
        link.className = 'enlace-pago btn btn-sm btn-success d-block mt-2';
        link.href = url.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Abrir pago seguro';
        target.parentElement.appendChild(link);
        link.focus();
      } else {
        await cargarReservas();
      }
    } catch (_) {
      alert('No se pudo completar la operación. Intentá nuevamente.');
    } finally {
      buttons.forEach(button => { button.disabled = false; });
    }
  });

  try {
    await cargarDatosUsuario();
    modoLectura();
    await cargarReservas();
  } catch (error) {
    if (info) info.textContent = 'No se pudieron cargar tus datos. Recargá la página para reintentar.';
    await cargarReservas();
  }
});
