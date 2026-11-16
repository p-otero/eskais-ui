# 06 · AgentTaskBoard: contrato v1

Petición de NF Board (2026-11-15). La especificación original está en https://claude.ai/artifact/Rb1c7FAJeEfXhQqQvP6AUe. Este documento recoge solo lo que cambia o se concreta sobre ella. Lo acordaron Pablo y el coordinador de NF.

## Sin cambios

Se mantienen tal cual: `Quality`, `Quantity`, `AgentRef`, `UsageSummary`, `ThreadRef`, `AttemptView` y `TaskView`. Las fechas son strings ISO 8601 UTC. El adaptador NF → props vive en NF Board.

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

  selectedTaskId?: string | null
  defaultSelectedTaskId?: string | null
  onSelectTask?: (id: string | null) => void

  labels?: Partial<AgentTaskBoardLabels> // inglés por defecto; se exporta agentTaskBoardLabelsEs
  formatCurrency?: (usd: number) => string
  renderThreadLink?: (thread: ThreadRef) => React.ReactNode
  onOpenThread?: (thread: ThreadRef) => void

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
```

## Comportamiento

- **Detalle** (`detailPresentation`, por defecto `"dialog"`): un diálogo modal ancho que no estrecha el tablero; `"drawer"` lo abre como cajón a la derecha. Revierte la decisión anterior de panel no modal a petición de Pablo (2026-11-16): el panel lateral cortaba las columnas en hosts de unos 1100 px. `"side"` se mantiene, no modal, lateral en pantallas anchas e inferior en estrechas, para quien necesite operar el tablero mientras lee.
- **Agentes con el detalle modal abierto**: los controles del tablero tras el modal quedan ocultos para los agentes (`data-agent-hidden`), igual que son inertes para las personas. Las acciones de la región del tablero siguen funcionando: `selectTask` cambia la tarea del diálogo, `filter` y `setView` cambian el tablero de detrás. Dentro del diálogo el agente lee el detalle, abre hilos, aprueba o rechaza según `agentApproval` y lo cierra con "Close task details".
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
- **Acciones de agente**: `selectTask`, `openThread`, `setView`, `filter`. Además `approveProposal` y `rejectProposal`, solo en live y según `agentApproval`.
- **Escala**: hasta 200 tareas sin virtualizar, con `content-visibility: auto` en las columnas. Se verifica con un fixture de 200 tareas × 30 intentos.
- **Empaquetado**: debe funcionar como un único HTML estático, sin fetch y con fuentes de fallback. Se comprobará en CI.
