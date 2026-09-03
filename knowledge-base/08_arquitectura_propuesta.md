# Arquitectura actual y dirección futura

## Arquitectura actual verificada

```text
Google Sheets (fuente de verdad)
  ├─ Productos + Grupos + Precios B2C/B2B, publicados como CSV
  │    └─ GitHub Actions, cada 30 minutos o manual
  │         ├─ shared/catalogo.json
  │         └─ admin/productos.json
  │              └─ repositorio y despliegue web
  │                   ├─ B2C: menosvueltas.com.ar
  │                   ├─ B2B: mayorista.menosvueltas.com.ar
  │                   └─ Admin estático
  └─ Pedidos + Items + Clientes + Contactos
       └─ Google Apps Script como aplicación web
            └─ panel admin y captura de contactos desde la web
```

### Frontend público

| Ruta | Propósito |
|---|---|
| `b2c/` | Sitio de compra para consumidor final |
| `b2b/` | Sitio de catálogo y compra mayorista, en preparación comercial |
| `admin/` | Panel de pedidos y clientes |
| `shared/` | JavaScript, estilos, imágenes y catálogo generado compartidos |

B2C y B2B comparten el motor de catálogo y carrito en `shared/app.js`. La política de envío se aplica sólo a B2C: el mismo cálculo debe alimentar el carrito, el mensaje de pedido y la transferencia por QR; el QR conserva productos y cantidades, y recalcula el envío al abrirse en el teléfono. El carrito crea un mensaje de pedido para WhatsApp. En escritorio contempla abrir WhatsApp Web o transferir el pedido al teléfono mediante QR; en móvil abre WhatsApp directamente.

### Actualización del catálogo

`.github/workflows/actualizar-catalogo.yml` se ejecuta cada 30 minutos y puede iniciarse manualmente. Descarga los CSV públicos de Productos, Grupos y Precios; produce el catálogo completo y una versión reducida para el panel; valida que no exista una proporción anormal de productos B2C activos sin precio; y hace commit y push de los JSON cuando detecta cambios.

### Panel administrativo

El panel estático carga pedidos y clientes desde Apps Script, consume `admin/productos.json` para buscar y calcular, y permite gestionar pedidos y fichas de clientes. Para B2C, conserva `Envio` como componente propio del pedido y totaliza productos netos + envío + extras; el importador de WhatsApp debe reconocer ese componente. El Apps Script debe resolver la columna por encabezado, preservando registros históricos sin valor y sin backfill. Incluye preparación de lista agregada para el proveedor, importación de mensajes de WhatsApp y recuperación local de borradores. No reemplaza la planilla de Finanzas como registro de cobros reales.

## Seguridad actual: estado conocido

La seguridad actual es básica y debe considerarse un riesgo conocido, no una solución definitiva.

- El acceso administrativo usa una comprobación en navegador basada en un hash expuesto en `admin/admin.js`.
- El propio HTML advierte que esa medida no protege datos sensibles.
- El Apps Script se publica como endpoint web y su URL está en el frontend.
- El workflow consume CSV públicos de catálogo.
- `noindex, nofollow` en admin no es control de acceso.
- El catálogo generado contiene información comercial que no fue diseñada necesariamente como privada.

No incluir PII real en documentación, issues, ejemplos, pruebas, capturas ni commits. Todo cambio que aumente la exposición de teléfonos, direcciones, pedidos, clientes o credenciales requiere consulta previa.

## Decisiones para el presente

Mientras el volumen sea bajo, priorizar:

1. bajo costo;
2. rapidez de implementación;
3. continuidad de la operación manual;
4. compatibilidad con Sheets y Apps Script existentes;
5. mejoras incrementales y reversibles.

No proponer migraciones complejas, pagos integrados, inventario en tiempo real, optimización de rutas o CRM como requisitos actuales.

## Dirección objetivo futura

Existe intención de reconstruir la página con buenas prácticas en un futuro cercano, después de comprender el sistema actual y avanzar con funcionalidades concretas. La evolución debe separar presentación, reglas comerciales, integraciones y administración; documentar contratos de datos antes de cambiarlos; introducir autenticación real para administración; preservar el histórico de precios, costos y pedidos; mantener B2C y B2B diferenciados; y añadir pruebas y validaciones a cálculos comerciales críticos.

La migración debe ser gradual y solo definirse luego de acordar alcance, presupuesto, datos a conservar y ventana de operación.

## Criterio para nuevas funcionalidades

Antes de desarrollar, confirmar qué canal afecta; si modifica Sheets, Apps Script, JSON generado o solo interfaz; qué valores deben conservarse históricamente; si toca información personal o acceso administrativo; y si altera una regla comercial que hoy controla manualmente el dueño.

Precios, promociones, costos, estructura de Sheets, datos de clientes y seguridad requieren explicitar impacto y pedir confirmación antes de cambiar reglas.
