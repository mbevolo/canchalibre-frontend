function escapeAdminHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

document.addEventListener('DOMContentLoaded', () => {

  const menu = document.getElementById('menu-superadmin');
  const content = document.getElementById('superadmin-content');
  const token = localStorage.getItem('superadminToken');
  if (!token) {
    window.location.href = 'login-superadmin.html';
    return;
  }

  window.addEventListener('resize', () => {
    const selected = menu.querySelector('.active');
    if (selected && menu.scrollWidth > menu.clientWidth) menu.scrollLeft = selected.offsetLeft - menu.offsetLeft;
  });

  // Cambiar de sección
  menu.addEventListener('click', e => {
    const target = e.target.closest('.list-group-item');
    if (target) {
      menu.querySelectorAll('.list-group-item').forEach(btn => { btn.classList.remove('active'); btn.removeAttribute('aria-current'); });
      target.classList.add('active'); target.setAttribute('aria-current', 'page');
      if (menu.scrollWidth > menu.clientWidth) menu.scrollLeft = target.offsetLeft - menu.offsetLeft;
      cargarSeccion(target.dataset.section);
    }
  });

  let sectionGeneration = 0;
  // Función para mostrar contenido por sección
  function cargarSeccion(seccion) {
    sectionGeneration++;
    content.dataset.section = seccion;
    switch (seccion) {
      case 'dashboard':
        content.innerHTML = `
          <h2>Dashboard</h2>
          <p>Resumen general de CanchaLibre.</p>
        `;
        cargarResumen();
        break;
      case 'clubes':
        content.innerHTML = `<h2>Gestión de Clubes</h2><p>Cargando clubes...</p>`;
        cargarClubes();
        break;
      case 'usuarios':
        content.innerHTML = `<h2>Gestión de Usuarios</h2><p>Cargando usuarios...</p>`;
        cargarUsuarios();
        break;
      case 'reservas':
        content.innerHTML = `<h2>Gestión de Reservas</h2><p>Cargando reservas...</p>`;
        cargarReservas();
        break;
      case 'pagos':
        content.innerHTML = `<h2>Cobros y pagos</h2><p class="admin-description">Las reservas se cobran en la cuenta de cada club. Los destacados se cobran en tu cuenta de CanchaLibre.</p><p>Cargando pagos...</p>`;
        cargarPagos();
        break;
      case 'destacados':
        content.innerHTML = `<h2>Clubes Destacados</h2><p>Cargando clubes destacados...</p>`;
        cargarDestacados();
        break;
      case 'mercadopago':
        content.innerHTML = '<h2>MercadoPago</h2><p>Cargando tu cuenta de cobro…</p>';
        cargarMercadoPago();
        break;
      case 'config':
        content.innerHTML = `<h2>Precio de destacados</h2><p class="admin-description">Definí cuánto paga un club y por cuántos días aparece destacado en las búsquedas.</p><p>Cargando configuraciones...</p>`;
        cargarConfiguraciones();
        break;

      default:
        content.innerHTML = `<h2>Bienvenido</h2>`;
    }
  }

  // Cargar dashboard por defecto
  cargarSeccion('dashboard');

  // Acción para cerrar sesión
  document.getElementById('cerrar-sesion').addEventListener('click', () => {
    localStorage.removeItem('superadminToken');
    window.location.href = 'login-superadmin.html';
  });

  // --- FUNCIÓN PARA CARGAR CLUBES ---
async function cargarClubes() {
  const content = document.getElementById('superadmin-content');
  if (content.dataset.section !== 'clubes') return;
  const generation = sectionGeneration;
  const token = localStorage.getItem('superadminToken');
  try {
    const res = await fetch(window.CanchaLibreApiUrl('/superadmin/clubes'), {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (generation !== sectionGeneration) return;
    if (!data.ok) throw new Error(data.msg);

    if (data.clubes.length === 0) {
      content.innerHTML = `<h2>Gestión de Clubes</h2><p>No hay clubes cargados.</p>`;
      return;
    }

    let tabla = `
      <h2>Gestión de Clubes</h2>
      <table class="table table-striped">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Email</th>
            <th>Teléfono</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.clubes.forEach(club => {
      tabla += `
        <tr>
          <td><input type="text" value="${escapeAdminHtml(club.nombre || '')}" class="form-control club-nombre" data-id="${club._id}"></td>
          <td><input type="email" value="${escapeAdminHtml(club.email || '')}" class="form-control club-email" data-id="${club._id}"></td>
          <td><input type="text" value="${escapeAdminHtml(club.telefono || '')}" class="form-control club-telefono" data-id="${club._id}"></td>
          <td>
            <span class="badge ${club.activo !== false ? 'bg-success' : 'bg-secondary'}">${club.activo !== false ? "Activo" : "Suspendido"}</span>
          </td>
          <td>
            <button class="btn btn-sm btn-primary editar-club" data-id="${club._id}">Guardar</button>
            <button class="btn btn-sm btn-warning suspender-club" data-id="${club._id}">${club.activo !== false ? 'Suspender' : 'Activar'}</button>
            <button class="btn btn-sm btn-danger eliminar-club" data-id="${club._id}">Eliminar</button>
          </td>
        </tr>
      `;
    });

    tabla += `</tbody></table>`;
    content.innerHTML = tabla;
    mejorarTabla();

    // Acción GUARDAR (editar club)
    document.querySelectorAll('.editar-club').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const nombre = document.querySelector(`.club-nombre[data-id="${id}"]`).value;
        const email = document.querySelector(`.club-email[data-id="${id}"]`).value;
        const telefono = document.querySelector(`.club-telefono[data-id="${id}"]`).value;
        try {
          const res = await fetch(window.CanchaLibreApiUrl(`/superadmin/clubes/${id}`), {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ nombre, email, telefono })
          });
          const data = await res.json();
          if (data.ok) {
            alert('Club editado correctamente');
            cargarClubes();
          } else {
            alert('Error: ' + data.msg);
          }
        } catch (err) {
          alert('Error de red: ' + err.message);
        }
      });
    });

    // Acción SUSPENDER/ACTIVAR
    document.querySelectorAll('.suspender-club').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        try {
          const res = await fetch(window.CanchaLibreApiUrl(`/superadmin/clubes/${id}/suspender`), {
            method: 'PATCH',
            headers: { 'Authorization': 'Bearer ' + token }
          });
          const data = await res.json();
          if (data.ok) {
            alert('Club actualizado');
            cargarClubes();
          } else {
            alert('Error: ' + data.msg);
          }
        } catch (err) {
          alert('Error de red: ' + err.message);
        }
      });
    });

    // Acción ELIMINAR
    document.querySelectorAll('.eliminar-club').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Seguro que querés eliminar este club? Esta acción no se puede deshacer.')) return;
        const id = btn.getAttribute('data-id');
        try {
          const res = await fetch(window.CanchaLibreApiUrl(`/superadmin/clubes/${id}`), {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
          });
          const data = await res.json();
          if (data.ok) {
            alert('Club eliminado');
            cargarClubes();
          } else {
            alert('Error: ' + data.msg);
          }
        } catch (err) {
          alert('Error de red: ' + err.message);
        }
      });
    });

  } catch (error) {
    if (generation !== sectionGeneration) return;
    content.innerHTML = `<h2>Gestión de Clubes</h2><div class="alert alert-danger">Error: ${escapeAdminHtml(error.message)}</div>`;
  }
}


  // --- FUNCIÓN PARA CARGAR USUARIOS ---
  async function cargarUsuarios() {
  const content = document.getElementById('superadmin-content');
  if (content.dataset.section !== 'usuarios') return;
  const generation = sectionGeneration;
  const token = localStorage.getItem('superadminToken');
  try {
    const res = await fetch(window.CanchaLibreApiUrl('/superadmin/usuarios'), {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (generation !== sectionGeneration) return;
    if (!data.ok) throw new Error(data.msg);

    if (data.usuarios.length === 0) {
      content.innerHTML = `<h2>Gestión de Usuarios</h2><p>No hay usuarios registrados.</p>`;
      return;
    }

    let tabla = `
      <h2>Gestión de Usuarios</h2>
      <table class="table table-striped">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Apellido</th>
            <th>Email</th>
            <th>Teléfono</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.usuarios.forEach(usuario => {
      tabla += `
        <tr>
          <td><input type="text" value="${escapeAdminHtml(usuario.nombre || '')}" class="form-control usuario-nombre" data-id="${usuario._id}"></td>
          <td><input type="text" value="${escapeAdminHtml(usuario.apellido || '')}" class="form-control usuario-apellido" data-id="${usuario._id}"></td>
          <td><input type="email" value="${escapeAdminHtml(usuario.email || '')}" class="form-control usuario-email" data-id="${usuario._id}"></td>
          <td><input type="text" value="${escapeAdminHtml(usuario.telefono || '')}" class="form-control usuario-telefono" data-id="${usuario._id}"></td>
          <td>
            <span class="badge ${usuario.activo !== false ? 'bg-success' : 'bg-secondary'}">${usuario.activo !== false ? "Activo" : "Suspendido"}</span>
          </td>
          <td>
            <button class="btn btn-sm btn-primary editar-usuario" data-id="${usuario._id}">Guardar</button>
            <button class="btn btn-sm btn-warning suspender-usuario" data-id="${usuario._id}">${usuario.activo !== false ? 'Suspender' : 'Activar'}</button>
            <button class="btn btn-sm btn-danger eliminar-usuario" data-id="${usuario._id}">Eliminar</button>
          </td>
        </tr>
      `;
    });

    tabla += `</tbody></table>`;
    content.innerHTML = tabla;
    mejorarTabla();

    // Acción GUARDAR (editar usuario)
    document.querySelectorAll('.editar-usuario').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const nombre = document.querySelector(`.usuario-nombre[data-id="${id}"]`).value;
        const apellido = document.querySelector(`.usuario-apellido[data-id="${id}"]`).value;
        const email = document.querySelector(`.usuario-email[data-id="${id}"]`).value;
        const telefono = document.querySelector(`.usuario-telefono[data-id="${id}"]`).value;
        try {
          const res = await fetch(window.CanchaLibreApiUrl(`/superadmin/usuarios/${id}`), {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ nombre, apellido, email, telefono })
          });
          const data = await res.json();
          if (data.ok) {
            alert('Usuario editado correctamente');
            cargarUsuarios();
          } else {
            alert('Error: ' + data.msg);
          }
        } catch (err) {
          alert('Error de red: ' + err.message);
        }
      });
    });

    // Acción SUSPENDER/ACTIVAR
    document.querySelectorAll('.suspender-usuario').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        try {
          const res = await fetch(window.CanchaLibreApiUrl(`/superadmin/usuarios/${id}/suspender`), {
            method: 'PATCH',
            headers: { 'Authorization': 'Bearer ' + token }
          });
          const data = await res.json();
          if (data.ok) {
            alert('Usuario actualizado');
            cargarUsuarios();
          } else {
            alert('Error: ' + data.msg);
          }
        } catch (err) {
          alert('Error de red: ' + err.message);
        }
      });
    });

    // Acción ELIMINAR
    document.querySelectorAll('.eliminar-usuario').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Seguro que querés eliminar este usuario? Esta acción no se puede deshacer.')) return;
        const id = btn.getAttribute('data-id');
        try {
          const res = await fetch(window.CanchaLibreApiUrl(`/superadmin/usuarios/${id}`), {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
          });
          const data = await res.json();
          if (data.ok) {
            alert('Usuario eliminado');
            cargarUsuarios();
          } else {
            alert('Error: ' + data.msg);
          }
        } catch (err) {
          alert('Error de red: ' + err.message);
        }
      });
    });

  } catch (error) {
    if (generation !== sectionGeneration) return;
    content.innerHTML = `<h2>Gestión de Usuarios</h2><div class="alert alert-danger">Error: ${escapeAdminHtml(error.message)}</div>`;
  }
}

  async function cargarReservas() {
  const content = document.getElementById('superadmin-content');
  if (content.dataset.section !== 'reservas') return;
  const generation = sectionGeneration;
  const token = localStorage.getItem('superadminToken');
  try {
    const res = await fetch(window.CanchaLibreApiUrl('/superadmin/reservas'), {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (generation !== sectionGeneration) return;
    if (!data.ok) throw new Error(data.msg);

    if (data.reservas.length === 0) {
      content.innerHTML = `<h2>Gestión de Reservas</h2><p>No hay reservas registradas.</p>`;
      return;
    }

    let tabla = `
      <h2>Gestión de Reservas</h2>
      <table class="table table-striped">
        <thead>
          <tr>
            <th>Deporte</th>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Club</th>
            <th>Usuario</th>
            <th>Email</th>
            <th>Teléfono</th>
            <th>Pagado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.reservas.forEach(r => {
      tabla += `
        <tr>
          <td><input type="text" value="${escapeAdminHtml(r.deporte || '')}" class="form-control reserva-deporte" data-id="${r._id}"></td>
          <td><input type="text" value="${escapeAdminHtml(r.fecha || '')}" class="form-control reserva-fecha" data-id="${r._id}"></td>
          <td><input type="text" value="${escapeAdminHtml(r.hora || '')}" class="form-control reserva-hora" data-id="${r._id}"></td>
          <td><input type="text" value="${escapeAdminHtml(r.club || '')}" class="form-control reserva-club" data-id="${r._id}"></td>
          <td><input type="text" value="${escapeAdminHtml(r.usuarioReservado || '')}" class="form-control reserva-usuario" data-id="${r._id}"></td>
          <td><input type="text" value="${escapeAdminHtml(r.emailReservado || '')}" class="form-control reserva-email" data-id="${r._id}"></td>
          <td><input type="text" value="" class="form-control reserva-telefono" data-id="${r._id}"></td>
          <td>
            <span class="badge ${r.pagado ? 'bg-success' : 'bg-secondary'}">${r.pagado ? 'Sí' : 'No'}</span>
          </td>
           <td>
           <button class="btn btn-sm btn-primary editar-reserva" data-id="${r._id}">Guardar</button>
           ${!r.pagado ? `<button class="btn btn-sm btn-success marcar-pagado" data-id="${r._id}">Marcar pagado</button>` : ''}
           <button class="btn btn-sm btn-danger cancelar-reserva" data-id="${r._id}">Cancelar</button>
           </td>

        </tr>
      `;
    });

    tabla += `</tbody></table>`;
    content.innerHTML = tabla;
    mejorarTabla();

    // Acción GUARDAR (editar reserva)
    document.querySelectorAll('.editar-reserva').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const deporte = document.querySelector(`.reserva-deporte[data-id="${id}"]`).value;
        const fecha = document.querySelector(`.reserva-fecha[data-id="${id}"]`).value;
        const hora = document.querySelector(`.reserva-hora[data-id="${id}"]`).value;
        const club = document.querySelector(`.reserva-club[data-id="${id}"]`).value;
        const usuarioReservado = document.querySelector(`.reserva-usuario[data-id="${id}"]`).value;
        const emailReservado = document.querySelector(`.reserva-email[data-id="${id}"]`).value;
        try {
          const res = await fetch(window.CanchaLibreApiUrl(`/superadmin/reservas/${id}`), {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ deporte, fecha, hora, club, usuarioReservado, emailReservado })
          });
          const data = await res.json();
          if (data.ok) {
            alert('Reserva editada correctamente');
            cargarReservas();
          } else {
            alert('Error: ' + data.msg);
          }
        } catch (err) {
          alert('Error de red: ' + err.message);
        }
      });
    });

    // Acción MARCAR COMO PAGADO
    document.querySelectorAll('.marcar-pagado').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        try {
          const res = await fetch(window.CanchaLibreApiUrl(`/superadmin/reservas/${id}/pagado`), {
            method: 'PATCH',
            headers: { 'Authorization': 'Bearer ' + token }
          });
          const data = await res.json();
          if (data.ok) {
            alert('Reserva marcada como pagada');
            cargarReservas();
          } else {
            alert('Error: ' + data.msg);
          }
        } catch (err) {
          alert('Error de red: ' + err.message);
        }
      });
    });

    // Acción CANCELAR
    document.querySelectorAll('.cancelar-reserva').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Seguro que querés cancelar esta reserva?')) return;
        const id = btn.getAttribute('data-id');
        try {
          const res = await fetch(window.CanchaLibreApiUrl(`/superadmin/reservas/${id}/cancelar`), {
            method: 'PATCH',
            headers: { 'Authorization': 'Bearer ' + token }
          });
          const data = await res.json();
          if (data.ok) {
            alert('Reserva cancelada');
            cargarReservas();
          } else {
            alert('Error: ' + data.msg);
          }
        } catch (err) {
          alert('Error de red: ' + err.message);
        }
      });
    });

  } catch (error) {
    if (generation !== sectionGeneration) return;
    content.innerHTML = `<h2>Gestión de Reservas</h2><div class="alert alert-danger">Error: ${escapeAdminHtml(error.message)}</div>`;
  }
}

async function cargarPagos() {
  const content = document.getElementById('superadmin-content');
  if (content.dataset.section !== 'pagos') return;
  const generation = sectionGeneration;
  const token = localStorage.getItem('superadminToken');
  try {
    const res = await fetch(window.CanchaLibreApiUrl('/superadmin/pagos'), {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (generation !== sectionGeneration) return;
    if (!data.ok) throw new Error(data.msg);

    const featuredPayments = data.cobrosDestacados || [];
    if (data.pagos.length === 0 && featuredPayments.length === 0) {
      content.innerHTML = `<h2>Cobros y pagos</h2><p class="admin-description">Las reservas se cobran en la cuenta de cada club. Los destacados se cobran en tu cuenta de CanchaLibre.</p><p>No hay pagos registrados.</p>`;
      return;
    }

    let tabla = `
      <h2>Cobros y pagos</h2><p class="admin-description">Las reservas se cobran en la cuenta de cada club. Los destacados se cobran en tu cuenta de CanchaLibre.</p>
      <table class="table table-striped">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Club</th>
            <th>Deporte</th>
            <th>Usuario</th>
            <th>Email</th>
            <th>Monto</th>
          </tr>
        </thead>
        <tbody>
    `;

    tabla = '<h2>Cobros y pagos</h2><p class="admin-description">Los destacados son ingresos de CanchaLibre. Las reservas pagadas pertenecen a cada club.</p>' + renderCobrosDestacados(featuredPayments) + '<h3 class="admin-subheading">Reservas pagadas de los clubes</h3>' + tabla.slice(tabla.indexOf('<table'));
    data.pagos.forEach(pago => {
      tabla += `
        <tr>
          <td>${escapeAdminHtml(pago.fecha || '')}</td>
          <td>${escapeAdminHtml(pago.hora || '')}</td>
          <td>${escapeAdminHtml(pago.club || '')}</td>
          <td>${escapeAdminHtml(pago.deporte || '')}</td>
          <td>${escapeAdminHtml(pago.usuarioReservado || '')}</td>
          <td>${escapeAdminHtml(pago.emailReservado || '')}</td>
          <td>${pago.precio ? '$' + pago.precio : ''}</td>
        </tr>
      `;
    });

    tabla += `</tbody></table>`;
    content.innerHTML = tabla;
    mejorarTabla();

  } catch (error) {
    if (generation !== sectionGeneration) return;
    content.innerHTML = `<h2>Cobros y pagos</h2><p class="admin-description">Las reservas se cobran en la cuenta de cada club. Los destacados se cobran en tu cuenta de CanchaLibre.</p><div class="alert alert-danger">Error: ${escapeAdminHtml(error.message)}</div>`;
  }
}

async function cargarDestacados() {
  const content = document.getElementById('superadmin-content');
  if (content.dataset.section !== 'destacados') return;
  const generation = sectionGeneration;
  const token = localStorage.getItem('superadminToken');
  try {
    const res = await fetch(window.CanchaLibreApiUrl('/superadmin/destacados'), {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (generation !== sectionGeneration) return;
    if (!data.ok) throw new Error(data.msg);

    if (data.destacados.length === 0) {
      content.innerHTML = `<h2>Clubes Destacados</h2><p>No hay clubes destacados en este momento.</p>`;
      return;
    }

    let tabla = `
      <h2>Clubes Destacados</h2>
      <table class="table table-striped">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Email</th>
            <th>Destacado Hasta</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.destacados.forEach(club => {
      tabla += `
        <tr>
          <td>${escapeAdminHtml(club.nombre)}</td>
          <td>${escapeAdminHtml(club.email)}</td>
          <td>${club.destacadoHasta ? (new Date(club.destacadoHasta)).toLocaleDateString('es-AR') : ''}</td>
          <td><button class="btn btn-sm btn-warning quitar-destacado" data-email="${escapeAdminHtml(club.email)}">Quitar destacado</button></td>
        </tr>
      `;
    });

    tabla += `</tbody></table>`;
    content.innerHTML = tabla;
    mejorarTabla();

    // Agregamos evento al botón
    document.querySelectorAll('.quitar-destacado').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Seguro que querés quitar el destacado a este club?')) return;
        const email = btn.getAttribute('data-email');
        try {
          const res = await fetch(window.CanchaLibreApiUrl('/superadmin/quitar-destacado'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ email })
          });
          const data = await res.json();
          if (data.ok) {
            alert('Club actualizado');
            cargarDestacados();
          } else {
            alert('Error: ' + data.msg);
          }
        } catch (err) {
          alert('Error de red: ' + err.message);
        }
      });
    });

  } catch (error) {
    if (generation !== sectionGeneration) return;
    content.innerHTML = `<h2>Clubes Destacados</h2><div class="alert alert-danger">Error: ${escapeAdminHtml(error.message)}</div>`;
  }
}
async function cargarConfiguraciones() {
  const content = document.getElementById('superadmin-content');
  if (content.dataset.section !== 'config') return;
  const generation = sectionGeneration;
  const token = localStorage.getItem('superadminToken');
  try {
    const res = await fetch(window.CanchaLibreApiUrl('/superadmin/configuraciones'), {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (generation !== sectionGeneration) return;
    if (!data.ok) throw new Error(data.msg);

    const { precioDestacado, diasDestacado } = data.config;

    content.innerHTML = `
      <h2>Precio de destacados</h2><p class="admin-description">Definí cuánto paga un club y por cuántos días aparece destacado en las búsquedas.</p>
      <form id="form-config" class="admin-settings-card">
        <div class="mb-2">
          <label for="precioDestacado">Precio por destacado (ARS)</label>
          <input type="number" class="form-control" id="precioDestacado" value="${precioDestacado}" min="0.01" step="0.01" required>
        </div>
        <div class="mb-2">
          <label for="diasDestacado">Duración en días</label>
          <input type="number" class="form-control" id="diasDestacado" value="${diasDestacado}" min="1" max="365" step="1" required>
        </div>
        <button type="submit" class="btn btn-primary mt-2">Guardar cambios</button>
        <div id="config-alerta" class="mt-2"></div>
      </form>
    `;

    document.getElementById('form-config').addEventListener('submit', async (e) => {
      e.preventDefault();
      const button = e.currentTarget.querySelector('button[type=submit]');
      if (button.disabled) return;
      button.disabled = true;
      const precio = document.getElementById('precioDestacado').value;
      const dias = document.getElementById('diasDestacado').value;
      const alerta = document.getElementById('config-alerta');

      try {
        const res = await fetch(window.CanchaLibreApiUrl('/superadmin/configuraciones'), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ precioDestacado: Number(precio), diasDestacado: Number(dias) })
        });
        const data = await res.json();
        if (data.ok) {
          alerta.innerHTML = `<div class="alert alert-success">¡Configuración actualizada!</div>`;
        } else {
          alerta.innerHTML = `<div class="alert alert-danger">${escapeAdminHtml(data.msg)}</div>`;
        }
      } catch (err) {
        alerta.innerHTML = '<div class="alert alert-danger">No se pudo guardar. Intentá nuevamente.</div>';
      } finally { button.disabled = false; }
    });

  } catch (error) {
    if (generation !== sectionGeneration) return;
    content.innerHTML = `<h2>Precio de destacados</h2><p class="admin-description">Definí cuánto paga un club y por cuántos días aparece destacado en las búsquedas.</p><div class="alert alert-danger">Error: ${escapeAdminHtml(error.message)}</div>`;
  }
}



function money(value) { return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value) || 0); }
function mejorarTabla() {
  content.querySelectorAll('table').forEach((table, index) => {
    const headings = [...table.querySelectorAll('thead th')].map(th => th.textContent);
    const rows = [...table.querySelectorAll('tbody tr')];
    rows.forEach(row => [...row.cells].forEach((cell, column) => { cell.dataset.label = headings[column] || ''; cell.querySelectorAll('input').forEach(input => input.setAttribute('aria-label', headings[column] || 'Dato')); }));
    const wrapper = document.createElement('div'); wrapper.className = 'admin-table-scroll'; table.before(wrapper); wrapper.append(table);
    const tools = document.createElement('div'); tools.className = 'admin-table-tools';
    tools.innerHTML = `<label for="admin-search-${index}" class="visually-hidden">Buscar en ${escapeAdminHtml(content.dataset.section)}</label><input type="search" id="admin-search-${index}" placeholder="Buscar por nombre, correo o fecha…"><span class="admin-table-count" aria-live="polite"></span>`;
    wrapper.before(tools);
    const count = tools.querySelector('.admin-table-count');
    const update = () => { const query = tools.querySelector('input').value.trim().toLocaleLowerCase('es'); let visible = 0;
      rows.forEach(row => { const values = [...row.querySelectorAll('input')].map(input => input.value).join(' '); row.hidden = !(row.textContent + ' ' + values).toLocaleLowerCase('es').includes(query); if (!row.hidden) visible++; });
      count.textContent = `${visible} de ${rows.length} registros`;
    }; tools.querySelector('input').addEventListener('input', update); update();
  });
}
async function adminGet(path) {
  const response = await fetch(window.CanchaLibreApiUrl(path), { headers: { Authorization: 'Bearer ' + token } });
  if (response.status === 401 || response.status === 403) { localStorage.removeItem('superadminToken'); location.href = 'login-superadmin.html'; throw new Error('Tu sesión venció. Volvé a ingresar.'); }
  const data = await response.json(); if (!data.ok) throw new Error(data.msg || 'No se pudo cargar la información'); return data;
}
async function cargarResumen() {
  const generation = sectionGeneration;
  content.innerHTML = '<h2>Dashboard · Resumen</h2><p class="admin-description">El estado de tu plataforma, en un solo lugar.</p><p>Cargando resumen…</p>';
  try {
    const data = await adminGet('/superadmin/resumen'); if (generation !== sectionGeneration) return;
    const r = data.resumen;
    content.innerHTML = `<h2>Resumen de CanchaLibre</h2><p class="admin-description">El estado de tu plataforma, en un solo lugar.</p>
      <div class="admin-stats">${[['Clubes',r.clubes],['Usuarios',r.usuarios],['Reservas',r.reservas],['Destacados vigentes',r.destacados]].map(([label,value])=>`<div class="admin-stat"><span>${label}</span><strong>${Number(value)||0}</strong></div>`).join('')}</div>
      <div class="admin-revenue"><div><h3>INGRESOS POR DESTACADOS</h3><strong>${money(r.ingresosDestacados)}</strong><p>${Number(r.destacadosPagados)||0} pagos aprobados · total acumulado bruto</p></div><button class="btn" data-go="pagos">Ver cobros</button></div>
      <h3 class="admin-subheading">Accesos rápidos</h3><div class="admin-shortcuts"><button data-go="clubes">Gestionar clubes</button><button data-go="reservas">Ver reservas</button><button data-go="config">Precio de destacados</button><button data-go="mercadopago">Cuenta de MercadoPago</button></div>`;
    content.querySelectorAll('[data-go]').forEach(button=>button.addEventListener('click',()=>menu.querySelector(`[data-section="${button.dataset.go}"]`).click()));
  } catch (error) { if (generation === sectionGeneration) content.innerHTML = `<h2>Dashboard · Resumen</h2><div class="alert alert-danger">${escapeAdminHtml(error.message)}</div><button class="btn btn-secondary" id="retry-summary">Reintentar</button>`; content.querySelector('#retry-summary')?.addEventListener('click',cargarResumen); }
}
function renderCobrosDestacados(orders) {
  const total = orders.reduce((sum, order) => sum + (Number(order.precio)||0), 0);
  return `<div class="admin-revenue"><div><h3>DESTACADOS · INGRESOS DE CANCHALIBRE</h3><strong>${money(total)}</strong><p>${orders.length} pagos aprobados · importes brutos antes de comisiones</p></div></div><h3 class="admin-subheading">Cobros por destacados</h3>` + (orders.length ? `<table class="table"><thead><tr><th>Club</th><th>Fecha de solicitud</th><th>Duración</th><th>Importe</th><th>Pago MercadoPago</th></tr></thead><tbody>${orders.map(order=>`<tr><td>${escapeAdminHtml(order.clubId?.nombre||'Club eliminado')}<br><small>${escapeAdminHtml(order.clubId?.email||'')}</small></td><td>${escapeAdminHtml(new Date(order.createdAt).toLocaleDateString('es-AR'))}</td><td>${Number(order.dias)||0} días</td><td>${money(order.precio)}</td><td>${escapeAdminHtml(order.paymentId)}</td></tr>`).join('')}</tbody></table>`:'<p class="admin-empty">Todavía no hay cobros por destacados.</p>');
}
async function cargarMercadoPago() {
  const generation = sectionGeneration;
  try {
    const data = await adminGet('/superadmin/mercadopago'); if (generation !== sectionGeneration) return;
    const mp = data.mercadopago;
    const account = mp.account;
    content.innerHTML = `<h2>Tu cuenta de MercadoPago</h2><p class="admin-description">Los clubes pagan los destacados a esta cuenta de CanchaLibre.</p>
      <div class="admin-account"><h3>${account ? 'Cuenta verificada' : mp.configured ? 'Credencial configurada en el servidor' : 'Conectá tu cuenta de cobro'}</h3>
      ${account ? `<p><strong>${escapeAdminHtml(account.name)}</strong> · ${escapeAdminHtml(account.email)}</p><p>Cuenta ${escapeAdminHtml(account.id)}${account.test?' · Cuenta de prueba':''}</p>` : '<p>Ingresá tu Access Token para verificar a quién se acreditarán los destacados.</p>'}
      <p>Notificaciones de pago: <strong>${mp.webhookConfigured?'clave configurada':'falta configurar la clave'}</strong></p></div>
      <div class="admin-mp-grid"><form id="form-mp" class="admin-settings-card" autocomplete="off">
        <div class="mb-3"><label for="mp-access-token">Access Token de tu cuenta</label><input type="password" id="mp-access-token" class="form-control" autocomplete="new-password" maxlength="500" placeholder="APP_USR-… o TEST-…"><small class="text-muted">Dejalo vacío para conservar el actual. No vuelve a mostrarse después de guardar.</small></div>
        <div class="mb-3"><label for="mp-webhook-secret">Clave secreta de notificaciones (Webhooks)</label><input type="password" id="mp-webhook-secret" class="form-control" autocomplete="new-password" maxlength="256" placeholder="Clave de tu aplicación de MercadoPago"><small class="text-muted">Dejala vacía para conservar la actual.</small></div>
        <button type="submit" class="btn btn-primary">Verificar y guardar</button><p id="mp-feedback" role="status" class="mt-3"></p>
      </form><div class="admin-mp-help"><h3>Cómo conectar tu cuenta</h3><ol><li>Entrá a <a href="https://www.mercadopago.com.ar/developers/panel/app" target="_blank" rel="noopener">Tus integraciones de MercadoPago</a> con la cuenta donde querés recibir los cobros.</li><li>Elegí tu aplicación y copiá el <strong>Access Token</strong> de sus credenciales. Para pruebas, usá una cuenta y credenciales de prueba.</li><li>En <strong>Webhooks</strong>, configurá esta URL para pagos y copiá la clave secreta generada:</li></ol><code class="admin-webhook-url">${escapeAdminHtml(mp.webhookUrl)}</code><p>Guardá ambos datos acá. La contraseña de MercadoPago y el CBU no se cargan en CanchaLibre.</p></div></div>`;
    document.getElementById('form-mp').addEventListener('submit', async event => {
      event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button[type=submit]'); if (button.disabled) return;
      const body = {}; const accessToken = document.getElementById('mp-access-token').value.trim(); const webhookSecret = document.getElementById('mp-webhook-secret').value.trim();
      if (accessToken) body.accessToken = accessToken; if (webhookSecret) body.webhookSecret = webhookSecret;
      const feedback = document.getElementById('mp-feedback'); if (!Object.keys(body).length) { feedback.textContent = 'Ingresá una credencial nueva para guardar.'; return; }
      button.disabled = true; feedback.textContent = 'Verificando y guardando…';
      try {
        const response = await fetch(window.CanchaLibreApiUrl('/superadmin/mercadopago'), { method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body) });
        const result = await response.json(); if (!response.ok || !result.ok) throw new Error(result.msg || 'No se pudo guardar la cuenta');
        if (generation !== sectionGeneration) return;
        await cargarMercadoPago(); const message = document.getElementById('mp-feedback'); if (message) { message.className='mt-3 text-success'; message.textContent='Configuración guardada. '+(result.mercadopago.webhookConfigured?'Revisá también la URL de Webhooks en MercadoPago.':'Falta configurar la clave de Webhooks para confirmar los pagos.'); }
      } catch(error) { feedback.className='mt-3 text-danger'; feedback.textContent=error.message; }
      finally { form.querySelectorAll('input[type=password]').forEach(input=>input.value='');button.disabled=false; }
    });
  } catch(error) { if(generation===sectionGeneration) content.innerHTML=`<h2>MercadoPago</h2><div class="alert alert-danger">${escapeAdminHtml(error.message)}</div>`; }
}

});
