# Menos Vueltas — Mapa de contexto para IA

Usá este archivo para decidir qué contexto leer según la tarea. No hace falta leer el repositorio completo.

La fuente canónica de las decisiones es `knowledge-base/`. Si una sesión define un cambio permanente de marca, negocio u operación, proponé actualizar el documento canónico correspondiente; no lo des por confirmado sin aprobación explícita.

## 1. Código de la página

Para implementar, revisar o diagnosticar una feature:

1. Leé [AGENTS.md](AGENTS.md).
2. Leé [knowledge-base/README.md](knowledge-base/README.md).
3. Leé los documentos de la KB que correspondan:
   - producto, mensaje o alcance: [01_vision_y_objetivos.md](knowledge-base/01_vision_y_objetivos.md)
   - negocio, canales o precios: [02_descripcion_general.md](knowledge-base/02_descripcion_general.md)
   - JSON, Sheets o Apps Script: [04_modelo_de_datos.md](knowledge-base/04_modelo_de_datos.md)
   - pedidos, promociones, precios, entrega o cobertura: [05_reglas_de_negocio.md](knowledge-base/05_reglas_de_negocio.md)
   - flujos B2C, B2B, admin o WhatsApp: [07_flujos_principales.md](knowledge-base/07_flujos_principales.md)
   - arquitectura o seguridad: [08_arquitectura_propuesta.md](knowledge-base/08_arquitectura_propuesta.md)
   - decisiones vigentes: [09_decisiones_y_supuestos.md](knowledge-base/09_decisiones_y_supuestos.md)
   - políticas todavía sin definir: [10_preguntas_abiertas.md](knowledge-base/10_preguntas_abiertas.md)
4. Recién entonces inspeccioná únicamente los archivos de código involucrados.

`AGENTS.md` es obligatorio y prevalece para cambios en el repositorio.

## 2. Flyers y piezas visuales

Para idear o crear un flyer, no leas código.

Leé:

1. [01_vision_y_objetivos.md](knowledge-base/01_vision_y_objetivos.md).
2. [02_descripcion_general.md](knowledge-base/02_descripcion_general.md).
3. [05_reglas_de_negocio.md](knowledge-base/05_reglas_de_negocio.md), si la pieza menciona precios, promociones, pedido, entrega o cobertura.
4. [09_decisiones_y_supuestos.md](knowledge-base/09_decisiones_y_supuestos.md).
5. [10_preguntas_abiertas.md](knowledge-base/10_preguntas_abiertas.md), para no inventar condiciones aún no definidas.
6. [Brand Book de Canva](https://canva.link/uswg2w73lmk7vpt).

Mantener la identidad vigente: verde oliva, fondo cálido claro, grafito, DM Sans, Cabin, iconografía Tabler, tono calmo y cercano. Los ejes de mensaje son “Compra simple” y “Más tiempo para vos”. No comunicar una propuesta premium ni inventar promociones, precios, envíos, mínimos, horarios o cobertura.

## 3. Consultas de marketing, finanzas o negocio

Para pensar estrategia, marketing, adquisición, precios, operación o métricas, no leas código.

Leé:

1. [01_vision_y_objetivos.md](knowledge-base/01_vision_y_objetivos.md).
2. [02_descripcion_general.md](knowledge-base/02_descripcion_general.md).
3. [05_reglas_de_negocio.md](knowledge-base/05_reglas_de_negocio.md).
4. [09_decisiones_y_supuestos.md](knowledge-base/09_decisiones_y_supuestos.md).
5. [10_preguntas_abiertas.md](knowledge-base/10_preguntas_abiertas.md).

Consultá datos vivos sólo si son necesarios para la pregunta:

- [Planilla operativa](https://docs.google.com/spreadsheets/d/1GV0X4ENyuRLT1Vg2MN6giPdAshPeSCQJ6XXLgVf2krI/edit?usp=sharing): pedidos, ítems, clientes y contactos.
- [Planilla de Finanzas publicada (CSV)](https://docs.google.com/spreadsheets/d/e/2PACX-1vTqQOgQBbu1C3voEJKNLKzAQFdFBR4b_Di43n7YjZVWgEYGLk0as-J-2qZT2yAUnyWqPB4DlNa-xHBH/pub?output=csv): cobros y métricas financieras.

Sheets es la fuente de verdad. Aunque los enlaces sean públicos, nunca copies, expongas ni incluyas datos personales reales en resultados, archivos o código.

## Protocolo de actualización de contexto

Al cierre de cualquier sesión, revisar si se tomó una decisión potencialmente permanente sobre marca, negocio, operación, arquitectura, datos, reglas o mensajes de la web.

1. Distinguir las ideas, hipótesis o recomendaciones de las decisiones que el responsable confirmó explícitamente.
2. Si sólo hay ideas o recomendaciones, no modificar `knowledge-base/`; resumirlas como propuestas pendientes.
3. Si hay una decisión confirmada, indicar el o los archivos canónicos exactos que deberían actualizarse y describir brevemente el cambio propuesto.
4. Esperar una confirmación explícita del responsable antes de editar cualquier archivo de contexto.
5. Tras la confirmación y la actualización, informar qué archivo se modificó.

Los documentos canónicos se eligen según el alcance: visión y mensajes en `knowledge-base/01_vision_y_objetivos.md`; negocio y canales en `knowledge-base/02_descripcion_general.md`; datos en `knowledge-base/04_modelo_de_datos.md`; reglas operativas en `knowledge-base/05_reglas_de_negocio.md`; funcionalidades en `knowledge-base/06_funcionalidades.md`; flujos en `knowledge-base/07_flujos_principales.md`; arquitectura en `knowledge-base/08_arquitectura_propuesta.md`; y decisiones o supuestos en `knowledge-base/09_decisiones_y_supuestos.md`.

## Regla transversal

Distinguir siempre entre:

- hechos y reglas confirmadas en `knowledge-base/`;
- ideas, hipótesis o recomendaciones de la sesión;
- políticas que siguen abiertas y requieren consulta al responsable.

No cambiar Sheets, Apps Script, precios, márgenes, promociones, datos personales, permisos o reglas operativas sin aprobación explícita.
