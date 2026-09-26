# Especificación de generación — Hero «Nuevos hábitos»

## Objetivo

Crear seis **previews compuestas** para el primer slide (`hero-actual`) del multihero **B2C** de Menos Vueltas: tres direcciones creativas, cada una en desktop y mobile. El hero presenta una selección de nuevos productos para desayunos y meriendas y lleva a la `vista-evento` temporal `campana-nuevos-habitos`.

Cada preview debe incluir el título, la bajada y los CTAs para evaluar la composición completa. Una vez elegida una opción, se editará su preview para retirar sólo esos elementos de interfaz y conservar el mismo arte como imagen de fondo. El código posterior implementará los textos y botones reales para preservar accesibilidad, adaptación responsive e interacción.

## Contrato no negociable

### Entregables

| Archivo | Lienzo exacto | Uso |
|---|---:|---|
| `opcion-1-recorrido-simple-desktop-preview.png` | 1600 × 700 px | Desktop y tablet |
| `opcion-1-recorrido-simple-mobile-preview.png` | 1080 × 1560 px | Mobile |
| `opcion-2-mesa-cotidiana-desktop-preview.png` | 1600 × 700 px | Desktop y tablet |
| `opcion-2-mesa-cotidiana-mobile-preview.png` | 1080 × 1560 px | Mobile |
| `opcion-3-collage-editorial-desktop-preview.png` | 1600 × 700 px | Desktop y tablet |
| `opcion-3-collage-editorial-mobile-preview.png` | 1080 × 1560 px | Mobile |

- Exportar los seis archivos en PNG, con exactamente esas dimensiones; no reutilizar ni recortar automáticamente el desktop para mobile.
- Cada preview debe mostrar exactamente el título, la bajada y los dos CTAs definidos abajo. No mostrar logo de Menos Vueltas, precios, badges, indicadores, navegación, otras interfaces ni marca de agua.
- Usar sólo fotos reales de los envases como referencias de producto. Antes de generar, adjuntar fotografías nítidas de frente de cada envase disponible, indicando que son referencias de producto y que sus etiquetas, colores, marcas y proporciones no se deben alterar.
- Si falta la referencia de un envase, no inventar su packaging, marca ni texto: representarlo mediante ingredientes o no mostrar su envase hasta disponer de la foto real.
- No comunicar atributos nutricionales, médicos o de estilo de vida no confirmados: evitar «fit», «sin culpa», «detox», «light», músculos, gimnasio, suplementos o estética premium.

### Copy y UI de los previews

Las previews deben ubicar este contenido como una maqueta fiel del hero. La siguiente sesión lo implementará como HTML, con la misma jerarquía y ubicación aproximada:

- Título: **Con Menos Vueltas, comer mejor es más simple.**
- Bajada: **Conocé nuestros nuevos ingresos para sumar a tus desayunos y meriendas.**
- CTA principal: **Ver selección** → `vista-evento` B2C.
- CTA secundario: **Ver catálogo** → catálogo B2C normal.

Usar Cabin para el título y DM Sans para bajada y botones. El título puede resolverse en dos o tres líneas en desktop y tres a cinco líneas en mobile; destacar visualmente «Menos» y «más simple» mediante peso, color o relación con el trazo gráfico de cada opción. El CTA principal es un botón sólido oliva y el secundario uno de menor énfasis, de contorno o texto. En mobile los CTAs se muestran apilados.

### Identidad visual

- Fondo cálido principal: `#FAFAF7`.
- Verde oliva: `#6E8B5B`; verde oliva intenso: `#587547`.
- Grafito: `#2F3430`; gris medio: `#6F746E`; bordes suaves: `#C8CCBF`.
- Tono: calmo, próximo, simple y accesible. El resultado debe sentirse como una compra cotidiana mejor resuelta, no como una campaña de nutrición extrema.
- Los seis productos/grupos deben aparecer en la campaña cuando existan referencias; su jerarquía visual es: premezcla de panqueques proteicos, pastas de maní proteica y clásica, mix de frutos secos, galletas Frutigran, huevos caseros y miel líquida.
- La jerarquía sólo afecta la imagen del hero. La `vista-evento` presenta todos los grupos configurados al mismo nivel.

### Zonas de composición de las previews

| Formato | Zona de copy y CTAs | Producto y decoración | Espacio a mantener despejado |
|---|---|---|---|
| Desktop 1600 × 700 | 0–46% del ancho, con fondo sereno y alto contraste | 52–100% del ancho | Banda central inferior: no colocar información clave donde aparecerán los indicadores |
| Mobile 1080 × 1560 | 0–34% de la altura para título y bajada; 79–92% para CTAs | 35–78% de la altura | Último 8% de altura: no ubicar producto ni detalle esencial; allí aparece el indicador |

Los productos no deben quedar tapados por copy o CTAs. Mantener bordes generosos y no cortar paquetes, frascos o ingredientes importantes en los bordes de la imagen. Cuando se retire la interfaz de la opción elegida, estas zonas quedarán como espacio negativo apto para que el código superponga el contenido real.

## Opción 1 — El recorrido se vuelve simple (recomendada)

**Concepto:** la identidad de Menos Vueltas se expresa mediante un recorrido: un trazo oliva hace pequeñas curvas al entrar y termina en una línea simple y clara junto a la selección. Sugiere que elegir productos para comer mejor tiene menos fricción, sin ilustrar un laberinto ni volverse literal.

**Dirección visual:** fotografía editorial de producto real, minimalista, sobre fondo crema cálido. La premezcla de panqueques es el foco más grande; a su alrededor, frascos de pasta de maní, mix de frutos secos, Frutigran, huevos y miel forman una composición ligera. Incluir textura suave de mesa, plato o paño neutro sólo si no compite con los envases. Luz natural suave de mañana, sombras cortas y realistas.

### Prompt desktop

```text
Use case: ads-marketing
Asset type: B2C e-commerce landing-page hero background, exact 1600 x 700 px canvas
Primary request: create a calm editorial product composition for a local grocery campaign about making everyday eating better feel simpler
Input images: attach the supplied product-package photographs as product references; preserve every visible package exactly, including proportions, colors, labels and brands
Scene/backdrop: warm off-white #FAFAF7 tabletop, subtly textured, with a thin olive green #6E8B5B route line that begins with two or three gentle curves and resolves into a clean straight line near the product composition
Subject: real packs of protein pancake mix as the largest focal product; protein and classic peanut butter jars as secondary products; bags of mixed nuts, Frutigran cookies, farmhouse eggs and liquid honey as supporting products
Style/medium: premium but accessible editorial product photography, natural and local, not luxury
Composition/framing: reserve the left 46 percent as quiet negative space for live webpage copy; compose products from the middle to the right with generous margins; leave the lower center visually quiet for carousel indicators
Lighting/mood: soft morning daylight, short realistic shadows, calm and inviting
Color palette: warm cream, olive green, graphite accents, true colors of reference packaging
Text: render this Spanish copy exactly and legibly as a website-hero preview — title “Con Menos Vueltas, comer mejor es más simple.”; subtitle “Conocé nuestros nuevos ingresos para sumar a tus desayunos y meriendas.”; primary button “Ver selección”; secondary button “Ver catálogo”. Use Cabin for the title and DM Sans for subtitle and buttons. Make “Menos” and “más simple” visually prominent, without changing words.
Constraints: exact 1600 x 700 pixels; product photography must match supplied references; show only the specified copy and two buttons; no Menos Vueltas logo, prices, watermark, extra UI, invented labels, gym cues or medical claims
Avoid: generic supermarket shelves, clutter, neon green, dark dramatic lighting, floating food, distorted jars or unreadable fake packaging
```

### Prompt mobile

```text
Use case: ads-marketing
Asset type: B2C e-commerce mobile hero background, exact 1080 x 1560 px canvas
Primary request: create the vertical companion art for the same «simple route» grocery campaign; it must be independently composed for mobile, not a crop of desktop
Input images: attach the supplied product-package photographs as product references; preserve every visible package exactly, including proportions, colors, labels and brands
Scene/backdrop: warm off-white #FAFAF7 with a thin olive green #6E8B5B route line that gently curves and becomes straight beside the products
Subject: protein pancake mix as the dominant focal pack; both peanut butter variants and the remaining selected products as a balanced supporting cluster
Style/medium: clean natural editorial product photography, approachable and not premium
Composition/framing: keep the top 34 percent almost empty for live title and subtitle; position the product scene from 35 to 78 percent of the height; keep 79 to 92 percent calm enough for live buttons; keep the last 8 percent clear for carousel indicators; do not crop important packages
Lighting/mood: soft natural breakfast light, calm and simple
Color palette: warm cream, olive, graphite, authentic reference-pack colors
Text: render this Spanish copy exactly and legibly as a mobile website-hero preview — title “Con Menos Vueltas, comer mejor es más simple.”; subtitle “Conocé nuestros nuevos ingresos para sumar a tus desayunos y meriendas.”; stacked primary button “Ver selección”; stacked secondary button “Ver catálogo”. Use Cabin for the title and DM Sans for subtitle and buttons. Make “Menos” and “más simple” visually prominent, without changing words.
Constraints: exact 1080 x 1560 pixels; show only the specified copy and two stacked buttons; no Menos Vueltas logo, prices, watermark, extra UI, invented labels, gym cues or medical claims
Avoid: desktop crop, busy top area, cluttered composition, distorted packages, neon or overly athletic imagery
```

## Opción 2 — Mesa cotidiana de desayuno y merienda

**Concepto:** una mesa real y apetecible, preparada sin exceso de estilismo. La campaña muestra cómo esos productos se incorporan fácilmente a una rutina: panqueques servidos, tostada o cuchara con pasta de maní, miel y frutos secos. Los envases reales sostienen el reconocimiento de los nuevos ingresos.

**Dirección visual:** fotografía cenital o con ángulo muy alto. Mesa de madera clara o paño de lino crema, con una escena ordenada y vivida. Priorizar la calidez y lo cotidiano por encima de una estética gastronómica perfecta. La premezcla y las pastas de maní deben verse claramente; los demás productos se integran con sus ingredientes o presentaciones reales.

### Prompt desktop

```text
Use case: ads-marketing
Asset type: B2C e-commerce landing-page hero background, exact 1600 x 700 px canvas
Primary request: create a warm, genuine breakfast-and-afternoon-snack table scene that makes new grocery products feel easy to add to an ordinary day
Input images: attach the supplied product-package photographs as product references; preserve every visible package exactly, including proportions, colors, labels and brands
Scene/backdrop: light wood or warm linen table in cream and muted olive tones, photographed from a high three-quarter or top-down editorial angle
Subject: protein pancake mix and peanut butter jars clearly visible among simple prepared food: pancakes, a spoon of peanut butter, liquid honey, nuts, eggs and Frutigran cookies; show the real product packaging naturally, not as fake labels
Style/medium: authentic editorial food photography, local, accessible, relaxed and clean
Composition/framing: reserve the left 46 percent as calm negative space for live webpage copy; build the breakfast scene on the right two-thirds; keep the lower center visually quiet for carousel indicators
Lighting/mood: diffused morning daylight, soft authentic shadows, inviting but not luxurious
Color palette: warm cream, natural wood, olive accents, graphite, true package colors
Text: render this Spanish copy exactly and legibly as a website-hero preview — title “Con Menos Vueltas, comer mejor es más simple.”; subtitle “Conocé nuestros nuevos ingresos para sumar a tus desayunos y meriendas.”; primary button “Ver selección”; secondary button “Ver catálogo”. Use Cabin for the title and DM Sans for subtitle and buttons. Make “Menos” and “más simple” visually prominent, without changing words.
Constraints: exact 1600 x 700 pixels; show only the specified copy and two buttons; no Menos Vueltas logo, prices, watermark, extra UI, fake labels or medical/nutrition claims
Avoid: restaurant plating, extravagant brunch, generic stock-photo smiles, luxury marble, gym or diet imagery, visual clutter
```

### Prompt mobile

```text
Use case: ads-marketing
Asset type: B2C e-commerce mobile hero background, exact 1080 x 1560 px canvas
Primary request: create a vertical, warm breakfast-and-afternoon-snack table scene for the same campaign; independently art direct it for mobile
Input images: attach the supplied product-package photographs as product references; preserve every visible package exactly, including proportions, colors, labels and brands
Scene/backdrop: warm linen or pale wood tabletop with restrained olive accents
Subject: a vertical arrangement led by protein pancake mix and peanut butter, with pancakes, honey, nuts, eggs, Frutigran cookies and their real packages placed naturally in a compact central tabletop composition
Style/medium: authentic natural food and product photography, approachable and simple
Composition/framing: leave the top 34 percent mostly empty and low-detail for live title and subtitle; place the tabletop scene from 35 to 78 percent; preserve a clean 79 to 92 percent CTA zone and an empty final 8 percent for carousel indicators
Lighting/mood: soft morning light, cozy and everyday
Color palette: warm cream, olive, natural wood, true reference-pack colors
Text: render this Spanish copy exactly and legibly as a mobile website-hero preview — title “Con Menos Vueltas, comer mejor es más simple.”; subtitle “Conocé nuestros nuevos ingresos para sumar a tus desayunos y meriendas.”; stacked primary button “Ver selección”; stacked secondary button “Ver catálogo”. Use Cabin for the title and DM Sans for subtitle and buttons. Make “Menos” and “más simple” visually prominent, without changing words.
Constraints: exact 1080 x 1560 pixels; show only the specified copy and two stacked buttons; no Menos Vueltas logo, prices, watermark, extra UI, invented packaging or medical/nutrition claims
Avoid: desktop crop, crowded table, luxury food styling, gym/diet visual language, cropped key products
```

## Opción 3 — Collage editorial de nuevos ingresos

**Concepto:** los productos reales se recortan y ordenan en un collage sobrio, con formas orgánicas, líneas y bloques oliva. Es la alternativa más contemporánea y expresiva: transmite descubrimiento sin abandonar la calma ni la claridad del sitio.

**Dirección visual:** recortes fotográficos de envases reales y algunos ingredientes, con sombras de papel leves y textura de grano casi imperceptible. Las formas deben ser redondeadas y escasas; el resultado nunca debe parecer un flyer saturado ni una campaña deportiva. La premezcla puede superponerse ligeramente a una forma oliva y las pastas de maní construir un segundo plano claro.

### Prompt desktop

```text
Use case: ads-marketing
Asset type: B2C e-commerce landing-page hero background, exact 1600 x 700 px canvas
Primary request: create a restrained editorial collage for a grocery collection of new products that makes everyday eating better feel simple
Input images: attach the supplied product-package photographs as product references; preserve every visible package exactly, including proportions, colors, labels and brands
Scene/backdrop: warm off-white #FAFAF7 field with sparse organic olive #6E8B5B and #587547 shapes, thin graphite line details and extremely subtle paper grain
Subject: clean photographic cutouts of protein pancake mix as focal product, two peanut butter varieties, mixed-nut bags, Frutigran cookies, farmhouse eggs and liquid honey
Style/medium: calm contemporary editorial collage using real product-photo cutouts, subtle paper shadows and natural ingredients only as accents
Composition/framing: reserve the left 46 percent as uncluttered negative space for live copy; layer the collage from center to right; keep the lower center quiet for carousel indicators; use clear visual hierarchy with pancake mix first, peanut butter second
Lighting/mood: bright, calm, graphic and accessible; not loud or youthful-chaotic
Color palette: warm cream, olive, intense olive, graphite, muted gray, authentic package colors
Text: render this Spanish copy exactly and legibly as a website-hero preview — title “Con Menos Vueltas, comer mejor es más simple.”; subtitle “Conocé nuestros nuevos ingresos para sumar a tus desayunos y meriendas.”; primary button “Ver selección”; secondary button “Ver catálogo”. Use Cabin for the title and DM Sans for subtitle and buttons. Make “Menos” and “más simple” visually prominent, without changing words.
Constraints: exact 1600 x 700 pixels; show only the specified copy and two buttons; no Menos Vueltas logo, prices, watermark, extra UI, invented labels, neon, medical claims or gym symbolism
Avoid: torn-paper chaos, sticker overload, busy scrapbook aesthetic, 3D plastic render, distorted packages, luxury fashion mood
```

### Prompt mobile

```text
Use case: ads-marketing
Asset type: B2C e-commerce mobile hero background, exact 1080 x 1560 px canvas
Primary request: create the vertical companion art for the same calm editorial grocery collage; independently compose it for mobile rather than crop the desktop version
Input images: attach the supplied product-package photographs as product references; preserve every visible package exactly, including proportions, colors, labels and brands
Scene/backdrop: warm off-white #FAFAF7 with a few rounded olive shapes, thin graphite line details and barely visible paper texture
Subject: photographic cutouts of protein pancake mix as the central focal item, two peanut butter varieties as the secondary layer, with nuts, Frutigran, eggs and honey balancing the lower part of the collage
Style/medium: minimal contemporary editorial collage, real packaging cutouts, subtle paper shadows, accessible and calm
Composition/framing: leave the top 34 percent almost blank for live title and subtitle; keep the collage in the 35 to 78 percent band; preserve 79 to 92 percent for live CTAs and the final 8 percent for carousel indicators; do not crop any important package
Lighting/mood: bright, composed and simple, never flashy
Color palette: warm cream, olive, intense olive, graphite, authentic package colors
Text: render this Spanish copy exactly and legibly as a mobile website-hero preview — title “Con Menos Vueltas, comer mejor es más simple.”; subtitle “Conocé nuestros nuevos ingresos para sumar a tus desayunos y meriendas.”; stacked primary button “Ver selección”; stacked secondary button “Ver catálogo”. Use Cabin for the title and DM Sans for subtitle and buttons. Make “Menos” and “más simple” visually prominent, without changing words.
Constraints: exact 1080 x 1560 pixels; show only the specified copy and two stacked buttons; no Menos Vueltas logo, prices, watermark, extra UI, fake labels, neon, medical claims or gym symbolism
Avoid: desktop crop, saturated collage, sticker explosion, distorted packaging, cluttered typography-like marks
```

## Revisión antes de elegir una opción

Para cada una de las seis imágenes, confirmar:

1. El archivo tiene el lienzo exacto contratado.
2. El título, la bajada y los CTAs se leen con claridad, conservan contraste suficiente y respetan las zonas contratadas; el área de indicadores no tapa información visual importante.
3. La premezcla de panqueques lidera visualmente; los demás productos siguen el orden de importancia sin omitir referencias disponibles.
4. Todo envase visible coincide con su foto de referencia; fuera del copy contratado no hay textos ni marcas inventadas.
5. La identidad es cálida, oliva, simple y accesible; no parece una campaña de dieta, gimnasio o lujo.
6. La versión mobile es una composición propia, no un recorte del desktop.

## Segunda fase — retirar UI de la opción elegida

Después de que el responsable elija una de las tres opciones, editar sus dos previews (desktop y mobile) con este pedido:

```text
Remove only the title, subtitle and two CTA buttons from this hero preview. Preserve the product composition, package fidelity, backdrop, colors, route lines or collage elements, lighting, shadows, empty space and every crop exactly as they are. Do not add, remove or alter any product, packaging, ingredient, logo on packaging or decorative element. Output the same exact canvas size, without any text, buttons, logo, price, watermark, indicator or UI.
```

Guardar los artes finales como `hero-nuevos-habitos-[opcion]-desktop.png` (1600 × 700 px) y `hero-nuevos-habitos-[opcion]-mobile.png` (1080 × 1560 px). Estos archivos, y no los previews, serán los que use la sesión de implementación.

## Límites de la siguiente sesión

- Generar las seis previews compuestas y guardarlas como candidatas; no modificar código ni activar todavía el hero o la `vista-evento`.
- No completar los `Id_Grupo` ni activar `campana-nuevos-habitos` hasta confirmar cuáles son los IDs reales y que todos están activos en el catálogo B2C.
- Tras elegir un candidato, primero crear sus dos artes finales sin UI según la segunda fase. Recién entonces la sesión de implementación debe integrar texto y botones como HTML, respetar la estructura actual del multihero y verificar desktop y mobile manualmente.
