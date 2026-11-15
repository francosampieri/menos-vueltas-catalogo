# Spec de producción — flyer de captación Menos Vueltas

**SUSTITUIDA — no ejecutar esta dirección.** El responsable descartó la escena de entrega y pidió regenerar el flyer de presentación con celular. Usar exclusivamente `docs/spec-flyer-presentacion-promo-whatsapp-2026-11.md` como spec vigente. Lo siguiente se conserva sólo como historial.

Fecha: 14/11/2026. Encargo: crear en otra sesión un flyer estático final, no una campaña publicada. Esta spec consolida las instrucciones actuales del responsable y prevalece sobre alternativas anteriores de los documentos de planificación.

**Revisión posterior al primer resultado rechazado:** rehacer la dirección visual desde la composición fotográfica. El responsable rechaza el retrato de la mujer, la separación foto/texto en paneles y la sobrecarga gráfica. La nueva dirección es una foto a sangre de un intercambio de bolsa entre manos, con texto integrado sobre zonas tranquilas de esa misma foto, logo arriba centrado y web abajo centrada, siguiendo la estructura de los flyers de reconocimiento. Retirar MENDOZA. No intentar corregir el resultado rechazado conservando su layout.

## 1. Objetivo y alcance

Crear una pieza para Feed de Facebook e Instagram que invite a iniciar una conversación por WhatsApp para pedir la promoción. Público: mujeres de 30–55 años en la cobertura local alrededor de Carrodilla, Mendoza. La pieza debe funcionar sin haber visto la campaña de reconocimiento.

Estructura elegida: **Presentación + Beneficio + Oferta + CTA**, con menos peso gráfico y aire entre elementos. Escena fotográfica: primer plano de una bolsa de compra pasando entre manos, con productos reales del catálogo. La bolsa es protagonista; no mostrar mujeres posando, rostros ni cuerpos completos. Sin desarrollar dolores ni comparaciones con ir al supermercado.

Producir una sola dirección visual, con un único repaso final de legibilidad, textos y fidelidad de productos. Hacer correcciones puntuales si hay errores; no generar una batería de conceptos o pruebas A/B. No publicar, configurar anuncios, recargar saldo ni cambiar web, Sheets, promociones o KB.

## 2. Texto exacto y jerarquía

Estos son los únicos textos comerciales del flyer, además del logo y el contacto de WhatsApp:

```text
La compra del súper,
más simple.

Comprá desde tu celu
Recibí en tu domicilio
Sin compra mínima

Solo por esta semana

10% OFF + ENVÍO GRATIS

Reclamá tu promo

menosvueltas.com.ar
```

- **No incluir «En tu primera compra»**: el responsable pidió expresamente retirarlo del flyer. No reintroducir esa frase como subtítulo, asterisco o letra pequeña.
- **No incluir MENDOZA ni otro rótulo geográfico por ahora.** El responsable decidirá su eventual incorporación después; tampoco sustituirlo por Carrodilla en el arte.
- No agregar «Almacén, limpieza y más», preguntas sobre dolores, listas de productos/precios, otras promesas, condiciones, QR ni textos nuevos.
- Conservar acentos, voseo, marca y dominio exactos. Los saltos de línea pueden adaptarse a la composición sin cambiar las palabras. El titular debe conservar dos líneas si favorece la lectura.
- Logo horizontal auténtico arriba **centrado**, con escala y márgenes similares a los flyers originales. No alinearlo en una esquina junto a otra cabecera.
- Beneficios en tres renglones compactos y secundarios, sin iconos grandes ni tres módulos separados. No repetirlos en otros bloques. «Comprá desde tu celu» sustituye por completo «Armá tu compra desde tu celu».
- «Solo por esta semana» como una línea discreta cercana a la oferta, sin pastilla, cinta, sello o contenedor llamativo. No debe convertirse en un tercer titular dominante.
- «10% OFF» y «ENVÍO GRATIS» deben ser protagonistas y ambos legibles, con el signo +. No relegar envío gratis a letra pequeña.
- «Reclamá tu promo» y el número comercial juntos, como texto integrado en la foto con un único icono pequeño de WhatsApp. No dibujar un botón, tarjeta ni gran pastilla alrededor. El número es texto, no un botón funcional dentro del archivo de imagen.
- Contacto: usar **el mismo número comercial que figura en el pie de `flyer.gondola.png`**, referencia identificada en §3 y coincidente con el aportado por el responsable en este chat. Leerlo visualmente y colocarlo en el arte final; puede formatearse en grupos legibles. No inventarlo, cambiarlo ni dejar un placeholder. No transcribirlo a documentación, logs, pruebas o commits; esta spec evita replicarlo conforme a las instrucciones del proyecto.
- Dominio abajo **centrado**, en un pie sobrio sobre la misma fotografía, como las referencias de reconocimiento. No encerrarlo con el CTA en un panel lateral ni una franja sólida. Contacto y CTA también secundarios respecto de titular/oferta, sin competir entre sí.

## 3. Identidad y referencias obligatorias

Leer AGENTS.md y las instrucciones de las skills aplicables (`ad-creative` e `imagegen`) en la sesión ejecutora. Para esta producción usar los activos de marca existentes, sin rediseñar el logo.

Logo original horizontal, ya disponible:

`C:/Users/franc/Desktop/Menos Vueltas/Logos/png/logo_completo_1000x340.png`

Alternativa vectorial de marca:

`C:/Users/franc/OneDrive/Documentos/GitHub/catalogo-page/shared/assets/logos/logo.svg`

Referencias de identidad, fotografía y contacto; no son fondos a modificar ni ejemplos de copy que deba copiarse:

- `C:/Users/franc/Desktop/Menos Vueltas/Flyers/Deberia ser mas simple/flyer.gondola.png`
- `C:/Users/franc/Desktop/Menos Vueltas/Flyers/Deberia ser mas simple/flyer.fila2.png`
- `C:/Users/franc/Desktop/Menos Vueltas/Flyers/Deberia ser mas simple/flyer.bolsas.png`
- `C:/Users/franc/Desktop/Menos Vueltas/Flyers/Deberia ser mas simple/flyer.sillon.png`

Tomar los flyers de reconocimiento como referencias de **estructura**, no sólo de paleta: fotografía completa de fondo, logo blanco centrado arriba, texto directamente sobre foto y web centrada abajo. Tratamiento fotográfico cálido, natural y desaturado con tonalidad oliva; blanco para lectura y verde claro como acento moderado. El crema o grafito pueden pertenecer al entorno real, nunca convertirse en paneles gráficos separados. DM Sans/Cabin. Usar versión monocroma blanca del logo auténtico; si se adapta el SVG, cambiar únicamente el color de relleno, conservando intactos los trazos, proporciones y composición de marca. No redibujarlo con IA. Estética sobria y cercana.

## 4. Composición y escena

Formato final **cuadrado 1:1**, como las piezas existentes. Entregar PNG de al menos 1080 × 1080, a mayor resolución si la herramienta lo permite. No producir Stories, hero web ni otras proporciones salvo pedido posterior.

**Una sola fotografía continua ocupa el 100% del lienzo, de borde a borde.** Diseñar sus espacios negativos desde la generación: superficies reales de la entrada (pared con textura sutil, puerta desenfocada, sombras suaves) y distribución de luz que permitan leer el texto. El espacio negativo pertenece a la foto, no es un rectángulo blanco ni un fondo liso añadido al costado. No recortar la foto como una ilustración flotante.

Propuesta de encuadre para orientar la producción, sin imponer un mosaico de bloques:

1. Arriba: zona tranquila de la fotografía para logo centrado, sin rostro ni producto detrás.
2. Mitad central izquierda: bolsa en primer plano, con manos y antebrazos entrando desde bordes opuestos y algunos envases reconocibles. Que se entienda el traspaso y que la bolsa conserve volumen y peso creíbles. Encuadre cercano y cinematográfico, con fondo suave.
3. Sector derecho: espacio natural de la misma escena para titular y beneficios compactos; oferta cercana, con aire y sin tapar bolsa/manos. No imponer un corte vertical entre foto y texto. Si otro encuadre integra mejor todos los elementos, ajustar manteniendo esta jerarquía.
4. Zona baja: CTA y contacto discretos, dominio centrado al fondo del pie. La foto continúa detrás de todo, también detrás de la oferta.

Mostrar **sólo manos/antebrazos y la bolsa** como acción humana. Las personas quedan fuera de cuadro; no hay rostro, cabeza, retrato, torso protagonista ni mujer sonriendo. Manos anatómicamente plausibles y postura de entrega natural. Bolsa de papel neutra, de tamaño cotidiano, no una bolsa gigante usada como exhibidor. Dos a cuatro productos visibles, con oclusión y orientación naturales; el resto puede quedar oculto. Sin envases gigantes, marcas deformadas ni todas las etiquetas alineadas hacia cámara.

Luz diurna cálida y difusa, sombras con matiz oliva, fotografía con textura realista. Legibilidad mediante el encuadre, el fondo desenfocado y, si es necesario, un oscurecimiento suave/gradual integrado sobre la foto. Nunca usar panel blanco/crema de texto, franja inferior sólida, formas curvas, cajas opacas, contornos, botones simulados o grandes pastillas. No usar iconos de celular/camión/carrito de gran tamaño: el único icono necesario es el de WhatsApp junto al contacto.

**Descomprimir:** sólo titular y oferta tienen jerarquía alta. Beneficios, urgencia y CTA deben ser compactos, con espacio entre grupos. El tamaño no debe hacer que todos los textos griten. Conservar todo el copy solicitado sin agregar explicaciones; no quitar más textos por cuenta propia para aliviar la composición.

No agregar celular, vehículos, mascotas o escenografía innecesaria. No insinuar entrega inmediata o en el día. Toda compra visible, incluso en el fondo, debe cumplir §5.

## 5. Productos: lista cerrada y fotos locales

Carpeta única de referencias de productos:

`C:/Users/franc/Desktop/Menos Vueltas/Fotos flyer-traccion`

El responsable permite elegir un subconjunto y repetir unidades de un producto autorizado. **No usar productos, variantes, marcas ni artículos que estén fuera de esta lista**, ni como relleno de bolsa, fondo o decoración. Tampoco añadir frutas, verduras, pan, lácteos u otros alimentos no listados. Bolsas y embalajes de transporte neutros sí son parte de la escena, no productos adicionales.

| Producto autorizado por el responsable | Archivo local |
|---|---|
| Aceite girasol Natura 1,5 l | `3-natura-aceite-girasol-1-5-l.webp` |
| Arroz Gallo Parboil 500 g | `587-gallo-oro-arroz-parboil-500-g.webp` |
| Puré de tomate De la Huerta 530 g | `279-de-la-huerta-pure-de-tomates-530-g.webp` |
| Champiñones laminados CUMANA 400 g | `126-cumana-champinones-laminados-400-g.webp` |
| Fideos tallarines Lucchetti 500 g | `585-lucchetti-fideos-tallarin-500-g.webp` |
| Harina 000 Morixe 1 kg | `476-morixe-harina-000-1-kg.webp` |
| Mayonesa Natura 500 g | `14-natura-mayonesa-500-cc.webp` — **omitir por discrepancia descrita abajo** |
| Café tostado Cabrales Super 250 g | `cabrales-250g-super.webp` |
| Yerba mate La Merced Campo y Monte 500 g | `201-la-merced-yerba-mate-campo-y-monte-500-g.webp` |
| Toalla normal Nosotras 8 u | `320-nosotras-toalla-normal-bob-con-cale-8u-8-u.webp` |
| Lavandina Sedile 2 l | `402-sedile-lavandina-comun-2-l.webp` |
| Papel higiénico Elegante SH 4×80 | `365-elegante-papel-higienico-4x30m-simple-hoja-4x30m.webp` — **omitir por discrepancia descrita abajo** |

**Discrepancias comprobadas visualmente:** la foto de mayonesa indica 500 cm³/475 g y la del papel dice cuatro rollos de 30 m. No corresponden exactamente a 500 g y 4×80 indicados por el responsable. Como ambos son opcionales, omitirlos y avanzar con los otros diez productos, sin reinterpretar medidas ni inventar envases. Sólo reincorporarlos si el responsable aporta referencias correctas o confirma expresamente la equivalencia.

Selección inicial recomendada para una bolsa creíble: aceite Natura, arroz Gallo, tallarines Lucchetti, yerba La Merced y café Cabrales. Es una propuesta, no obligación de mostrar cinco marcas enteramente visibles. Puede simplificarse a tres o cuatro de éstos o elegir otros de los diez utilizables. No es necesario usar todos ni mostrar las etiquetas completas.

El agente debe abrir e inspeccionar las fotos de los productos que vaya a usar. Pasarlas como referencias visuales reales al generador; no confiar sólo en escribir los nombres. Conservar identidad, forma, color, variedad y tamaño relativo de los envases. Permitir oclusión y perspectiva naturales; no inventar etiquetas, tamaños o logotipos. Si no se logra fidelidad, corregir de forma puntual o usar menos productos.

## 6. Proceso de producción

Usar la herramienta de generación de imágenes disponible conforme a la skill `imagegen`, con las fotos de producto seleccionadas como referencias y las piezas previas como referencias de estilo. No usar un proceso de programación para sustituir la creación de la fotografía solicitada.

Flujo preferido: generar primero la escena fotográfica **a sangre, sin rostros y con espacios negativos reales para el texto**, y después completar el flyer con logo auténtico y todos los textos exactos directamente sobre esa foto. No resolver falta de espacio agregando un lateral blanco ni una franja sólida inferior: si la fotografía no admite texto, corregir su encuadre. Seguir las capacidades e instrucciones vigentes de la herramienta. El resultado solicitado es el **flyer terminado**, no sólo un fondo ni un prompt.

No sobrescribir fotos, logo ni flyers anteriores. Guardar resultados en:

`C:/Users/franc/Desktop/Menos Vueltas/outputs/flyer-traccion-2026-11/`

Nombre propuesto: `flyer.traccion.v1.png`; si ya existe, usar siguiente versión libre. Conservar el fondo de la escena si se generó por separado. El archivo final debe quedar en el workspace, no únicamente en una ruta temporal del generador.

## 7. Único repaso final y entrega

Revisar el flyer completo y una vista reducida de tamaño similar a un teléfono:

- Están todos los textos exactos, incluido «Comprá desde tu celu»; no aparece «En tu primera compra», MENDOZA ni otra frase agregada.
- Logo arriba centrado y web abajo centrada; fotografía a sangre detrás de todos los elementos. Sin mujer/retrato/rostros, panel de texto blanco, cinta curva inferior, botones o pastillas.
- Bolsa y pasaje entre manos protagonistas, dos niveles principales de texto (titular/oferta) y beneficios/urgencia/CTA secundarios. Aire suficiente; el resultado no reproduce la densidad del flyer rechazado.
- Logo auténtico y sin deformación; ortografía y número comercial revisados contra su referencia.
- Sólo productos permitidos y utilizables, con envases creíbles; manos y entrega naturales.
- Oferta, CTA y pie sin cortes ni superposiciones. «Sin compra mínima» y envío gratis legibles.

Si hay un error concreto, corregirlo; no devolverlo como final. Entregar imagen inline y enlace absoluto al PNG, más una breve lista de productos usados y confirmación del texto. No guardar el número comercial en informes auxiliares ni commits. No publicar ni subir a Meta.

## 8. Contexto comercial para el agente, fuera del flyer

La promoción **sigue limitada a primera compra**, sin mínimo. El 10% excluye productos que ya tienen promoción. El responsable pidió omitir esas dos condiciones del arte y explicarlas fuera de él: en el copy del anuncio y en WhatsApp, antes de confirmar el pedido. Quitar el texto del flyer no cambia las reglas comerciales ni habilita prometer «10% en todo» o descuento acumulable.

El acceso se obtiene consultando antes del jueves 19/11/2026 a las 10:00 de Argentina; no hace falta confirmar la compra antes de esa hora. «Solo por esta semana» refiere a esa ventana de consulta. No inventar otro vencimiento ni entrega inmediata. La promo ya está implementada con códigos según el responsable: no tocar el sistema ni reabrir su validación para crear esta pieza.

## Prompt corto para iniciar la otra sesión

Rehacé el flyer siguiendo la revisión actual de `C:/Users/franc/OneDrive/Documentos/GitHub/catalogo-page/docs/spec-flyer-traccion-whatsapp-2026-11.md`. La versión previa fue rechazada: no conserves su retrato, layout dividido ni sobrecarga gráfica. Creá una fotografía a sangre de una bolsa pasando entre manos, con foco en la bolsa y sin rostros ni personas completas. Generá espacios negativos dentro de la propia escena para integrar todos los textos directamente sobre ella, con logo blanco auténtico arriba centrado y web abajo centrada como los flyers de reconocimiento. Sin paneles blancos, franjas sólidas, cintas curvas, botones, grandes iconos o pastillas. Quitá MENDOZA y «En tu primera compra»; usá «Comprá desde tu celu». Conservá los demás textos exactos de la spec. Usá exclusivamente productos y fotos autorizados, omitiendo las dos referencias discrepantes; pocos envases visibles y fieles a sus fotos. Obtené el contacto comercial del pie del flyer de referencia indicado, sin replicarlo en documentación. Entregá una única dirección visual corregida en PNG final completo, guardado como nueva versión en el workspace y mostrado inline. No publiques ni cambies el sitio.
