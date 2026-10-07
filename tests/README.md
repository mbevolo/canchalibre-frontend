# Pruebas de la web V2

Ejecutar `npm ci` y luego `npm test` con Node.js compatible con jsdom (22.22.2 o superior, o 24.15 o superior).

Las pruebas no llaman a producción. Simulan respuestas HTTP y comprueban renovación JWT, logout, configuración de API, carga del buscador con sesión, acceso de invitados y creación de reservas desde el detalle. También verifican el bloqueo del doble clic y la posibilidad de reintentar tras un error.

jsdom permite probar el HTML y sus eventos. Estas pruebas no verifican el aspecto visual, Leaflet, cookies de un navegador real ni MercadoPago.

Para Chromium: `npx playwright install chromium` y `npm run test:browser`. El navegador prueba buscador, detalle, reserva con JWT, navegación y logout con API y recursos externos simulados; guarda capturas en `.test-artifacts`. Se puede indicar un ejecutable disponible con `CHROMIUM_EXECUTABLE_PATH` y argumentos JSON con `CHROMIUM_ARGS`. No utiliza producción ni verifica MercadoPago, Leaflet o cookies reales del backend.

El buscador también verifica bloqueo de submits duplicados, recuperación tras errores, mensajes de carga/vacío/resultado, aria-busy y acciones de reserva sin onclick interpolado. Chromium verifica estado vacío y ancho de 390 px sin desbordamiento; genera capturas de escritorio y móvil.
