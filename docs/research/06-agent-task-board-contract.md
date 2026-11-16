# 06 · AgentTaskBoard: contrato v1

Petición de NF Board (2026-11-15). La especificación original está en https://claude.ai/artifact/Rb1c7FAJeEfXhQqQvP6AUe. Este documento recoge solo lo que cambia o se concreta sobre ella. Lo acordaron Pablo y el coordinador de NF.

## Sin cambios

Se mantienen tal cual: `Quality`, `Quantity`, `AgentRef`, `UsageSummary`, `ThreadRef` y `AttemptView`. `TaskView` gana `links` (ver Enlaces), `attachments` (ver Adjuntos) y `location` (ver Ubicación). Las fechas son strings ISO 8601 UTC. El adaptador NF → props vive en NF Board.

## Props

```ts
interface AgentTaskBoardProps {
  tasks: TaskView[]
  mode: "snapshot" | "live"
  generatedAt?: string // obligatorio en "snapshot": es el "ahora" de la instantánea; se muestra en la barra
  now?: string // override de "ahora" en live, solo para tests y capturas deterministas
  locale?: string // BCP 47; por defecto, el lang de la página
  timeZone?: string // IANA; por defecto, la del navegador. NF lo pasa siempre en snapshot

  view?: "board" | "table" | "backlog"
  defaultView?: "board" | "table" | "backlog"
  onViewChange?: (view: "board" | "table" | "backlog") => void

  filters?: TaskFilters
  defaultFilters?: TaskFilters
  onFiltersChange?: (filters: TaskFilters) => void
  filterControls?: Array<"query" | "project" | "profile" | "model" | "stage"> // controles de filtro visibles; por defecto, todos los que aplican

  columns?: { status: TaskView["status"]; hidden?: boolean; collapsed?: boolean }[]
  onColumnsChange?: (columns: NonNullable<AgentTaskBoardProps["columns"]>) => void
  columnAccent?: "tint" | "none" // por defecto "tint"
  columnTones?: Partial<Record<TaskStatus, Tone>> // sobre taskStatusAccentTones
  // reorderableColumns: reservado para el futuro; hoy el orden sale del array `columns`

  selectedTaskId?: string | null
  defaultSelectedTaskId?: string | null
  onSelectTask?: (id: string | null) => void

  labels?: Partial<AgentTaskBoardLabels> // inglés por defecto; se exporta agentTaskBoardLabelsEs
  formatCurrency?: (usd: number) => string
  renderThreadLink?: (thread: ThreadRef) => React.ReactNode
  onOpenThread?: (thread: ThreadRef) => void
  renderLink?: (link: TaskLink) => React.ReactNode // sustituye cada enlace de la lista del detalle
  onOpenLink?: (link: TaskLink, task: TaskView) => void // toma el clic y la acción openLink
  renderAttachments?: (task: TaskView) => React.ReactNode // sustituye la tira de adjuntos de la columna principal
  renderLocation?: (task: TaskView) => React.ReactNode // sustituye la pista de etapas de la columna lateral
  stages?: Stage[] // el flujo al que apunta task.location, en orden (@eskais/stage-track)
  stageFilterNone?: boolean // botón "Sin etapa" al final del filtro; por defecto, si hay stages y alguna tarea sin location
  renderBacklogActions?: (task: TaskView) => React.ReactNode // acciones del host al final de cada fila del backlog
  renderCardActions?: (task: TaskView) => React.ReactNode // lo mismo al final de cada tarjeta del tablero

  onApproveProposal?: (id: string) => void | Promise<void> // solo en live
  onRejectProposal?: (id: string) => void | Promise<void>
  agentApproval?: "confirm" | "allow" | "deny" // por defecto "confirm"
  detailPresentation?: "dialog" | "drawer" | "side" // por defecto "dialog"
  density?: "comfortable" | "compact" | "auto" // por defecto "auto"
}

interface TaskFilters {
  project?: string
  profile?: string
  model?: string
  query?: string
  stage?: string[] // ids de etapa; coincide la tarea cuya ubicación está en cualquiera; NO_STAGE, la que no tiene
}

const NO_STAGE = "__none__" // exportada desde @/components/ui/agent-task-board y @/lib/agent-task-board-model

type Stage = { id: string; label: string; tone?: Tone } // @eskais/stage-track

type Tone = "neutral" | "info" | "success" | "warning" | "destructive" // @eskais/tone

interface TaskLink {
  kind: "pull-request" | "branch" | "commit" | "issue" | "external"
  href: string
  label: string
  state?: "draft" | "open" | "merged" | "closed"
}

interface TaskView {
  // … lo de la especificación original, más:
  links?: TaskLink[]
  attachments?: Attachment[] // el tipo de @eskais/attachments
  location?: { stage: string; href?: string } // stage es el id de una de las `stages` del tablero
}
```

## Comportamiento

- **Detalle** (`detailPresentation`, por defecto `"dialog"`): un diálogo modal ancho que no estrecha el tablero; `"drawer"` lo abre como cajón a la derecha. Revierte la decisión anterior de panel no modal a petición de Pablo (2026-11-16): el panel lateral cortaba las columnas en hosts de unos 1100 px. `"side"` se mantiene, no modal, lateral en pantallas anchas e inferior en estrechas, para quien necesite operar el tablero mientras lee.
- **Agentes con el detalle modal abierto**: los controles del tablero tras el modal quedan ocultos para los agentes (`data-agent-hidden`), igual que son inertes para las personas. Las acciones de la región del tablero siguen funcionando: `selectTask` cambia la tarea del diálogo, `filter` y `setView` cambian el tablero de detrás. Dentro del diálogo el agente lee el detalle, abre hilos, aprueba o rechaza según `agentApproval` y lo cierra con "Close task details".
- **Columnas**:
  - El botón de contraer va al final de la cabecera, con un icono de círculo con un menos (`CircleMinus`; con un más, `CirclePlus`, si está contraída) y un tooltip (`labels.components.boardColumn.collapseTooltip` / `expandTooltip`: "Collapse column" / "Expand column"). Aparece al pasar el ratón o con el foco dentro de la cabecera; siempre visible en punteros táctiles y con la columna contraída. Su nombre accesible sigue siendo "Collapse Done". Los agentes lo pulsan por ese nombre (`press`); el tooltip lo lista como su propio componente.
  - El orden sale del array `columns`. Reordenar queda fuera; el nombre `reorderableColumns` se reserva para cuando llegue.
  - Contraer una columna llama a `onColumnsChange` con la lista completa en el orden actual, así la columna nunca salta delante de las que aún no tenían configuración.
  - `columnAccent="tint"` (por defecto) marca cada columna con su tono: un punto antes del título, un borde superior de 2 px y un lavado muy suave en la cabecera, mezclado con `transparent` en `color-mix` para que el cristal se vea a través. `"none"` las deja lisas.
  - Tonos por defecto (`taskStatusAccentTones`): `proposed`, `todo` y `cancelled` neutral; `working` info; `review` warning; `blocked` destructive; `done` success. `columnTones` los sobrescribe, y los iconos de estado de las tarjetas, la tabla y el detalle los siguen.
- **Hilos**: un `ThreadRef` con `href` se muestra como un botón pequeño con borde, un icono de ventana y `labels.openThread` ("Open thread" / "Abrir hilo"); el id va en el `title`, nunca como texto. Con `onOpenThread` el botón es un `<button>` (los agentes lo pueden pulsar) y llama al callback; con solo `href` es un enlace. Sin ninguno de los dos se muestra el título, si lo hay. `renderThreadLink` sustituye todo lo anterior.
- **Enlaces** (`TaskView.links`):
  - Van en la columna lateral del detalle, con icono según `kind` (git-pull-request, git-branch, git-commit, circle-dot, external-link) y `state` como `StatusPill`: draft neutral, open info, merged success, closed destructive.
  - La tarjeta muestra un enlace de icono a la primera pull request, con nombre `labels.card.openPullRequest(label)`.
  - Sin `onOpenLink` los enlaces navegan a su `href`; con él, el clic llama al callback. `renderLink` sustituye cada enlace de la lista.
- **Adjuntos** (`TaskView.attachments`):
  - La columna principal del detalle muestra un `AttachmentStrip` llamado `labels.panel.attachmentsOf(id)`. Las imágenes se abren en el `Lightbox` (con `srcDark` en modo oscuro); los ficheros, en su `href`.
  - La tarjeta muestra un chip pequeño con un clip y el número de adjuntos; el lector de pantalla lee `labels.card.attachments(n)`.
  - Los agentes los abren con la acción `openAttachment(id)` de la propia tira.
  - `renderAttachments` sustituye la tira.
- **Ubicación** (`TaskView.location` y `stages`):
  - La columna lateral del detalle muestra un `StageTrack variant="track"` llamado `labels.panel.locationOf(id)`, con la etapa actual enlazada a `location.href`. Si la etapa no está en `stages`, solo un `StagePill`.
  - La tarjeta muestra un `StagePill`, también sin `stages` (con el id como texto).
  - Con `stages`, la barra muestra una fila `StageFilter` (`labels.filters.stage`) con el número de tareas por etapa bajo los demás filtros. Filtra por `TaskFilters.stage`; vacía, no filtra.
  - El último botón de la fila es `labels.filters.noStage` ("No stage" / "Sin etapa"), con su número, para las tareas sin `location`: pone `NO_STAGE` en `filters.stage` y se combina con las demás etapas. Sale por defecto cuando hay `stages` y alguna tarea no tiene ubicación; `stageFilterNone` lo fuerza (`true`) o lo quita (`false`). `countByStage` cuenta esas tareas bajo `NO_STAGE`.
  - `renderLocation` sustituye la pista.
- **Backlog** (`view="backlog"`): una `List` de `ListItem` con las tareas `proposed` y las `todo` que no están listas (`ready === false`, o dependencias sin terminar si falta `ready`), en dos `ListGroup` con su número: `labels.backlog.proposed` y `labels.backlog.notReady`. Cada fila lleva el icono de estado, el id, el título (dos líneas y puntos suspensivos), las etiquetas como chips, la etapa y, al final, el avatar del agente o la hora de actualización. En live, las propuestas llevan Aprobar/Rechazar con las mismas reglas que la tarjeta. `renderBacklogActions(task)` añade los controles del host (por ejemplo, un botón de copiar el comando) en la ranura `actions` de cada fila, detrás de Aprobar/Rechazar, también en snapshot. La `List` sigue en modo enlace/botón, no listbox: las filas de un listbox son opciones y no pueden contener controles. Los controles deben ser partes de UI SDK (el `Button` del registro) con un nombre que diga a qué tarea afectan ("Copy command for T-011"); el botón principal de la fila lee ese texto como contexto, así que un agente toma la ref del snapshot cuando el nombre coincide con los dos. Elegir una fila abre el detalle como una tarjeta, y al cerrarlo el foco vuelve a la fila. Sin tareas, `labels.empty.backlog`.
- **Acciones en la tarjeta**: `renderCardActions(task)` pone los controles del host en una fila `task-card-actions` al final de la tarjeta, por encima del botón estirado, en cualquier modo. Las tarjetas están memorizadas: el host pasa una función estable (`useCallback`).
- **Detalle en diálogo** (`detailPresentation="dialog"`): `Dialog` de tamaño `xl`. Cuando el contenido mide 56 rem o más (consulta de contenedor), dos columnas:
  - Principal: objetivo, decisión pendiente, aceptación, adjuntos y actividad (la línea de intentos; el botón de consumo de cada intento va en su fila de título).
  - Lateral: estado, perfil, proyecto, actualización, etiquetas (y el coste si no hay consumo), dependencias, resumen de trabajo (intentos, reparaciones, revisiones, intervenciones, aceptada a la primera), consumo con `UsageGrid variant="compact"`, enlaces y ubicación.
  - Más estrecho, una columna con la lateral detrás de la principal. En pantallas `narrow:` el diálogo es una hoja inferior.
  - La aceptación es una lista compacta, una línea por criterio con su icono; la evidencia se abre con un desplegable (collapsible de UI SDK) por criterio, nunca solo en un tooltip.
  - `"drawer"` y `"side"` siguen funcionando, en una columna.
- **Densidad** (`density`, por defecto `"auto"`): con `"auto"`, el tablero usa las formas y espaciados compactos cuando su contenedor mide 75rem (1200 px) o menos; `"compact"` los fuerza y `"comfortable"` hereda los de la página.
- **Aprobar y rechazar**: si el callback devuelve una Promise, el botón queda en estado pendiente, no admite doble envío y muestra el error si falla. Rechazar pide confirmación en pantalla.
- **`agentApproval`**:
  - `"confirm"`: el agente puede aprobar o rechazar, pero con `data-agent-confirm`, es decir, con aprobación de una persona.
  - `"allow"`: el agente actúa sin preguntar.
  - `"deny"`: el agente no ve esas acciones.
- **Tiempo**:
  - En snapshot se calcula contra `generatedAt` y no se refresca nunca.
  - En live se refresca cada 30 s y se pausa con `document.hidden`.
  - El tablero solo formatea. `liveness` (incluido `suspect_dead`) llega siempre calculado.
  - Las horas absolutas muestran la abreviatura de la zona cuando no coincide con la del navegador.
  - Todo tiempo relativo lleva la fecha absoluta en `title` o en un tooltip.
  - Se implementa con `Date` + `Intl`, sin Temporal, en una única utilidad interna.
- **Controles de filtro** (`filterControls`, por defecto todos): elige qué controles de la barra se muestran, por ejemplo sin `"project"` cuando el host ya pinta su propio selector de proyecto. Un filtro sin control sigue aplicándose si llega en `filters` o `defaultFilters`, la acción `filter` de los agentes acepta todas las claves, y "Clear filters" (en la barra y en el vacío) solo quita los de los controles visibles; si solo hay filtros ocultos, no aparece. Sin `"query"` ni selectores, la barra se queda con las vistas; sin `"stage"`, no hay fila de etapas.
- **Filtro `model`**: compara con `executed.model`, o con `configured.model` cuando falta el ejecutado. Una tarea coincide si alguno de sus intentos corrió con ese modelo; así, las tareas que cambiaron de modelo por cuota aparecen bajo el que corrió de verdad.
- **Vista de tabla**: ordenable por columnas (`aria-sort`) y de solo lectura.
- **Valores**:
  - Desconocido se muestra como `—`.
  - Estimado se muestra con `~`. En la tarjeta lleva texto para lectores de pantalla y `title`. En el panel y en la tabla, tooltip con la fuente.
  - Los IDs de modelo largos se recortan por el medio en la tarjeta y se muestran enteros en el panel.
- **Acciones de agente**: `selectTask`, `openThread`, `openLink`, `setView` (`"board"`, `"table"` o `"backlog"`), `filter` (`{ project, profile, model, query, stage }`; `stage` es una lista de ids de `stages`, o de las etapas que nombran las tareas si falta, más `NO_STAGE` o su etiqueta, `labels.filters.noStage`, sin distinguir mayúsculas; `null` o `[]` la quita). `openLink(taskId, link)` acepta el `label` o el `href` de un enlace de esa tarea y llama a `onOpenLink`; sin `onOpenLink` falla ("This board doesn't open links"), igual que `openThread` sin `onOpenThread`. Un Button de UI SDK dibujado como enlace no tiene `press` para agentes; por eso existen estas acciones. Además `approveProposal` y `rejectProposal`, solo en live y según `agentApproval`.
- **Otras acciones**: la tira de adjuntos expone `openAttachment(id)` y la lista del backlog (`labels.backlog.name`) `select(id)`.
- **Escala**: hasta 200 tareas sin virtualizar, con `content-visibility: auto` en las columnas. Se verifica con un fixture de 200 tareas × 30 intentos.
- **Empaquetado**: debe funcionar como un único HTML estático, sin fetch y con fuentes de fallback. Los adjuntos del fixture son SVG en URI `data:`, así que también van dentro del fichero. Se comprobará en CI.

## Etiquetas nuevas

Todas tienen valor en `agentTaskBoardLabels` (inglés) y en `agentTaskBoardLabelsEs`:

- `openThread`: el texto del botón de un hilo.
- `card.openPullRequest(label)`: el nombre del enlace a la pull request en la tarjeta.
- `link.kind` y `link.state`: los nombres de cada tipo y estado de enlace.
- `panel`: `status`, `labels`, `links`, `linksOf(id)`, `activity`, `attachments`, `location`, `attemptsSummary`, `counts.{attempts, repairs, reviews, humanInterventions}`, `acceptedFirstPass`, `yes`, `no`.
- `components.boardColumn`: `collapseTooltip` y `expandTooltip`.
- `views.backlog`, `backlog.{name, proposed, notReady}`, `empty.backlog`, `filters.stage`, `filters.noStage`.
- `card.attachments(count)`, `panel.attachmentsOf(id)` y `panel.locationOf(id)`.
- `components.attachments`: las de `AttachmentStrip` (`open`, `more`) y su `lightbox`.
- `components.attemptTimeline.threadLink`: el texto del botón de un hilo cuando se usa `AttemptTimeline` sola; el tablero le pasa `openThread`.

## Diálogo

`DialogContent` acepta `size`: `sm` (24 rem), `md` (32 rem, por defecto), `lg` (48 rem), `xl` (72 rem) o `full` (el contenedor menos `--floating-offset`). `DialogBody` es la parte que se desplaza; `DialogHeader` y `DialogFooter` no encogen y quedan a la vista. El texto largo sin espacios no ensancha el diálogo (`min-w-0`, `overflow-wrap: anywhere`). En `narrow:` es una hoja inferior a todo el ancho, salvo con `sheet={false}`. Sin unidades de viewport: anchos y altos en `%` sobre su bloque contenedor (`--dialog-width`, `--dialog-max-height`, `--sheet-max-height`).

Diálogos y cajones son superficies de lectura opacas en todos los temas, también con cristal, para que el texto pase 4.5:1 sobre el fondo atenuado. El cristal queda para el cromo: popovers, menús, toasts, sidebar y tarjetas.
