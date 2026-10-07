# Pruebas de la web V2

Ejecutar `npm ci` y luego `npm test` con Node.js compatible con jsdom (22.22.2 o superior, o 24.15 o superior).

Las pruebas no llaman a producción. Simulan respuestas HTTP y comprueban renovación JWT, logout, configuración de API, carga del buscador con sesión, acceso de invitados y creación de reservas desde el detalle. También verifican el bloqueo del doble clic y la posibilidad de reintentar tras un error.

jsdom permite probar el HTML y sus eventos. Estas pruebas no verifican el aspecto visual, Leaflet, cookies de un navegador real ni MercadoPago.

Para Chromium: `npx playwright install chromium` y `npm run test:browser`. El navegador prueba buscador, detalle, reserva con JWT, navegación y logout con API y recursos externos simulados; guarda capturas en `.test-artifacts`. Se puede indicar un ejecutable disponible con `CHROMIUM_EXECUTABLE_PATH` y argumentos JSON con `CHROMIUM_ARGS`. No utiliza producción ni verifica MercadoPago, Leaflet o cookies reales del backend.

El buscador también verifica bloqueo de submits duplicados, recuperación tras errores, mensajes de carga/vacío/resultado, aria-busy y acciones de reserva sin onclick interpolado. Chromium verifica estado vacío y ancho de 390 px sin desbordamiento; genera capturas de escritorio y móvil.

Mi cuenta: pruebas de nombres con HTML almacenado, reservas pasadas sin acciones, bloqueo de solicitudes simultáneas, errores de conexión y rechazo de cancelación pagada, reintento de carga y enlaces HTTPS de pago mediante clic explícito (sin popup asíncrono). Horarios interpretados en Argentina independientemente de la zona del navegador.

Mapa: agrupa turnos de una ubicación en un marcador y construye su contenido al abrirlo, con eventos DOM seguros y coordenadas validadas. Chromium usa Leaflet local y prueba apertura repetida. Destacados: enlaces HTTPS creados con DOM. SuperAdmin: las respuestas tardías no reemplazan otra sección seleccionada.

Cuentas: selector explícito usuario/club para recuperación, respuestas como texto, bloqueo de doble envío y preservación de espacios de contraseña. Los logs de todos los scripts, incluidos inline, solo contienen mensajes constantes. Paneles comparten panels.css; prueba real con backend revisa ancho móvil de 390 px y guarda capturas.
