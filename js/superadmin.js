document.addEventListener('DOMContentLoaded', () => {

  const menu = document.getElementById('menu-superadmin');
  const content = document.getElementById('superadmin-content');
  const token = localStorage.getItem('superadminToken');
  if (!token) {
    window.location.href = 'login-superadmin.html';
    return;
  }

  // Cambiar de sección
  menu.addEventListener('click', e => {
    if (e.target.classList.contains('list-group-item')) {
      menu.querySelectorAll('.list-group-item').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      cargarSeccion(e.target.dataset.section);
    }
  });

  // Función para mostrar contenido por sección
  function cargarSeccion(seccion) {
    switch (seccion) {
      case 'dashboard':
        content.innerHTML = `
          <h2>Dashboard</h2>
          <p>Resumen general de CanchaLibre.</p>
        `;
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
        content.innerHTML = `<h2>Pagos y Finanzas</h2><p>Cargando pagos...</p>`;
        cargarPagos();
        break;
      case 'destacados':
        content.innerHTML = `<h2>Clubes Destacados</h2><p>Cargando clubes destacados...</p>`;
        cargarDestacados();
        break;
      case 'config':
        content.innerHTML = `<h2>Configuraciones Globales</h2><p>Cargando configuraciones...</p>`;
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
  const token = localStorage.getItem('superadminToken');
  try {
    const res = await fetch('https://turnolibre-backend.onrender.com/superadmin/clubes', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
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
          <td><input type="text" value="${club.nombre || ''}" class="form-control club-nombre" data-id="${club._id}"></td>
          <td><input type="email" value="${club.email || ''}" class="form-control club-email" data-id="${club._id}"></td>
          <td><input type="text" value="${club.telefono || ''}" class="form-control club-telefono" data-id="${club._id}"></td>
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

    // Acción GUARDAR (editar club)
    document.querySelectorAll('.editar-club').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const nombre = document.querySelector(`.club-nombre[data-id="${id}"]`).value;
        const email = document.querySelector(`.club-email[data-id="${id}"]`).value;
        const telefono = document.querySelector(`.club-telefono[data-id="${id}"]`).value;
        try {
          const res = await fetch(`https://turnolibre-backend.onrender.com/superadmin/clubes/${id}`, {
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
          const res = await fetch(`https://turnolibre-backend.onrender.com/superadmin/clubes/${id}/suspender`, {
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
          const res = await fetch(`https://turnolibre-backend.onrender.com/superadmin/clubes/${id}`, {
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
    content.innerHTML = `<h2>Gestión de Clubes</h2><div class="alert alert-danger">Error: ${error.message}</div>`;
  }
}


  // --- FUNCIÓN PARA CARGAR USUARIOS ---
  async function cargarUsuarios() {
  const content = document.getElementById('superadmin-content');
  const token = localStorage.getItem('superadminToken');
  try {
    const res = await fetch('https://turnolibre-backend.onrender.com/superadmin/usuarios', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
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
          <td><input type="text" value="${usuario.nombre || ''}" class="form-control usuario-nombre" data-id="${usuario._id}"></td>
          <td><input type="text" value="${usuario.apellido || ''}" class="form-control usuario-apellido" data-id="${usuario._id}"></td>
          <td><input type="email" value="${usuario.email || ''}" class="form-control usuario-email" data-id="${usuario._id}"></td>
          <td><input type="text" value="${usuario.telefono || ''}" class="form-control usuario-telefono" data-id="${usuario._id}"></td>
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

    // Acción GUARDAR (editar usuario)
    document.querySelectorAll('.editar-usuario').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const nombre = document.querySelector(`.usuario-nombre[data-id="${id}"]`).value;
        const apellido = document.querySelector(`.usuario-apellido[data-id="${id}"]`).value;
        const email = document.querySelector(`.usuario-email[data-id="${id}"]`).value;
        const telefono = document.querySelector(`.usuario-telefono[data-id="${id}"]`).value;
        try {
          const res = await fetch(`https://turnolibre-backend.onrender.com/superadmin/usuarios/${id}`, {
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
          const res = await fetch(`https://turnolibre-backend.onrender.com/superadmin/usuarios/${id}/suspender`, {
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
          const res = await fetch(`https://turnolibre-backend.onrender.com/superadmin/usuarios/${id}`, {
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
    content.innerHTML = `<h2>Gestión de Usuarios</h2><div class="alert alert-danger">Error: ${error.message}</div>`;
  }
}

  async function cargarReservas() {
  const content = document.getElementById('superadmin-content');
  const token = localStorage.getItem('superadminToken');
  try {
    const res = await fetch('https://turnolibre-backend.onrender.com/superadmin/reservas', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
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
          <td><input type="text" value="${r.deporte || ''}" class="form-control reserva-deporte" data-id="${r._id}"></td>
          <td><input type="text" value="${r.fecha || ''}" class="form-control reserva-fecha" data-id="${r._id}"></td>
          <td><input type="text" value="${r.hora || ''}" class="form-control reserva-hora" data-id="${r._id}"></td>
          <td><input type="text" value="${r.club || ''}" class="form-control reserva-club" data-id="${r._id}"></td>
          <td><input type="text" value="${r.usuarioReservado || ''}" class="form-control reserva-usuario" data-id="${r._id}"></td>
          <td><input type="text" value="${r.emailReservado || ''}" class="form-control reserva-email" data-id="${r._id}"></td>
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
          const res = await fetch(`https://turnolibre-backend.onrender.com/superadmin/reservas/${id}`, {
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
          const res = await fetch(`https://turnolibre-backend.onrender.com/superadmin/reservas/${id}/pagado`, {
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
          const res = await fetch(`https://turnolibre-backend.onrender.com/superadmin/reservas/${id}/cancelar`, {
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
    content.innerHTML = `<h2>Gestión de Reservas</h2><div class="alert alert-danger">Error: ${error.message}</div>`;
  }
}

async function cargarPagos() {
  const content = document.getElementById('superadmin-content');
  const token = localStorage.getItem('superadminToken');
  try {
    const res = await fetch('https://turnolibre-backend.onrender.com/superadmin/pagos', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.msg);

    if (data.pagos.length === 0) {
      content.innerHTML = `<h2>Pagos y Finanzas</h2><p>No hay pagos registrados.</p>`;
      return;
    }

    let tabla = `
      <h2>Pagos y Finanzas</h2>
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

    data.pagos.forEach(pago => {
      tabla += `
        <tr>
          <td>${pago.fecha || ''}</td>
          <td>${pago.hora || ''}</td>
          <td>${pago.club || ''}</td>
          <td>${pago.deporte || ''}</td>
          <td>${pago.usuarioReservado || ''}</td>
          <td>${pago.emailReservado || ''}</td>
          <td>${pago.precio ? '$' + pago.precio : ''}</td>
        </tr>
      `;
    });

    tabla += `</tbody></table>`;
    content.innerHTML = tabla;

  } catch (error) {
    content.innerHTML = `<h2>Pagos y Finanzas</h2><div class="alert alert-danger">Error: ${error.message}</div>`;
  }
}

async function cargarDestacados() {
  const content = document.getElementById('superadmin-content');
  const token = localStorage.getItem('superadminToken');
  try {
    const res = await fetch('https://turnolibre-backend.onrender.com/superadmin/destacados', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
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
          <td>${club.nombre}</td>
          <td>${club.email}</td>
          <td>${club.destacadoHasta ? (new Date(club.destacadoHasta)).toLocaleDateString('es-AR') : ''}</td>
          <td><button class="btn btn-sm btn-warning quitar-destacado" data-email="${club.email}">Quitar destacado</button></td>
        </tr>
      `;
    });

    tabla += `</tbody></table>`;
    content.innerHTML = tabla;

    // Agregamos evento al botón
    document.querySelectorAll('.quitar-destacado').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Seguro que querés quitar el destacado a este club?')) return;
        const email = btn.getAttribute('data-email');
        try {
          const res = await fetch('https://turnolibre-backend.onrender.com/superadmin/quitar-destacado', {
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
    content.innerHTML = `<h2>Clubes Destacados</h2><div class="alert alert-danger">Error: ${error.message}</div>`;
  }
}
async function cargarConfiguraciones() {
  const content = document.getElementById('superadmin-content');
  const token = localStorage.getItem('superadminToken');
  try {
    const res = await fetch('https://turnolibre-backend.onrender.com/superadmin/configuraciones', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.msg);

    const { precioDestacado, diasDestacado } = data.config;

    content.innerHTML = `
      <h2>Configuraciones Globales</h2>
      <form id="form-config" class="mb-3">
        <div class="mb-2">
          <label>Precio para destacar club ($):</label>
          <input type="number" class="form-control" id="precioDestacado" value="${precioDestacado}" min="0">
        </div>
        <div class="mb-2">
          <label>Días de duración del destacado:</label>
          <input type="number" class="form-control" id="diasDestacado" value="${diasDestacado}" min="1">
        </div>
        <button type="submit" class="btn btn-primary mt-2">Guardar cambios</button>
        <div id="config-alerta" class="mt-2"></div>
      </form>
    `;

    document.getElementById('form-config').addEventListener('submit', async (e) => {
      e.preventDefault();
      const precio = document.getElementById('precioDestacado').value;
      const dias = document.getElementById('diasDestacado').value;
      const alerta = document.getElementById('config-alerta');

      try {
        const res = await fetch('https://turnolibre-backend.onrender.com/superadmin/configuraciones', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ precioDestacado: precio, diasDestacado: dias })
        });
        const data = await res.json();
        if (data.ok) {
          alerta.innerHTML = `<div class="alert alert-success">¡Configuración actualizada!</div>`;
        } else {
          alerta.innerHTML = `<div class="alert alert-danger">${data.msg}</div>`;
        }
      } catch (err) {
        alerta.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
      }
    });

  } catch (error) {
    content.innerHTML = `<h2>Configuraciones Globales</h2><div class="alert alert-danger">Error: ${error.message}</div>`;
  }
}



});
