# 06 · AgentTaskBoard: contrato v1

Petición de NF Board (2026-11-15). La especificación original está en https://claude.ai/artifact/Rb1c7FAJeEfXhQqQvP6AUe. Este documento recoge solo lo que cambia o se concreta sobre ella. Lo acordaron Pablo y el coordinador de NF.

## Sin cambios

Se mantienen tal cual: `Quality`, `Quantity`, `AgentRef`, `UsageSummary`, `ThreadRef` y `AttemptView`. `TaskView` gana `links` (ver Enlaces). Las fechas son strings ISO 8601 UTC. El adaptador NF → props vive en NF Board.

## Props

```ts
interface AgentTaskBoardProps {
  tasks: TaskView[]
  mode: "snapshot" | "live"
  generatedAt?: string // obligatorio en "snapshot": es el "ahora" de la instantánea; se muestra en la barra
  now?: string // override de "ahora" en live, solo para tests y capturas deterministas
  locale?: string // BCP 47; por defecto, el lang de la página
  timeZone?: string // IANA; por defecto, la del navegador. NF lo pasa siempre en snapshot

  view?: "board" | "table"
  defaultView?: "board" | "table"
  onViewChange?: (view: "board" | "table") => void

  filters?: TaskFilters
  defaultFilters?: TaskFilters
  onFiltersChange?: (filters: TaskFilters) => void

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
  renderAttachments?: (task: TaskView) => React.ReactNode // hueco provisional en la columna principal
  renderLocation?: (task: TaskView) => React.ReactNode // hueco provisional en la columna lateral

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
}

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
}
```

## Comportamiento

- **Detalle** (`detailPresentation`, por defecto `"dialog"`): un diálogo modal ancho que no estrecha el tablero; `"drawer"` lo abre como cajón a la derecha. Revierte la decisión anterior de panel no modal a petición de Pablo (2026-11-16): el panel lateral cortaba las columnas en hosts de unos 1100 px. `"side"` se mantiene, no modal, lateral en pantallas anchas e inferior en estrechas, para quien necesite operar el tablero mientras lee.
- **Agentes con el detalle modal abierto**: los controles del tablero tras el modal quedan ocultos para los agentes (`data-agent-hidden`), igual que son inertes para las personas. Las acciones de la región del tablero siguen funcionando: `selectTask` cambia la tarea del diálogo, `filter` y `setView` cambian el tablero de detrás. Dentro del diálogo el agente lee el detalle, abre hilos, aprueba o rechaza según `agentApproval` y lo cierra con "Close task details".
- **Columnas**:
  - El botón de contraer va al final de la cabecera, con un icono de plegar (desplegar si está contraída) y un tooltip (`labels.components.boardColumn.collapseTooltip` / `expandTooltip`: "Collapse column" / "Expand column"). Aparece al pasar el ratón o con el foco dentro de la cabecera; siempre visible en punteros táctiles y con la columna contraída. Su nombre accesible sigue siendo "Collapse Done". Los agentes lo pulsan por ese nombre (`press`); el tooltip lo lista como su propio componente.
  - El orden sale del array `columns`. Reordenar queda fuera; el nombre `reorderableColumns` se reserva para cuando llegue.
  - `columnAccent="tint"` (por defecto) marca cada columna con su tono: un punto antes del título, un borde superior de 2 px y un lavado muy suave en la cabecera, mezclado con `transparent` en `color-mix` para que el cristal se vea a través. `"none"` las deja lisas.
  - Tonos por defecto (`taskStatusAccentTones`): `proposed`, `todo` y `cancelled` neutral; `working` info; `review` warning; `blocked` destructive; `done` success. `columnTones` los sobrescribe, y los iconos de estado de las tarjetas, la tabla y el detalle los siguen.
- **Hilos**: un `ThreadRef` con `href` se muestra como un botón pequeño con borde, un icono de ventana y `labels.openThread` ("Open thread" / "Abrir hilo"); el id va en el `title`, nunca como texto. Con `onOpenThread` el botón es un `<button>` (los agentes lo pueden pulsar) y llama al callback; con solo `href` es un enlace. Sin ninguno de los dos se muestra el título, si lo hay. `renderThreadLink` sustituye todo lo anterior.
- **Enlaces** (`TaskView.links`):
  - Van en la columna lateral del detalle, con icono según `kind` (git-pull-request, git-branch, git-commit, circle-dot, external-link) y `state` como `StatusPill`: draft neutral, open info, merged success, closed destructive.
  - La tarjeta muestra un enlace de icono a la primera pull request, con nombre `labels.card.openPullRequest(label)`.
  - Sin `onOpenLink` los enlaces navegan a su `href`; con él, el clic llama al callback. `renderLink` sustituye cada enlace de la lista.
- **Detalle en diálogo** (`detailPresentation="dialog"`): `Dialog` de tamaño `xl`. Cuando el contenido mide 56 rem o más (consulta de contenedor), dos columnas:
  - Principal: objetivo, decisión pendiente, aceptación, adjuntos (`renderAttachments`) y actividad (la línea de intentos; el botón de consumo de cada intento va en su fila de título).
  - Lateral: estado, perfil, proyecto, actualización, etiquetas (y el coste si no hay consumo), dependencias, resumen de trabajo (intentos, reparaciones, revisiones, intervenciones, aceptada a la primera), consumo con `UsageGrid variant="compact"`, enlaces y ubicación (`renderLocation`).
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
- **Filtro `model`**: compara con `executed.model`, o con `configured.model` cuando falta el ejecutado. Una tarea coincide si alguno de sus intentos corrió con ese modelo; así, las tareas que cambiaron de modelo por cuota aparecen bajo el que corrió de verdad.
- **Vista de tabla**: ordenable por columnas (`aria-sort`) y de solo lectura.
- **Valores**:
  - Desconocido se muestra como `—`.
  - Estimado se muestra con `~`. En la tarjeta lleva texto para lectores de pantalla y `title`. En el panel y en la tabla, tooltip con la fuente.
  - Los IDs de modelo largos se recortan por el medio en la tarjeta y se muestran enteros en el panel.
- **Acciones de agente**: `selectTask`, `openThread`, `openLink`, `setView`, `filter`. `openLink(taskId, link)` acepta el `label` o el `href` de un enlace de esa tarea y llama a `onOpenLink`; sin `onOpenLink` falla ("This board doesn't open links"), igual que `openThread` sin `onOpenThread`. Un Button de UI SDK dibujado como enlace no tiene `press` para agentes; por eso existen estas acciones. Además `approveProposal` y `rejectProposal`, solo en live y según `agentApproval`.
- **Escala**: hasta 200 tareas sin virtualizar, con `content-visibility: auto` en las columnas. Se verifica con un fixture de 200 tareas × 30 intentos.
- **Empaquetado**: debe funcionar como un único HTML estático, sin fetch y con fuentes de fallback. Se comprobará en CI.

## Etiquetas nuevas

Todas tienen valor en `agentTaskBoardLabels` (inglés) y en `agentTaskBoardLabelsEs`:

- `openThread`: el texto del botón de un hilo.
- `card.openPullRequest(label)`: el nombre del enlace a la pull request en la tarjeta.
- `link.kind` y `link.state`: los nombres de cada tipo y estado de enlace.
- `panel`: `status`, `labels`, `links`, `linksOf(id)`, `activity`, `attachments`, `location`, `attemptsSummary`, `counts.{attempts, repairs, reviews, humanInterventions}`, `acceptedFirstPass`, `yes`, `no`.
- `components.boardColumn`: `collapseTooltip` y `expandTooltip`.
- `components.attemptTimeline.threadLink`: el texto del botón de un hilo cuando se usa `AttemptTimeline` sola; el tablero le pasa `openThread`.

## Diálogo

`DialogContent` acepta `size`: `sm` (24 rem), `md` (32 rem, por defecto), `lg` (48 rem), `xl` (72 rem) o `full` (el contenedor menos `--floating-offset`). `DialogBody` es la parte que se desplaza; `DialogHeader` y `DialogFooter` no encogen y quedan a la vista. El texto largo sin espacios no ensancha el diálogo (`min-w-0`, `overflow-wrap: anywhere`). En `narrow:` es una hoja inferior a todo el ancho, salvo con `sheet={false}`. Sin unidades de viewport: anchos y altos en `%` sobre su bloque contenedor (`--dialog-width`, `--dialog-max-height`, `--sheet-max-height`).

Diálogos y cajones son superficies de lectura opacas en todos los temas, también con cristal, para que el texto pase 4.5:1 sobre el fondo atenuado. El cristal queda para el cromo: popovers, menús, toasts, sidebar y tarjetas.
