document.addEventListener('DOMContentLoaded', async () => {
    const emailUsuario = localStorage.getItem('usuarioLogueado');
    if (!emailUsuario) {
        alert('Debes iniciar sesión.');
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('info-usuario').textContent = `Estás logueado como: ${emailUsuario}`;

    const btnCerrarSesion = document.getElementById('cerrar-sesion');
    btnCerrarSesion.addEventListener('click', () => {
        localStorage.removeItem('usuarioLogueado');
        window.location.href = 'login.html';
    });

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

    async function cargarReservas() {
        try {
            const res = await fetch(`https://api.canchalibre.ar/reservas-usuario/${emailUsuario}`);
            const reservas = await res.json();

            const contenedor = document.getElementById('reservas-container');
            contenedor.innerHTML = '';

            const ahora = new Date();
            const reservasFuturas = reservas
                .filter(r => new Date(`${r.fecha}T${r.hora}`) >= ahora)
                .sort((a, b) => new Date(`${a.fecha}T${a.hora}`) - new Date(`${b.fecha}T${b.hora}`));

            if (reservasFuturas.length === 0) {
                contenedor.textContent = 'No tenés reservas futuras.';
                return;
            }

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
                    <th>Acción</th>
                </tr>`;
            tabla.appendChild(thead);

            const tbody = document.createElement('tbody');

            reservasFuturas.forEach(r => {
                const [anio, mes, dia] = r.fecha.split('-');
                const fechaFormateada = `${dia}/${mes}/${anio}`;
                const deporteCapitalizado = r.deporte
  ? r.deporte.charAt(0).toUpperCase() + r.deporte.slice(1)
  : '(Pendiente de confirmación)';

                const estadoPago = r.pagado ? 'Pagado' : 'Pendiente';

                let botones = `<button class="btn btn-danger btn-sm cancelar-btn me-2" data-id="${r._id}">Cancelar</button>`;
                if (!r.pagado) {
                    botones += `<button class="btn btn-success btn-sm generar-pago-usuario" data-id="${r._id}">Pagar online</button>`;
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${r.nombreClub || 'Club desconocido'}</td>
                    <td>${deporteCapitalizado}</td>
                    <td>${fechaFormateada}</td>
                    <td>${r.hora}</td>
                    <td>${estadoPago}</td>
                    <td>${botones}</td>
                `;
                tbody.appendChild(tr);
            });

            tabla.appendChild(tbody);
            contenedor.appendChild(tabla);

            // Cancelar reserva
            contenedor.querySelectorAll('.cancelar-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    const confirmar = confirm('¿Estás seguro de cancelar esta reserva?');
                    if (confirmar) {
                        await fetch(`https://api.canchalibre.ar/turnos/${id}/cancelar`, { method: 'PATCH' });
                        alert('Reserva cancelada');
                        cargarReservas();
                    }
                });
            });

            // Pagar reserva
            contenedor.querySelectorAll('.generar-pago-usuario').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    try {
                        const res = await fetch(`https://api.canchalibre.ar/generar-link-pago/${id}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' }
                        });

                        const data = await res.json();
                        if (res.ok && data.pagoUrl) {
                            window.open(data.pagoUrl, '_blank');
                        } else {
                            alert(data.error || 'No se pudo generar el link de pago.');
                        }
                    } catch (err) {
                        console.error(err);
                        alert('Error generando el link de pago.');
                    }
                });
            });

        } catch (error) {
            console.error('Error al cargar reservas del usuario:', error);
            document.getElementById('reservas-container').textContent = 'Error al cargar reservas.';
        }
    }

    document.getElementById('form-usuario').addEventListener('submit', async (e) => {
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

            const result = await res.json();
            alert(result.mensaje || 'Datos actualizados correctamente.');
        } catch (error) {
            console.error('Error al actualizar usuario:', error);
            alert('Error al actualizar los datos.');
        }
    });

   const btnVerPasadas = document.getElementById('ver-reservas-pasadas');
if (btnVerPasadas) {
  btnVerPasadas.addEventListener('click', async () => {
    try {
      const res = await fetch(`https://api.canchalibre.ar/reservas-usuario/${emailUsuario}`);
      const reservas = await res.json();
      const contenedor = document.getElementById('reservas-container');
      contenedor.innerHTML = '';

      const ahora = new Date();
      const pasadas = reservas.filter(r => new Date(`${r.fecha}T${r.hora}`) < ahora);

      if (pasadas.length === 0) {
        contenedor.textContent = 'No tenés reservas pasadas.';
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

      btnVerPasadas.style.display = 'none';
      const btnVolver = document.createElement('button');
      btnVolver.textContent = 'Ver reservas futuras';
      btnVolver.className = 'btn btn-outline-primary btn-sm mt-2';
      btnVerPasadas.parentElement.appendChild(btnVolver);

      btnVolver.addEventListener('click', () => {
        btnVolver.remove();
        btnVerPasadas.style.display = 'inline-block';
        cargarReservas();
      });

    } catch (error) {
      console.error('Error al cargar reservas pasadas:', error);
      document.getElementById('reservas-container').textContent = 'Error al cargar reservas pasadas.';
    }
  });
}


    cargarReservas();
    cargarDatosUsuario();
});
