document.addEventListener('DOMContentLoaded', async () => {
    const clubEmail = localStorage.getItem('clubEmail');
    const clubNombre = localStorage.getItem('clubNombre');

    if (!clubEmail || !clubNombre) {
        alert('Debes iniciar sesión como club.');
        window.location.href = 'login-club.html';
        return;
    }

    document.getElementById('info-club').textContent = `Bienvenido, ${clubNombre} (${clubEmail})`;

    document.getElementById('cerrar-sesion').addEventListener('click', () => {
        localStorage.removeItem('clubEmail');
        localStorage.removeItem('clubNombre');
        window.location.href = 'login-club.html';
    });

    const canchasList = document.getElementById('canchas-list');

    async function cargarCanchas() {
        canchasList.innerHTML = '';
        const res = await fetch(`https://api.canchalibre.ar/canchas/${clubEmail}`);
        const canchas = await res.json();
        canchas.forEach(c => {
            const item = document.createElement('div');
            item.className = 'list-group-item d-flex justify-content-between align-items-center';
            item.innerHTML = `
                <div>
                    <strong>${c.nombre}</strong> (${c.deporte}) - $${c.precio} - Horario: ${c.horario}
                </div>
                <button class="btn btn-sm btn-danger" data-id="${c._id}">Eliminar</button>
            `;
            item.querySelector('button').addEventListener('click', async () => {
                await fetch(`https://api.canchalibre.ar/canchas/${c._id}`, { method: 'DELETE' });
                cargarCanchas();
            });
            canchasList.appendChild(item);
        });
    }

    cargarCanchas();

    const form = document.getElementById('form-agregar-cancha');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('nombre-cancha').value;
        const deporte = document.getElementById('deporte-cancha').value;
        const precio = document.getElementById('precio-cancha').value;
        const horario = document.getElementById('horario-cancha').value;

        await fetch('https://api.canchalibre.ar/canchas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, deporte, precio, horario, clubEmail })
        });

        form.reset();
        cargarCanchas();
    });
});
