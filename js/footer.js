document.addEventListener("DOMContentLoaded", () => {
    const footerHTML = `
        <footer style="text-align:center; padding:20px; margin-top:40px; font-size:14px; background:#f7f7f7;">
            <p>CanchaLibre © 2025 – Todos los derechos reservados.</p>
            <p>CanchaLibre es una plataforma de intermediación entre usuarios y clubes.</p>
            <p>
                <a href="terminos-usuarios.html">Términos y Condiciones</a> ·
                <a href="terminos-clubes.html">Términos para Clubes</a> ·
                <a href="privacidad.html">Política de Privacidad</a> ·
                <a href="cookies.html">Política de Cookies</a> ·
                <a href="aviso-legal.html">Aviso Legal</a>
            </p>
            <p>Contacto legal: <strong>legal@canchalibre.ar</strong></p>
        </footer>
    `;

    document.body.insertAdjacentHTML("beforeend", footerHTML);
});
