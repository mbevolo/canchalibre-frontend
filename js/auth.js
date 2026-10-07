if (!window.__AUTH_BASE__) {
  window.__AUTH_BASE__ =
    (window.APP_BASE_URL && String(window.APP_BASE_URL)) ||
    (window.API_BASE_URL && String(window.API_BASE_URL)) ||
    'https://api.canchalibre.ar';
}

function apiUrl(path) {
  const p = String(path || '').startsWith('/') ? path : '/' + (path || '');
  const base = String(/^\/auth(?:\/|$)/.test(p) && window.AUTH_BASE_URL
    ? window.AUTH_BASE_URL : window.__AUTH_BASE__).replace(/\/+$/, '');
  return base + p;
}

let accessToken = null;
let refreshPromise = null;

function getAccessToken() {
  return accessToken;
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = fetch(apiUrl('/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  })
    .then(async res => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.accessToken) {
        accessToken = null;
        throw new Error(data.error || 'Sesión expirada');
      }
      accessToken = data.accessToken;
      return data;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

async function authFetch(path, options = {}, retry = true) {
  const headers = new Headers(options.headers || {});
  if (accessToken) headers.set('Authorization', 'Bearer ' + accessToken);

  const response = await fetch(apiUrl(path), {
    ...options,
    headers,
    credentials: 'include'
  });

  if (response.status === 401 && retry) {
    try {
      await refreshAccessToken();
      return authFetch(path, options, false);
    } catch (_) {}
  }

  return response;
}

async function loginUser(email, password) {
  const res = await fetch(apiUrl('/auth/login'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json().catch(() => ({}));

  if (res.ok && data.accessToken) {
    accessToken = data.accessToken;
    // El email ya no se usa como mecanismo de autenticación.
    localStorage.removeItem('usuarioLogueado');
    localStorage.removeItem('emailUsuario');
  }

  return { ok: res.ok, status: res.status, data };
}

async function logoutUser() {
  try {
    await fetch(apiUrl('/auth/logout'), {
      method: 'POST',
      credentials: 'include'
    });
  } finally {
    accessToken = null;
    localStorage.removeItem('usuarioLogueado');
    localStorage.removeItem('emailUsuario');
  }
}

async function requireUserSession() {
  if (accessToken) return true;
  try {
    await refreshAccessToken();
    return true;
  } catch (_) {
    accessToken = null;
    return false;
  }
}

window.CanchalibreAuth = {
  apiUrl,
  authFetch,
  getAccessToken,
  loginUser,
  logoutUser,
  refreshAccessToken,
  requireUserSession
};

// El destino de regreso es fijo para evitar redirecciones externas.
const volverAlTurno = new URLSearchParams(window.location?.search).get('volver') === 'detalle';
for (const enlace of document.querySelectorAll('a[href="registro.html"], a[href="login.html"]')) {
  if (volverAlTurno) enlace.href += '?volver=detalle';
}

// ============================
// Registro
// ============================
const formRegistro = document.getElementById('form-registro');
if (formRegistro) {
  formRegistro.addEventListener('submit', async e => {
    e.preventDefault();

    const checkbox = document.getElementById('aceptoTerminos');
    if (!checkbox || !checkbox.checked) {
      alert('Debes aceptar los Términos y Condiciones y la Política de Privacidad para registrarte.');
      return;
    }

    const normalizarTelefonoFront = tel => {
      let t = String(tel || '').replace(/\D/g, '');
      if (!t) return '';
      if (!t.startsWith('549')) t = '549' + t;
      return t;
    };

    const nombre = document.getElementById('nombre')?.value?.trim() || '';
    const apellido = document.getElementById('apellido')?.value?.trim() || '';
    const telefono = normalizarTelefonoFront(document.getElementById('telefono')?.value || '');
    const email = document.getElementById('email')?.value?.trim() || '';
    const password = document.getElementById('password')?.value || '';

    try {
      const r = await fetch(apiUrl('/registrar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, apellido, telefono, email, password })
      });
      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        alert(data?.error || 'No se pudo registrar el usuario.');
        return;
      }

      alert('Registro exitoso. Revisá tu email para verificar la cuenta.');
      window.location.href = volverAlTurno ? 'login.html?volver=detalle' : 'login.html';
    } catch (err) {
      console.error("❌ Error de red en registro:");
      alert('Error de red. Intentá nuevamente.');
    }
  });
}

// ============================
// Login
// ============================
const formLogin = document.getElementById('form-login');
if (formLogin) {
  formLogin.addEventListener('submit', async e => {
    e.preventDefault();
    const button = formLogin.querySelector('button[type=submit]');
    if (button.disabled || !formLogin.reportValidity()) return;
    button.disabled = true;
    button.textContent = 'Ingresando…';

    const email = document.getElementById('email')?.value?.trim() || '';
    const password = document.getElementById('password')?.value || '';
    const resendBlock = document.getElementById('resend-block');
    const resendMsg = document.getElementById('resend-msg');

    if (resendBlock) resendBlock.style.display = 'none';
    if (resendMsg) resendMsg.textContent = '';

    try {
      const { ok, status, data } = await loginUser(email, password);

      if (ok) {
        window.location.href = volverAlTurno ? 'detalle.html' : 'index.html';
        return;
      }

      if (status === 403) {
        alert(data?.error || 'Debes verificar tu email antes de iniciar sesión');
        const resendEmail = document.getElementById('resend-email');
        if (resendEmail) resendEmail.value = email;
        if (resendBlock) resendBlock.style.display = 'block';
        return;
      }

      alert(data?.error || 'No se pudo iniciar sesión.');
    } catch (err) {
      console.error("❌ Error de red en login:");
      alert('Error de red. Intentá nuevamente.');
    } finally { button.disabled = false; button.textContent = 'Iniciar sesión'; }
  });
}

// ============================
// Reenviar verificación
// ============================
const btnResend = document.getElementById('btn-resend');
if (btnResend) {
  btnResend.addEventListener('click', async () => {
    const resendEmail = document.getElementById('resend-email');
    const resendMsg = document.getElementById('resend-msg');
    const email = resendEmail?.value?.trim() || '';

    if (!email) {
      if (resendMsg) resendMsg.textContent = 'Ingresá tu email.';
      return;
    }

    try {
      const res = await fetch(apiUrl('/reenviar-verificacion'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json().catch(() => ({}));

      if (resendMsg) {
        resendMsg.textContent = res.ok
          ? 'Te enviamos un nuevo email de verificación.'
          : (data?.error || 'No se pudo reenviar la verificación.');
      }
    } catch (err) {
      console.error("❌ Error reenviando verificación:");
      if (resendMsg) resendMsg.textContent = 'Error de red. Intentá nuevamente.';
    }
  });
}
