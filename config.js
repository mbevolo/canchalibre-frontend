// Configuración de la API por entorno.
// En producción y en la web V2 de pruebas, usamos el proxy de mismo origen de Vercel.
const canchalibreHost = window.location?.hostname || '';
const useV2Proxy = [
  'canchalibre.ar',
  'www.canchalibre.ar',
  'canchalibre-frontend-v2-test.vercel.app',
].includes(canchalibreHost);

if (useV2Proxy) {
  window.API_BASE_URL = window.location.origin + '/api';
  window.AUTH_BASE_URL = window.location.origin;
} else {
  window.API_BASE_URL = window.API_BASE_URL || window.APP_BASE_URL || 'https://api.canchalibre.ar';
}

window.CanchaLibreApiUrl = function (path) {
  const base = String(window.API_BASE_URL).replace(/\/+$/, '');
  return base + '/' + String(path || '').replace(/^\/+/, '');
};
