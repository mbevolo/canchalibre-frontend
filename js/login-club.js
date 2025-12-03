document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('form-login-club');
    const bloqueReenvio = document.getElementById('bloque-reenvio-verificacion');
    const mensajeReenvio = document.getElementById('mensaje-reenvio');

    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value.trim();

            try {
                const res = await fetch('https://api.canchalibre.ar/login-club', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await res.json();

                // =====================
                // ❌ ERROR: NO VERIFICADO
                // =====================
                if (data.error && data.error.includes('verificar')) {
                    alert('⚠️ Tu cuenta de club todavía no está verificada.');

                    // mostrar el bloque oculto
                    if (bloqueReenvio) {
                        bloqueReenvio.style.display = 'block';
                        mensajeReenvio.textContent = '';
                    }
                    return;
                }

                // ❌ Otro error normal
                if (!res.ok) {
                    alert(data.error || 'Error al iniciar sesión');
                    return;
                }

                // =====================
                // ✅ LOGIN EXITOSO
                // =====================
                localStorage.setItem('clubToken', data.token);
                localStorage.setItem('clubId', data.clubId);
                localStorage.setItem('clubNombre', data.nombre);
                localStorage.setItem('clubEmail', data.email);

                window.location.href = 'panel-club.html';

            } catch (error) {
                console.error('Error al enviar la solicitud:', error);
                alert('Error de red o servidor.');
            }
        });
    }

    // =============================================
    // ▶️ BOTÓN REENVIAR VERIFICACIÓN
    // =============================================
    const btnReenviar = document.getElementById('btn-reenviar-verificacion');
    if (btnReenviar) {
        btnReenviar.addEventListener('click', async () => {
            const email = document.getElementById('email').value.trim();

            if (!email) {
                mensajeReenvio.textContent = "Ingresá tu email arriba para reenviar el correo.";
                return;
            }

            try {
                const res = await fetch('https://api.canchalibre.ar/club/reenviar-verificacion', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                const data = await res.json();

                mensajeReenvio.textContent = data.mensaje || data.error;

            } catch (error) {
                mensajeReenvio.textContent = "Error al reenviar el correo.";
            }
        });
    }
});
