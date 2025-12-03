document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('form-login-club');

    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const res = await fetch('https://api.canchalibre.ar/login-club', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await res.json();

                if (!res.ok) {
                    alert(data.error || 'Error al iniciar sesión');
                    return;
                }

                // ✅ Guardar token y datos del club enviados por el backend
               localStorage.setItem('clubToken', data.token);
localStorage.setItem('clubId', data.clubId);
localStorage.setItem('clubNombre', data.nombre);
localStorage.setItem('clubEmail', data.email);

                // ✅ Redirigir al panel
                window.location.href = 'panel-club.html';

            } catch (error) {
                console.error('Error al enviar la solicitud:', error);
                alert('Error de red o servidor.');
            }
        });
    }
});
