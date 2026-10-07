# Pruebas de la web V2

Ejecutar `npm ci` y luego `npm test` con Node.js compatible con jsdom (22.22.2 o superior, o 24.15 o superior).

Las pruebas no llaman a producción. Simulan respuestas HTTP y comprueban renovación JWT, logout, configuración de API, carga del buscador con sesión, acceso de invitados y creación de reservas desde el detalle. También verifican el bloqueo del doble clic y la posibilidad de reintentar tras un error.

jsdom permite probar el HTML y sus eventos. Estas pruebas no verifican el aspecto visual, Leaflet, cookies de un navegador real ni MercadoPago.
