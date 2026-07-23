# Plan vivo de implementación — CashFlowQba

Última actualización: 2026-07-23

Este documento es la fuente de verdad del avance técnico. Debe actualizarse en el
mismo cambio que implemente, bloquee o replantee una tarea.

## Estados

- `[ ]` Pendiente
- `[~]` En progreso
- `[x]` Completada y verificada
- `[!]` Bloqueada o requiere una decisión externa

## Reglas globales de terminado

Una tarea solo pasa a completada cuando:

- tiene pruebas proporcionales al riesgo;
- compilan frontend y backend;
- no expone PII, secretos, firmas ni payloads internos;
- maneja errores y deja trazabilidad suficiente;
- funciona en móvil cuando afecta a la interfaz;
- no permite regresiones de estado;
- no habilita entregas con pagos no confirmados;
- no promete servicios, cobertura o tiempos no disponibles.

## Línea base auditada

- Repositorio: `ErnestoArtime/remesas`
- Rama: `main`
- Último commit remoto auditado: `3c1dc712900a74b456b2d5310f16d827eb70e00d`
- Frontend Angular y backend Express compilan.
- No existían tests ni lint automatizado al comenzar este plan.
- Persistencia actual: ficheros JSON locales.
- Pago actual: USDT en BSC y EUR manual.
- Riesgos críticos confirmados:
  - listado público de órdenes y consulta pública con PII;
  - payload y firma HMAC almacenados dentro de la orden;
  - webhook plano sin `transaction.confirmation_update`;
  - eventos atrasados pueden hacer retroceder estados;
  - tarifas duplicadas en Angular y backend;
  - total modificable después de asignar wallet;
  - OpenWA pide un JID técnico y la semántica de sorpresa está invertida.

## Fase 0 — Auditoría y contratos reales

- [!] Activar `transaction.confirmation_update` en TronDealer.
- [!] Ejecutar un pago real pequeño y capturar payloads anonimizados de:
  - `transaction.incoming`
  - `transaction.confirmation_update`
  - `transaction.confirmed`
  - `transaction.swept`
- [x] Crear fixtures sintéticos basados en la documentación oficial.
- [ ] Sustituir o complementar los fixtures sintéticos con payloads reales anonimizados.
- [ ] Documentar si la cuenta entrega payload plano, `{ event, data }` o ambos.

Los pasos marcados como bloqueados requieren acceso al panel y una transacción real
de TronDealer. Nunca se guardarán wallets, firmas, teléfonos ni secretos reales.

## Fase 1 — Pagos y seguridad crítica

### 1.1 Normalizador TronDealer

- [x] Crear tipos, normalizador y lógica de aplicación de eventos.
- [x] Aceptar payload plano y `{ event, data }`.
- [x] Aceptar camelCase y snake_case.
- [x] Normalizar `log_index`, `vout_index` y `output_index`.
- [x] Registrar eventos desconocidos sin cambiar el estado comercial.
- [x] Mantener compatibilidad con estados planos legados.

### 1.2 Confirmaciones y estados monotónicos

- [x] Guardar confirmaciones actuales, mínimo requerido y progreso.
- [x] Conservar siempre el máximo de confirmaciones observado.
- [x] Impedir que eventos atrasados reduzcan el estado.
- [x] Impedir que `confirmation_update` confirme o libere una entrega.
- [x] Usar una clave de deduplicación canónica no nula.

### 1.3 PaymentIntent

- [x] Separar la remesa del intento de pago.
- [x] Conservar historial de intentos.
- [ ] Invalidar el intento anterior al cambiar de red antes del depósito.
- [x] Bloquear activo y red después de detectar un pago.

### 1.4 Catálogo de activos y redes

- [x] Crear catálogo backend de opciones de pago.
- [x] Crear endpoints público y administrativo.
- [x] Mantener inicialmente solo USDT-BSC habilitado para criptomonedas.
- [ ] Habilitar cada nueva combinación únicamente tras una prueba E2E real.

### 1.5 Monedas nativas

- [x] Persistir activo, red, monto USD, monto nativo y precio USD.
- [x] Comparar el equivalente USD de TronDealer con el total bloqueado.
- [x] Añadir tolerancia configurable para insuficiencias/excedentes.
- [x] No aumentar automáticamente la entrega por un excedente.

### 1.6 Privacidad de APIs

- [x] Eliminar el listado público de órdenes.
- [x] Crear seguimiento público mediante token aleatorio.
- [x] Guardar solo el hash del token.
- [x] Devolver un DTO sin PII ni datos técnicos internos.
- [x] Mantener acceso completo únicamente en administración.

### 1.7 Cotización bloqueada

- [x] Crear `POST /api/quotes`.
- [x] Persistir reglas, total y vencimiento.
- [x] Crear órdenes exclusivamente desde un `quoteId` vigente.
- [x] Impedir cambios de total con wallet activa o depósito detectado.
- [x] Eliminar reglas de tarifas del frontend.
- [x] Mostrar una cuenta regresiva real.

### 1.8 PostgreSQL/Supabase

- [x] Diseñar tablas, políticas y migración inicial.
- [!] Configurar backups en el proyecto remoto de Supabase.
- [ ] Migrar órdenes, cotizaciones, intentos, eventos, agentes y entregas.
- [ ] Añadir notificaciones, auditoría, referidos y clientes.
- [ ] Hacer la deduplicación atómica en base de datos.
- [ ] Verificar operación concurrente con dos instancias.

## Fase 2 — Seguimiento y experiencia de pago

- [x] Crear `/seguimiento/:reference`.
- [x] Mostrar timeline completo del pago y la entrega.
- [x] Mostrar confirmaciones sin retroceso.
- [x] Actualizar inicialmente mediante polling de 5–10 segundos.
- [x] Detener polling en estados finales.
- [x] Mostrar activo, red, hash abreviado y explorador sin PII.
- [x] Mejorar instrucciones de pago, QR, copia de dirección/monto y vencimiento.
- [x] Añadir advertencias y tiempos específicos por red.

## Fase 3 — OpenWA y comunicaciones

- [x] Eliminar `senderChatId` del formulario público.
- [x] Normalizar teléfonos a E.164 y construir internamente el JID.
- [x] Añadir consentimiento explícito para WhatsApp.
- [x] Separar `notifySender`, `notifyBeneficiary` e `isSurprise`.
- [x] En una sorpresa, avisar al remitente y no anticipar al beneficiario.
- [x] Crear cola persistente con reintentos e historial.
- [x] Evitar que un fallo de WhatsApp revierta una operación.

## Fase 4 — Rediseño CashFlowQba

- [x] Crear tokens de color, tipografía, espaciado, radio, sombra y estados.
- [ ] Crear componentes UI reutilizables.
- [x] Cumplir WCAG AA y responsive desde 320 px.
- [x] Adoptar Angular Router y lazy-load de administración.
- [~] Separar home, cotización, checkout, seguimiento, admin y ayuda.
- [x] Rediseñar la portada con hero humano, calculadora central y seguimiento visual.
- [x] Usar azul marino, verde y fondos claros como dirección visual.
- [x] Añadir identidad gráfica propia en cabecera, pie y favicon.
- [x] Añadir animaciones de aparición por scroll con movimiento reducido accesible.
- [x] No mostrar testimonios, tasas, cobertura o tiempos ficticios.
- [x] Unificar todo el branding bajo CashFlowQba.

## Fase 5 — Catálogo operativo

- [x] Crear catálogo configurable de métodos de entrega.
- [x] Mostrar únicamente métodos operativamente disponibles.
- [x] Hacer configurables zonas, límites, tarifas y tiempos.
- [x] Crear API y visualización pública de avisos temporales.
- [x] No usar “garantizado” sin respaldo operacional.

## Fase 6 — Crecimiento

- [ ] Implementar referidos con reglas antifraude.
- [ ] Implementar fidelidad después de estabilizar pagos.
- [ ] Crear contenido administrable sin recompilar el frontend.
- [ ] Publicar guías de pago, redes, entrega y preguntas frecuentes.

## Fase 7 — Administración y observabilidad

- [~] Ampliar el detalle operativo de cada orden y pago.
- [~] Añadir filtros por fecha, estado, activo, red, municipio y agente.
- [x] Crear reconciliación entre orden, pago, eventos, sweep y entrega.
- [x] Alertar depósitos huérfanos, insuficiencias, diferencias y fallos.
- [x] Incorporar auditoría de toda modificación administrativa.

## Fase 8 — Calidad, seguridad y cumplimiento

- [x] Añadir validación de esquemas para requests críticos.
- [x] Añadir Helmet, rate limiting, CORS restringido y límites de body.
- [ ] Añadir logs estructurados y tratamiento seguro de secretos.
- [!] Sustituir la clave compartida por usuarios y roles.
- [x] Añadir tests de webhooks, privacidad y estados desordenados.
- [ ] Añadir tests frontend de calculadora, QR, seguimiento y accesibilidad.
- [~] Añadir E2E del flujo completo.
- [x] Ejecutar tests y builds en CI.

## Orden de implementación

1. Seguridad de endpoints y tests base.
2. Normalizador, deduplicación y confirmaciones.
3. Cotizaciones bloqueadas.
4. PostgreSQL/Supabase y PaymentIntent.
5. Seguimiento y pantalla de pago.
6. Catálogo de activos/redes y segunda combinación real.
7. OpenWA y cola de notificaciones.
8. Rediseño y router.
9. Monedas nativas, reconciliación y crecimiento.

## Decisiones técnicas

### 2026-07-23 — Clave de deduplicación

No se utilizará un único `UNIQUE(..., confirmations)` nullable. Cada evento tendrá
una `deduplicationKey` no nula:

```text
trondealer:{txHash}:{outputIndex}:{eventType}
trondealer:{txHash}:{outputIndex}:transaction.confirmation_update:{confirmations}
```

Esto evita la semántica de múltiples `NULL` de PostgreSQL y permite migrar luego
la misma regla a una restricción única.

### 2026-07-23 — Payloads y firmas

La firma se valida contra el cuerpo crudo, pero no se persiste dentro de la orden.
Los eventos asociados a la orden contienen únicamente campos normalizados.

### 2026-07-23 — Activación gradual

El código acepta monedas nativas y nuevas redes, pero el catálogo mantiene
USDT-BSC como única opción cripto activa. Ningún activo o red se habilitará
sin fixtures reales, depósito, confirmaciones, barrido y reconciliación
verificados de extremo a extremo.

## Bloqueos externos para completar producción

- [!] TronDealer: acceso al panel para activar `transaction.confirmation_update`,
  capturar payloads reales y ejecutar depósitos/barridos de prueba.
- [!] Supabase: `project_ref`, credenciales del entorno y ventana de migración
  para aplicar la migración validada, mover los JSON y comprobar dos instancias.
- [!] Autenticación: configuración del proveedor y usuarios/roles reales en
  Supabase Auth para retirar `ADMIN_API_KEY`.
- [!] Operación: confirmación formal de zonas, monedas de entrega, plazos,
  soporte y políticas antes de activar nuevas opciones.
- [!] Legal: revisión de términos, privacidad, identidad/KYC y tratamiento de
  datos antes de producción.
- [!] Crecimiento: reglas comerciales y antifraude para referidos, puntos y
  recompensas; no se implementan recompensas sin estas decisiones.

## Registro de avance

### 2026-07-23

- Auditoría del remoto, código y documentación oficial completada.
- Builds iniciales de Angular y TypeScript completados correctamente.
- Creado este documento vivo de seguimiento.
- Eliminados `GET /api/orders` y `GET /api/orders/:reference`.
- Añadido seguimiento público protegido por token aleatorio; solo se persiste su hash.
- Añadido DTO público sin PII, firma, payload crudo ni datos del agente.
- Añadido normalizador TronDealer para payload plano/envuelto y nombres camel/snake.
- Añadido soporte de `transaction.confirmation_update`, BTC `vout_index`,
  `amount_native` y `price_usd`.
- Añadida máquina de estados monotónica y máximo de confirmaciones observado.
- Sustituida la deduplicación por una clave canónica que incluye confirmaciones.
- Los eventos normalizados se guardan sin cuerpo crudo ni firma HMAC.
- Añadidos cuatro fixtures sintéticos anonimizados.
- Añadidas 11 pruebas de normalización, HMAC, privacidad, insuficiencia,
  deduplicación y eventos desordenados.
- CI actualizado para ejecutar las pruebas del backend antes de compilar.
- Verificación local: 11/11 tests, backend TypeScript y frontend Angular correctos.
- Añadidos `Quote`, `PaymentIntent` y catálogo backend de opciones de pago.
- Añadidos `POST /api/quotes` y `GET /api/payment-options`.
- Las órdenes ahora exigen un `quoteId` activo, no aceptan importes del navegador
  y consumen la cotización una sola vez.
- Bloqueada la modificación administrativa del total en órdenes nuevas.
- Angular dejó de contener reglas de comisión y consume la cotización del backend.
- Añadida cuenta regresiva real con regeneración automática al vencer.
- Eliminado el campo técnico `@c.us`; el backend normaliza E.164 y construye el JID.
- Corregida la semántica de sorpresa y añadido consentimiento de WhatsApp.
- Adoptado Angular Router con home, seguimiento y administración lazy-loaded.
- Añadida página de seguimiento con polling cada 7 segundos, timeline y progreso
  monotónico de confirmaciones.
- Inicializado Supabase CLI 2.109.1 y creada una migración inicial con 13 tablas.
- La migración se aplicó correctamente en el stack local mínimo.
- Verificado que las 13 tablas tienen RLS y que `anon`/`authenticated` no pueden
  consultar `orders`.
- `supabase db lint` no encontró errores de esquema.
- Verificación actual: 13/13 tests y builds de frontend/backend correctos.
- Añadidos Helmet, CORS restringido, límites de body, rate limiting general y
  un límite administrativo más estricto.
- Añadida validación Zod estricta para cotizaciones, órdenes, catálogos,
  agentes, asignaciones, tarifas y estados.
- Añadida cola persistente OpenWA con reintentos, historial y recuperación al
  reiniciar; los fallos no revierten la operación.
- Añadidos endpoints y controles administrativos para activar/desactivar pares
  de pago y métodos de entrega.
- El catálogo de entrega pasa zona, límites, tarifa y plazo al cálculo; el
  frontend dejó de duplicar incluso la tabla visual de tarifas.
- Añadidos QR de dirección, copia de dirección/monto, advertencia dinámica de
  activo/red y enlaces seguros al explorador.
- Añadido soporte comercial de montos nativos: USD de referencia, monto nativo,
  precio, tolerancia configurable y registro de excedentes sin aumentar entrega.
- Añadidas rutas lazy de ayuda, funcionamiento, términos y privacidad.
- Añadidos avisos de servicio temporales, tokens visuales CashFlowQba y diseño
  móvil validado a 390 px sin desbordamiento horizontal.
- Añadidos auditoría administrativa y endpoint de reconciliación con alertas.
- Actualizado Angular dentro de la rama 21 a parches de seguridad compatibles;
  producción frontend y backend reportan 0 vulnerabilidades.
- Verificación final local: 18/18 tests backend, TypeScript y Angular correctos,
  `git diff --check` limpio.
- Prueba manual automatizada en navegador: portada, cotización, creación,
  seguimiento tokenizado y panel administrativo correctos, sin overlay de error.
- La orden y cotizaciones sintéticas usadas durante la prueba fueron retiradas
  de los ficheros locales al finalizar.
- Publicada la rama `agent/cashflowqba-payments-tracking` mediante `git` con
  commits separados de funcionalidad, preparación del VPS y corrección de red.
- Construidas desde cero las imágenes Docker de frontend y backend.
- Desplegado CashFlowQba en el VPS mediante Docker Compose.
- Añadida una red de aplicación compartida para resolución segura
  frontend/backend, manteniendo el backend en la red `proxy` para OpenWA.
- Verificación en producción:
  - `https://remesa.eav-labs.com/` carga CashFlowQba;
  - `/api/health` devuelve `200`;
  - opciones de pago, métodos de entrega y tarifas devuelven `200`;
  - `/api/admin/orders` sin token devuelve `401`;
  - el antiguo `/api/orders` devuelve `404`;
  - frontend y backend figuran `healthy`;
  - navegador móvil a 390 px sin errores ni desbordamiento.
- Creado backup recuperable previo al despliegue en
  `/home/ernesto/backups/remesas/predeploy-a9e47eb.tar.gz`.
- Completada una segunda iteración visual de la portada basada en el mood board:
  hero fotográfico original, CTA principal, seguimiento blockchain ilustrativo,
  beneficios verificables y métodos activos alimentados por el backend.
- Añadido el recurso optimizado
  `public/images/cashflowqba-havana-hero.webp`; la escena fue generada
  expresamente para CashFlowQba y no contiene marcas, texto ni interfaces falsas.
- La interfaz evita testimonios inventados y deriva plazos, activos, redes y
  métodos disponibles de los catálogos operativos.
- Validación visual completada a 1440 px y 390 px sin desbordamiento horizontal;
  la auditoría automatizada WCAG 2 A/AA finalizó sin violaciones.
- Publicada la iteración visual en `main` y desplegada en
  `https://remesa.eav-labs.com/`; el frontend quedó `healthy`, la portada y
  `/api/health` responden `200`, la imagen carga y los tres métodos activos se
  muestran correctamente en la verificación móvil de producción.
- Creado un símbolo original CashFlowQba de flechas circulares y confirmación,
  integrado en cabecera, pie, favicon y acceso directo de iOS.
- Añadidas 23 entradas animadas activadas una sola vez mediante
  `IntersectionObserver`, con direcciones y retardos escalonados.
- Añadidos microestados de hover, acercamiento suave del hero y animación de la
  barra de confirmaciones.
- Verificado que los 23 elementos aparecen al recorrer la página, que no existe
  desbordamiento horizontal y que `prefers-reduced-motion` desactiva totalmente
  el movimiento. La auditoría WCAG 2 A/AA continúa sin violaciones.
