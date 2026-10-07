// Permite configurar un backend de desarrollo antes de cargar este archivo.
window.API_BASE_URL = window.API_BASE_URL || window.APP_BASE_URL || 'https://api.canchalibre.ar';

window.CanchaLibreApiUrl = function (path) {
  const base = String(window.API_BASE_URL).replace(/\/+$/, '');
  return base + '/' + String(path || '').replace(/^\/+/, '');
};
