document.addEventListener('DOMContentLoaded', async () => {
  const emailUsuario = localStorage.getItem('usuarioLogueado');
  if (!emailUsuario) {
    alert('Debes iniciar sesión.');
    window.location.href = 'login.html';
    return;
  }

  document.getElementById('info-usuario').textContent = `Estás logueado como: ${emailUsuario}`;

  const btnCerrarSesion = document.getElementById('cerrar-sesion');
  if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener('click', () => {
      localStorage.removeItem('usuarioLogueado');
      window.location.href = 'login.html';
    });
  }

  async function cargarDatosUsuario() {
    try {
      const res = await fetch(`https://api.canchalibre.ar/usuario/${emailUsuario}`);
      const usuario = await res.json();

      document.getElementById('nombre').value = usuario.nombre || '';
      document.getElementById('apellido').value = usuario.apellido || '';
      document.getElementById('telefono').value = usuario.telefono || '';
      document.getElementById('email').value = usuario.email || '';
    } catch (error) {
      console.error('Error al cargar datos del usuario:', error);
    }
  }

  // =============================
  // ✅ Render de "reservas pasadas" (compartido)
  // =============================
  function renderBtnVerPasadas(contenedor, textoBoton = 'Ver reservas pasadas') {
    const wrapper = document.createElement('div');
    wrapper.className = 'mt-2';

    const btn = document.createElement('button');
    btn.id = 'ver-reservas-pasadas';
    btn.className = 'btn btn-outline-secondary btn-sm';
    btn.textContent = textoBoton;

    wrapper.appendChild(btn);
    contenedor.appendChild(wrapper);

    engancharBotonPasadas(); // engancha el click del botón recién creado
  }

  function engancharBotonPasadas() {

    // Evita duplicar listeners si se vuelve a renderizar
    if (btnVerPasadas.dataset.bound === '1') return;
    btnVerPasadas.dataset.bound = '1';

    btnVerPasadas.addEventListener('click', async () => {
      try {
        const res = await fetch(`https://api.canchalibre.ar/reservas-usuario/${emailUsuario}`);
        const reservas = await res.json();
        const contenedor = document.getElementById('reservas-container');
        contenedor.innerHTML = '';

        const ahora = new Date();
        const pasadas = reservas
          .filter(r => new Date(`${r.fecha}T${r.hora}`) < ahora)
          .sort((a, b) => new Date(`${b.fecha}T${b.hora}`) - new Date(`${a.fecha}T${a.hora}`)); // más recientes arriba

        if (pasadas.length === 0) {
          contenedor.innerHTML = `<div class="alert alert-secondary">No tenés reservas pasadas.</div>`;
        } else {
          const tabla = document.createElement('table');
          tabla.classList.add('table', 'table-striped');

          const thead = document.createElement('thead');
          thead.innerHTML = `
            <tr>
              <th>Club</th>
              <th>Deporte</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Estado</th>
            </tr>`;
          tabla.appendChild(thead);

          const tbody = document.createElement('tbody');
          pasadas.forEach(r => {
            const [anio, mes, dia] = r.fecha.split('-');
            const fechaFormateada = `${dia}/${mes}/${anio}`;
            const deporteCapitalizado = r.deporte
              ? r.deporte.charAt(0).toUpperCase() + r.deporte.slice(1)
              : '(Pendiente de confirmación)';

            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td>${r.nombreClub || 'Club desconocido'}</td>
              <td>${deporteCapitalizado}</td>
              <td>${fechaFormateada}</td>
              <td>${r.hora}</td>
              <td>${r.pagado ? 'Pagado' : 'Pendiente'}</td>
            `;
            tbody.appendChild(tr);
          });

          tabla.appendChild(tbody);
          contenedor.appendChild(tabla);
        }

        // Botón volver a futuras
        const btnVolver = document.createElement('button');
        btnVolver.textContent = 'Ver reservas futuras';
        btnVolver.className = 'btn btn-outline-primary btn-sm mt-2';
        contenedor.appendChild(btnVolver);

        btnVolver.addEventListener('click', () => {
          cargarReservas();
        });

      } catch (error) {
        console.error('Error al cargar reservas pasadas:', error);
        document.getElementById('reservas-container').textContent = 'Error al cargar reservas pasadas.';
      }
    });
  }



  // =============================
  // 🔧 Modo lectura / edición en "Mis datos"
  // =============================
  const camposUsuario = ['nombre', 'apellido', 'telefono']; // email no se edita
  const btnEditar = document.getElementById('btn-editar');
  const btnGuardar = document.getElementById('btn-guardar');

  function modoLectura() {
    camposUsuario.forEach(id => {
      const input = document.getElementById(id);
      if (input) input.disabled = true;
    });
    const emailInput = document.getElementById('email');
    if (emailInput) emailInput.disabled = true;

    if (btnEditar) btnEditar.style.display = 'inline-block';
    if (btnGuardar) btnGuardar.style.display = 'none';
  }

  function modoEdicion() {
    camposUsuario.forEach(id => {
      const input = document.getElementById(id);
      if (input) input.disabled = false;
    });
    const emailInput = document.getElementById('email');
    if (emailInput) emailInput.disabled = true;

    if (btnEditar) btnEditar.style.display = 'none';
    if (btnGuardar) btnGuardar.style.display = 'inline-block';
  }

  if (btnEditar) {
    btnEditar.addEventListener('click', modoEdicion);
  }

  // ✅ Guardar cambios de usuario
  const formUsuario = document.getElementById('form-usuario');
  if (formUsuario) {
    formUsuario.addEventListener('submit', async (e) => {
      e.preventDefault();
      const datos = {
        nombre: document.getElementById('nombre').value.trim(),
        apellido: document.getElementById('apellido').value.trim(),
        telefono: document.getElementById('telefono').value.trim()
      };

      try {
        const res = await fetch(`https://api.canchalibre.ar/usuario/${emailUsuario}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos)
        });

        await res.json();
        modoLectura();
      } catch (error) {
        console.error('Error al actualizar usuario:', error);
        alert('Error al actualizar los datos.');
      }
    });
  }

  // 🔚 Cargar datos iniciales y dejar todo en modo lectura
  await cargarDatosUsuario();
  modoLectura();
});
