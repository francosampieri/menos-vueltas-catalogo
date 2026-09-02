# Menos Vueltas — Instrucciones para Agentes

Estas instrucciones aplican a todo cambio en este repositorio. `CLAUDE.md` debe mantenerse idéntico a este archivo.

## Stack tecnológico

| Capa | Tecnología | Notas |
|---|---|---|
| Sitios públicos | HTML, CSS y JavaScript vanilla | `b2c/`, `b2b/` y recursos compartidos en `shared/` |
| Panel operativo | HTML, CSS y JavaScript vanilla | `admin/` |
| Datos de catálogo | Google Sheets → CSV → JSON | Sheets es la fuente de verdad |
| Operación | Google Apps Script + Google Sheets | Pedidos, ítems, clientes y contactos |
| Publicación de catálogo | GitHub Actions | Regenera JSON cada 30 minutos |

No hay framework, gestor de paquetes, build ni test runner versionado en el repositorio.

## Base de conocimiento

Antes de editar, leer siempre [knowledge-base/README.md](knowledge-base/README.md) y los documentos relevantes.

| Documento | Leer antes de |
|---|---|
| [01_vision_y_objetivos.md](knowledge-base/01_vision_y_objetivos.md) | Cambios de producto, mensajes o alcance |
| [02_descripcion_general.md](knowledge-base/02_descripcion_general.md) | Cambios de negocio, canales o precios |
| [03_actores_y_roles.md](knowledge-base/03_actores_y_roles.md) | Cambios de admin, clientes o roles |
| [04_modelo_de_datos.md](knowledge-base/04_modelo_de_datos.md) | Cambios de JSON, Sheets o Apps Script |
| [05_reglas_de_negocio.md](knowledge-base/05_reglas_de_negocio.md) | Pedidos, precios, promociones, entrega y cobertura |
| [06_funcionalidades.md](knowledge-base/06_funcionalidades.md) | Priorización y alcance de features |
| [07_flujos_principales.md](knowledge-base/07_flujos_principales.md) | Flujos B2C, B2B, admin y WhatsApp |
| [08_arquitectura_propuesta.md](knowledge-base/08_arquitectura_propuesta.md) | Arquitectura, integraciones y seguridad |
| [09_decisiones_y_supuestos.md](knowledge-base/09_decisiones_y_supuestos.md) | Límites de autonomía y decisiones vigentes |
| [10_preguntas_abiertas.md](knowledge-base/10_preguntas_abiertas.md) | Cualquier cambio que dependa de una política aún no definida |

## Estado del negocio

- B2C está activo en `menosvueltas.com.ar`.
- B2B está visible, pero comercialmente en preparación. Mantenerlo separado de B2C.
- El pedido se inicia en la web y se confirma por WhatsApp.
- No existe stock propio en tiempo real: se compra contra pedido.
- La prioridad actual es velocidad y bajo costo, manteniendo cambios pequeños y reversibles.
- La futura reconstrucción con buenas prácticas es una intención; no es parte de una feature puntual salvo aprobación explícita.

## Reglas duras

- NUNCA introducir frameworks, dependencias, backend o sistema de build → mantener HTML/CSS/JS vanilla hasta aprobación explícita.
- NUNCA cambiar Google Sheets, Apps Script, fórmulas, estructura de columnas, URLs, permisos, precios, márgenes o promociones → explicar el impacto y pedir aprobación explícita.
- NUNCA incluir teléfonos, direcciones, nombres de clientes u otros datos personales reales en código, fixtures, logs, documentación, pruebas o commits.
- NUNCA mezclar clientes, precios, métricas o reglas de B2C y B2B → preservar su separación por canal.
- NUNCA interpretar “precio mayorista” como precio B2B → es un descuento por cantidad del mismo producto.
- NUNCA inventar costos de envío, mínimos de compra, horarios, disponibilidad, stock o sustituciones → consultar antes de codificar una regla.
- NUNCA rediseñar libremente B2C → respetar el Brand Book: verde oliva, fondo claro cálido, grafito, DM Sans, Cabin, iconos Tabler, tono calmo y cercano; los mensajes centrales son “Compra simple” y “Más tiempo para vos”. Proponer apartarse de esto sólo si el usuario pide una pieza de mayor impacto o distinta.
- NUNCA dar una feature por terminada sin verificarla manualmente → probar el flujo afectado; si toca interfaz, revisar desktop y mobile. Informar qué se verificó y qué no.
- NUNCA asumir que un pedido del panel equivale a un cobro real → Finanzas conserva el registro operativo de cobros reales.

## Flujo para implementar una feature

1. Leer la KB relevante y el código involucrado.
2. Explicar en pocas líneas el flujo actual, los archivos que se modificarían y cualquier decisión de negocio pendiente.
3. Implementar el cambio mínimo compatible con la estructura existente.
4. Probar manualmente el flujo afectado; incluir B2C, B2B o admin sólo cuando corresponda.
5. Resumir cambios, verificación y cualquier pregunta que siga bloqueando una decisión.

## Roadmap y skills

No existe `CHANGES.md` ni un registro de skills específico del repositorio. No crear un roadmap ni asumir una skill local sin una solicitud explícita. Para cada feature, usar esta KB y el código real como contexto principal.
