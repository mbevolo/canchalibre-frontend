// Permite configurar un backend de desarrollo antes de cargar este archivo.
window.API_BASE_URL = window.API_BASE_URL || window.APP_BASE_URL || 'https://api.canchalibre.ar';

// La cookie de sesión del entorno de prueba permanece en el dominio del frontend.
if (window.location?.hostname === 'canchalibre-frontend-v2-test.vercel.app') {
  window.AUTH_BASE_URL = window.location.origin;
}

window.CanchaLibreApiUrl = function (path) {
  const base = String(window.API_BASE_URL).replace(/\/+$/, '');
  return base + '/' + String(path || '').replace(/^\/+/, '');
};
