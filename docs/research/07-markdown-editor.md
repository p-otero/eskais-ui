# 07 · MarkdownEditor: CodeMirror 6 con vista previa en vivo

Pregunta del spike: ¿sirve CodeMirror 6 (CM6) con decoraciones como base de un `MarkdownEditor` agent-native, o conviene un editor de árbol (ProseMirror, Tiptap, Milkdown)? La respuesta fue CM6 (abajo, «Comparación»). Este documento recoge además la versión publicada: el modelo de revelado tipo Typora, los items del registry y las cifras nuevas. Código en `registry/ui/markdown-*.ts(x)`, sección «Markdown editor» del showcase. Cifras medidas en la rama `markdown-editor` (2026-11-16).

## Diseño

- **El documento es el texto Markdown.** CM6 guarda el texto tal cual, así que cargar y serializar devuelve los mismos bytes por construcción.
  - `lineSeparator` se fija por documento: CRLF si todo el archivo es CRLF y `\n` en cualquier otro caso, así los finales mezclados también se conservan.
  - Se serializa con `state.sliceDoc()`. `Text.toString()` une siempre con `\n` y rompía los CRLF.
- **Vista previa = decoraciones.** Nada de lo que se ve cambia el texto: ocultar, estilar y pintar widgets son decoraciones. Hay dos capas:
  - Un `ViewPlugin` (`markdown-editor-preview.ts`, `-inline.ts`, `-structure.ts`) que solo recorre el viewport: marcas en línea, prefijos de línea, bloques de código, tablas en edición.
  - Un `StateField` (`markdown-editor-blocks.ts`) para lo que un plugin no puede hacer: el widget de bloque de las tablas y ocultar el subrayado setext, que cruza un salto de línea. Solo recorre los nodos de primer nivel (y los contenedores), así que cuesta poco en documentos largos.
- **Parser:** el lenguaje se construye directamente sobre `commonmarkLanguage.parser` con Table, TaskList, Strikethrough y una extensión Lezer `Wikilink`. No se usa `markdown()`, que siempre arrastra lang-html, lang-css y lang-javascript: unos 200 KB min. `MarkdownView` reutiliza el mismo parser.
- **Menús:** `TriggerMenu` de UI SDK con un adaptador de editor (`TextEditorAdapter`) para `/` y `[[`. La barra es un `Toolbar` de UI SDK; el estilo de bloque y el desbordamiento son `Menu`; el chip de lenguaje es un `Popover` con `Input` y `Button`. No hay ningún `role=` hecho a mano.
- **Widgets con controles:** el chip de lenguaje y la tabla se pintan con React a través de portales (`markdown-editor-portals.tsx`). El widget de CM6 crea el nodo y lo registra en un `PortalStore`; el editor lo lee con `useSyncExternalStore`. Así los controles dentro del contenido también son partes de UI SDK.

## Modelo de revelado (tipo Typora)

El spike mostraba en crudo toda la línea con cursor (el modelo antiguo de Obsidian). La versión publicada no lo hace nunca. Reglas:

| Sintaxis                                                         | Fuera del cursor                                         | Con el cursor                                                                                                |
| ---------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Títulos ATX (`#`, `##`…, y los `#` de cierre)                    | ocultos; el nivel es el estilo                           | siguen ocultos. El nivel se cambia con la barra, el menú `/`, Mod+Alt+0..6 o la acción `setHeading`          |
| Subrayado setext (`===`, `---`)                                  | oculto (la línea entera desaparece)                      | solo se ve si el cursor está en la propia línea del subrayado, para poder escribirlo sin que se esfume       |
| `**`, `*`/`_`, `~~`, `` ` ``, `[`, `](url "título")`, `<…>`, `\` | ocultos                                                  | se ven solo los del tramo que toca la selección (dentro o en el borde); los demás de la línea siguen ocultos |
| Wikilinks `[[slug\|etiqueta]]`                                   | etiqueta (o la del resolver), `text-link` o discontinuo  | `[[`, `\|` y `]]` visibles en ese wikilink                                                                   |
| Viñetas `-`, `*`, `+`                                            | widget de viñeta según la profundidad                    | igual; nunca se ve el carácter                                                                               |
| Listas ordenadas                                                 | se ve su número (texto, atenuado)                        | igual                                                                                                        |
| Tareas `[ ]`/`[x]`                                               | casilla                                                  | igual                                                                                                        |
| Citas `>`                                                        | barra a la izquierda                                     | igual                                                                                                        |
| Vallas de código ` ```lang `                                     | bloque con un chip de lenguaje; la valla de cierre vacía | la línea de la valla se ve en crudo solo si el cursor está en ella                                           |
| Regla `---`                                                      | línea horizontal                                         | el texto se ve con el cursor en la línea                                                                     |
| Tablas                                                           | tabla de verdad (widget)                                 | el texto con pipes, con las columnas alineadas, cabecera en negrita y fuente proporcional                    |

Detalles:

- **El cursor no se mete en los prefijos ocultos.** La sangría, la viñeta, los `>` y los `#` de una línea forman un rango atómico (`EditorView.atomicRanges`). Un filtro de transacciones (`caretOutOfPrefix`) lleva un cursor vacío que cae dentro al principio del texto. Si el cursor venía del principio del texto hacia atrás, salta a la línea anterior en vez de quedarse atascado.
- **Retroceso al principio del texto** quita el marcador más interno: la casilla, luego la sangría de un elemento anidado (sale un nivel), luego la viñeta o el número, el título o la cita. Así no se borran todas las marcas ocultas de golpe.
- **Tab y Shift+Tab** anidan y desanidan elementos de lista (con sus hijos), a la columna del contenido del hermano anterior o del padre. Fuera de una lista no se capturan: el foco sale. Dentro, Escape y luego Tab sale (el `tabFocusMode` de CM6).
- **Alineado de tablas en edición.** Cada celda es un `inline-block`. En la fase de medida se lee el ancho natural del texto de cada celda con un `Range` (no con la caja, así el `min-width` no se realimenta) y se aplica el máximo de la columna con el CSSOM (`style.minWidth`), porque un atributo `style` lo bloquea una CSP estricta. Las tablas dentro de citas o listas no se convierten en widget (sus líneas llevan `>` o sangría); siempre se ven alineadas en texto.
- **Edición por celdas: trabajo futuro.** Pulsar una celda del widget pone el cursor en esa celda del texto, y la tabla pasa a modo texto. No hay navegación con Tab entre celdas, ni añadir o quitar filas y columnas.
- **El texto nunca cambia** al cargar, mover el cursor o revelar: el corpus de fidelidad lo comprueba visitando cada línea con cursor y con selección.

## Accesibilidad

- El contenido es un `role=textbox` con `aria-multiline`, el nombre de `label` y `aria-describedby` hacia una pista de uso (`labels.usageHint`, sustituible): «Markdown. Las marcas de formato quedan ocultas hasta que el cursor entra en el texto con formato. Escribe / para bloques. Pulsa Escape y luego Tab para salir del editor.»
- **Qué lee un lector de pantalla.** Las decoraciones `replace` quitan el texto oculto del DOM, así que el texto accesible es el visible:
  - Un título se lee como su texto, sin `#`. El nivel solo está en el estilo; el menú «Estilo de texto» de la barra marca el nivel actual.
  - Negrita, cursiva y demás se leen como texto plano. Con el cursor dentro de un tramo, sus marcas se leen como caracteres (`asterisco asterisco`), que es lo que se va a editar.
  - Las viñetas son `aria-hidden`; el número de una lista ordenada se lee.
  - Una tarea es una casilla nativa con nombre (`labels.task`), así que se anuncia como casilla marcada o no.
  - El chip de lenguaje es un botón «Lenguaje del código: ts». Una tabla fuera del cursor es una `<table>` real dentro del contenido; con el cursor, el texto con pipes.
  - No se ha probado con NVDA ni VoiceOver (ver «Riesgos abiertos»).
- **Casillas nativas.** Las casillas son `<input type=checkbox>` dentro de un widget de CM6, no `Checkbox` de UI SDK: un componente de UI SDK por tarea dentro de un contenteditable virtualizado costaría un portal por línea visible, y la casilla no recibe foco (el foco está en el textbox). Para teclado está Mod+Enter, y para agentes `toggleTask(line)`.

## Agentes

Dos primitivas `definePrimitive`:

- `markdown-editor`: `getMarkdown`, `insertText`, `replaceSelection`, `insertWikilink`, `toggleFormat`, `setHeading(0..6)` y `toggleTask`.
- `markdown-document`: solo `setMarkdown`, con `data-agent-confirm`. Va separada porque la marca de confirmación cubre todo lo que hay dentro de su elemento.

## `value` externo y conflictos

- Un `value` que no es eco del último `onChange` se aplica como diff mínimo (prefijo y sufijo comunes) con `addToHistory: false`. El cursor se mueve con el cambio y Ctrl+Z deshace las ediciones del usuario, no la recarga.
- **Conflicto:** si llega un `value` mientras hay ediciones locales esperando el debounce de `onChange`:
  - Con `onConflict({ local, remote })`, el editor muestra lo que devuelva. Si devuelve otro texto distinto de `remote`, ese texto sale después por `onChange`. Si no devuelve nada, gana `remote` y lo local se descarta.
  - Sin `onConflict`, primero sale `local` por `onChange` y después se aplica `remote`. Si la app escribe ese `onChange` directamente en `value`, lo local vuelve a entrar y gana: para otra política hay que pasar `onConflict`.
- Cargar nunca dispara `onChange` ni `onDirtyChange`.

## Otros

- **CSP:** `cspNonce` se pasa a `EditorView.cspNonce` para el `<style>` que inyecta CM6. Los anchos de las columnas van por el CSSOM, no por atributos `style`.
- **IME:** mientras `view.composing`, el plugin no recalcula qué tramos se revelan: mapea los anteriores a través de los cambios. El campo de bloques hace lo mismo con las transacciones `input.type.compose`. Al terminar la composición se recalcula.
- **Barra:** nunca pasa a dos filas. Un `ResizeObserver` calcula cuántos botones caben; los que no, van a un menú «Más formato».
- **Superficie:** la del resto de campos (`border-input`, `bg-field`, `rounded-choice`) con el anillo de foco estándar de 2px. El cursor usa `--foreground`; los enlaces y wikilinks resueltos, `text-link`; los wikilinks sin resolver, `text-link-soft` con subrayado discontinuo.
- **Etiquetas:** inglés por defecto; `markdownEditorLabelsEs` trae el juego en español. Los comandos `/` usan las mismas etiquetas.

## Medidas

**Fidelidad** (`test/markdown-editor-fidelity.test.tsx`): 789 documentos.

- Corpus: 652 ejemplos de CommonMark 0.31.2, 24 de extensiones GFM, 13 notas escritas a mano y 100 ejemplos convertidos a CRLF.
- Cada documento se monta en `MarkdownEditor`. El cursor y una selección pasan por cada línea, así que cada tramo, tabla y valla se pinta revelado y sin revelar.
- **789/789 idénticos byte a byte, 0 `onChange`, 0 `onDirtyChange`, 0 transacciones que cambien el texto**, también con el modelo nuevo.

Mismo corpus (689, sin las variantes CRLF) en las alternativas, cargar → serializar, en Node con jsdom (spike):

| Motor                                               | Idénticos | Ignorando saltos finales | Qué cambia (ejemplo)                                     |
| --------------------------------------------------- | --------: | -----------------------: | -------------------------------------------------------- |
| CM6                                                 |   **689** |                      689 | nada                                                     |
| prosemirror-markdown 1.13 (esquema por defecto)     |         2 |                      123 | setext → `#`, `- [ ]` → `* \[ \]`, `[[x]]` → `\[\[x\]\]` |
| remark + remark-gfm (serializador de Milkdown 7.23) |       199 |                      200 | setext → `#`, `-` → `*`, `[[x]]` → `\[\[x]]`             |
| @tiptap/markdown 3.34 + StarterKit, tareas y tablas |         3 |                      106 | `*` → `-`, setext → `#`, `[[x]]` → `\[\[x\]\]`           |

**Tamaño**: build real de Vite 8 por entrada aislada, React externo, eager = la entrada y sus imports estáticos (`node tooling/markdown-size/measure.mjs`).

| Pieza                                                                                   |        min KB |       gzip KB | Spike (min / gzip) |
| --------------------------------------------------------------------------------------- | ------------: | ------------: | -----------------: |
| Núcleo CM6 (state, view, commands, language)                                            |         337.7 |          94.0 |       337.7 / 94.0 |
| + Markdown, GFM y wikilinks                                                             | 400.4 (+62.7) | 112.0 (+18.0) |      400.4 / 112.0 |
| + vista previa: decoraciones, campo de bloques, tema, estado, comandos y adaptador      | 438.2 (+37.8) | 122.9 (+10.9) |      419.1 / 117.6 |
| Partes de UI SDK que usa (`trigger-menu`, `toolbar`, `menu`, `popover`, `input`), solas |         247.2 |          71.5 |  173.1 / 51.9 (\*) |
| … sobre una app que ya usa combobox, popover, dialog y select                           |         +99.1 |         +27.5 | +49.5 / +14.1 (\*) |
| `MarkdownEditor` completo, sin lenguajes de código                                      |         751.7 |         215.1 |      641.3 / 183.1 |
| … con `markdown-editor-languages` (113 chunks lazy, 1.1 MB min)                         |         982.4 |         295.5 |      871.9 / 263.5 |
| `MarkdownView` solo (incluye @lezer/markdown 74.3/21.0 y `cn` 39.3/9.9)                 |         126.4 |          34.6 |       123.4 / 33.5 |
| ProseMirror + prosemirror-markdown (sin UI)                                             |         368.3 |         113.0 |                    |
| Milkdown (commonmark + gfm + listener, sin UI)                                          |         571.9 |         148.3 |                    |
| Tiptap (StarterKit, tareas, tablas y markdown, sin UI)                                  |         609.4 |         166.3 |                    |

(\*) El spike solo usaba `trigger-menu` y `toolbar`.

- El editor publicado pesa 110 KB min (32 gzip) más que el spike. Casi todo son los controles nuevos: el `Menu` del estilo de bloque y del desbordamiento, y el `Popover` con `Input` y `Button` del chip de lenguaje, más `MarkdownView` dentro del widget de tabla. En una app que ya usa esos componentes, la diferencia se queda en la vista previa: +19 KB min.
- `language-data` sigue siendo opt-in por lo mismo que en el spike: el chunking por defecto de Rolldown mete lang-html, @lezer/lr y autocomplete, que comparten los lenguajes lazy, en un chunk común eager (+230 KB).
- Hay que comparar «CM6 + vista previa», 438/123, con las alternativas, que tampoco llevan UI: a la par que ProseMirror pelado y un 25–30 % por debajo de Tiptap y Milkdown.

**Rendimiento**: Chrome, nota de 5.000 líneas (88 KB) pegada en el editor del showcase, con `MarkdownView` pintado al lado (`node tooling/markdown-size/editor-perf.mjs 4`). Se teclean 48 teclas a mitad del documento en grupos de 6 (120 ms entre teclas) con pausas de 450 ms, más largas que el debounce de 300 ms, así que la vista se vuelve a pintar entre grupos. «Tecla → frame» va del `timeStamp` del `keydown` al primer `setTimeout` tras el siguiente `requestAnimationFrame`.

|                                             | Sin throttling          | CPU ×4 (5 ejecuciones)                         | Spike, mismo arnés, CPU ×4  |
| ------------------------------------------- | ----------------------- | ---------------------------------------------- | --------------------------- |
| Pegar el documento entero → siguiente frame | 44 ms                   | 87–92 ms (dos ejecuciones con ruido: ~500 ms)  | 95 ms                       |
| Tecla → frame                               | p50 11.3, p95 12.8–15.1 | p50 36–38, **p95 52–61 (mediana 56)**, máx. 82 | p50 41.4, p95 246, máx. 446 |
| Tareas largas al teclear                    | ninguna                 | 0–1, de 55–64 ms                               | 16, hasta 278 ms            |
| Construir el estado / actualizar la vista   |                         | p50 3.2 / 5.1 ms                               | 0.1 / 6.3 ms                |
| Líneas en el DOM                            | ~58 (CM6 virtualiza)    |                                                |                             |

- **El objetivo era p95 < 50 ms a CPU ×4 con la vista al lado. Se queda cerca pero no lo cumple siempre:** una ejecución dio p95 48.9 ms y las otras cinco entre 52 y 61. La máquina de medida tenía otras sesiones activas; las cifras varían ±10 ms entre ejecuciones.
- Lo que queda es el camino de entrada de CM6 y el frame del navegador, no la vista previa. El p50 es el del spike (que no ocultaba casi nada), quitar los menús no cambia nada, y en cada tecla el estado nuevo cuesta 3 ms y la vista 5 ms a ×4. Los ~30 ms restantes son la lectura del DOM de CM6, el estilo y layout de una página de showcase muy grande (~13 ms) y esperar al siguiente frame.
- Lo que sí se arregló: las tareas largas del spike. `MarkdownView` era cuadrático en tablas (cada tabla volvía a partir el resto del documento para leer su fila de alineación); ahora memoriza por bloque, difiere el valor y reutiliza el parse anterior con `TreeFragment` fuera del tramo editado. El campo de bloques reescanea solo los bloques de primer nivel tocados y mapea sus widgets en vez de rehacerlos.
- `resolveWikilink` y `wikilinkHref` deben ser estables (de módulo o `useCallback`): una función nueva en cada render vuelve a pintar todos los bloques de `MarkdownView`.

## Comparación

|                           | CM6 + decoraciones                                                                                            | ProseMirror / Tiptap / Milkdown                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Fidelidad                 | Por construcción: el texto es el modelo                                                                       | Normaliza al serializar (2–199 de 689 idénticos)                                        |
| Tamaño (motor + Markdown) | 400 / 112 KB, 438 / 123 con la vista previa                                                                   | 368 / 113 (PM pelado) a 609 / 166 (Tiptap)                                              |
| Accesibilidad             | `role=textbox` real con nombre y pista. Menús y chip son partes de UI SDK. Se lee el texto visible            | contenteditable con nodos. Las tablas y las casillas son DOM de verdad                  |
| Integración con agentes   | Las acciones son ediciones de texto, triviales de validar. `setMarkdown` es un diff mínimo                    | Las acciones operan sobre nodos. Hay que mapear Markdown ↔ esquema para leer y escribir |
| UX                        | Tipo Typora: marcas solo en el tramo del cursor; tablas renderizadas fuera del cursor y en texto al editarlas | WYSIWYG completo, con tablas editables por celda                                        |

## Riesgos abiertos

- **IME y móvil.** La lógica de composición está cubierta con un test que simula `view.composing`, pero no se ha probado con un IME real ni con las asas de selección de iOS y Android junto a rangos atómicos ocultos.
- **Lectores de pantalla.** Falta la prueba con NVDA y VoiceOver. El nivel de un título no se anuncia como tal (es un textbox, no un documento con encabezados).
- **Teclado del menú.** CM6 escucha `keydown` en el contenido antes que UI SDK, y UI SDK respeta `defaultPrevented`. Por eso las teclas del menú se saltan los keymaps mientras está abierto. Funciona, pero depende del orden de listeners de dos librerías en beta.
- **Mod+Alt+número** no llega en distribuciones de teclado donde Ctrl+Alt (AltGr) escribe un carácter con esa tecla (por ejemplo `@` con AltGr+2 en español): CM6 lo trata como AltGr. Quedan la barra, el menú `/` y la acción de agente.
- **Escribir un subrayado setext** hace que la línea de encima se vuelva título al instante (un `-` solo ya cuenta). Es la sintaxis, no el editor, pero se nota más sin las marcas.
- **Contraste de sintaxis:** los colores `tok-*` (`--success`, `--info`, `--warning` sobre `--muted`) pasan `test:browser`, pero no están medidos uno a uno.

## Qué falta

- Edición de tablas por celdas (Tab entre celdas, añadir y quitar filas y columnas).
- Burbuja de formato sobre la selección y estado `pressed` en la barra.
- Resaltado lazy de código y autolinks GFM en `MarkdownView`.
- Pegar HTML como Markdown. Imágenes. RTL.
- Pruebas manuales de IME, móvil y lectores de pantalla.
- Más acciones de agente: `getSelection` y `find`.
