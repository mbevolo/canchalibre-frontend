document.addEventListener('DOMContentLoaded', async () => {
    const clubEmail = localStorage.getItem('clubEmail');
    const modal = new bootstrap.Modal(document.getElementById('modalCancha'));

    async function cargarInfoClub() {
        const res = await fetch(`https://api.canchalibre.ar/club/${clubEmail}`);
        const club = await res.json();
        document.getElementById('infoClubContent').innerHTML = `
            <p><strong>Nombre:</strong> ${club.nombre}</p>
            <p><strong>Email:</strong> ${club.email}</p>
            <p><strong>Ubicación:</strong> Lat ${club.latitud}, Lon ${club.longitud}</p>
        `;
    }

    async function cargarCanchas() {
        const res = await fetch(`https://api.canchalibre.ar/canchas/${clubEmail}`);
        const canchas = await res.json();
        const list = document.getElementById('canchasList');
        list.innerHTML = '';
        canchas.forEach(c => {
            const div = document.createElement('div');
            div.className = 'col-md-4';
            div.innerHTML = `
                <div class="card mb-2">
                    <div class="card-body">
                        <h5>${c.nombre}</h5>
                        <p>Deporte: ${c.deporte}</p>
                        <p>Precio: $${c.precio}</p>
                        <button class="btn btn-sm btn-warning me-2" onclick="editarCancha('${c._id}', '${c.nombre}', '${c.deporte}', ${c.precio})">Editar</button>
                        <button class="btn btn-sm btn-danger" onclick="eliminarCancha('${c._id}')">Eliminar</button>
                    </div>
                </div>
            `;
            list.appendChild(div);
        });
    }

    window.editarCancha = (id, nombre, deporte, precio) => {
        document.getElementById('canchaId').value = id;
        document.getElementById('canchaNombre').value = nombre;
        document.getElementById('canchaDeporte').value = deporte;
        document.getElementById('canchaPrecio').value = precio;
        modal.show();
    };

    window.eliminarCancha = async (id) => {
        if (confirm('¿Estás seguro de eliminar esta cancha?')) {
            await fetch(`https://api.canchalibre.ar/canchas/${id}`, { method: 'DELETE' });
            cargarCanchas();
        }
    };

    document.getElementById('agregarCanchaBtn').addEventListener('click', () => {
        document.getElementById('canchaId').value = '';
        document.getElementById('canchaNombre').value = '';
        document.getElementById('canchaDeporte').value = 'futbol';
        document.getElementById('canchaPrecio').value = '';
        modal.show();
    });

    document.getElementById('guardarCanchaBtn').addEventListener('click', async () => {
        const id = document.getElementById('canchaId').value;
        const nombre = document.getElementById('canchaNombre').value;
        const deporte = document.getElementById('canchaDeporte').value;
        const precio = document.getElementById('canchaPrecio').value;

        const body = { nombre, deporte, precio, clubEmail };

        if (id) {
            await fetch(`https://api.canchalibre.ar/canchas/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
        } else {
            await fetch('https://api.canchalibre.ar/canchas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
        }
        modal.hide();
        cargarCanchas();
    });

    cargarInfoClub();
    cargarCanchas();
});
