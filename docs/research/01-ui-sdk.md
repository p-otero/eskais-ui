# 01 · UI SDK — filosofía, behaviors y capacidades agent-native

Fuente: docs empaquetadas de `@ui-sdk/react@0.1.0-beta.5` (`docs/llms.txt`, `core.md`, `agents.md`, `rendering.md`, `custom-parts.md`, páginas de componentes), skill oficial `ui-sdk` (instalada en `.agents/skills/ui-sdk`) y repo `vercel-labs/ui` (Apache-2.0, creado 2026-10-26).
Verificado además con un spike ejecutable (ver §8).

## 1. Qué es y qué aporta frente a React convencional

UI SDK es una **librería de behaviors**, no de estilos. Tres capas:

| Capa            | Paquete                                        | Qué contiene                                                                                                                                                                                                                                                                                                                                           |
| --------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Core            | `@ui-sdk/core`                                 | `definePrimitive`, behaviors (`createRovingFocus`, `createListbox`, `createTypeahead`, `createFocusRecovery`, `createPopup`, `bindLayer`, `position`, `createReorder`, `createSelection`…), cambios (`createChange`, `dispatch`, `createCommit`, `createUndoStack`), agentes (`/agent`, `/observe`, `/history`), testing (`/testing`). Framework-free. |
| Adapter         | `@ui-sdk/react` (también vue/svelte/solid/web) | `createParts`, `usePrimitive`, `usePart`, `renderElement`, `mergeProps` + ~60 componentes listos (Dialog, AlertDialog, Input, Field, Select, Combobox, Menu, Tabs…). Sin estilos, sin providers, sin portals (usa top layer).                                                                                                                          |
| Estilo opcional | `@ui-sdk/core/web.css`                         | Tema por defecto con tokens `--ui-*` en `@layer ui-sdk`.                                                                                                                                                                                                                                                                                               |

Frente a componentes React convencionales aporta:

1. **Comportamiento definido una vez, fuera de React** (primitive) y probado contra los patrones APG con `checkPattern`.
2. **Contrato de cambio uniforme**: todo cambio pasa por `on<Key>Change(value, details)` con `reason`, `source` (`keyboard|mouse|agent|programmatic…`) y `cancel()`.
3. **Controllers** (`createXController()`): mandar sobre un componente desde fuera con las mismas reglas que la interacción humana; `open()` de un popup devuelve una promesa con `returnValue`.
4. **Agentes como usuarios de primera clase**: cada componente registrado aparece en `agent.snapshot()` con su estado y acciones, sin escribir tools.
5. **Estilo por estado**: `data-slot` + atributos de estado (`data-open`, `data-pending`, `data-filled`…) → Tailwind `data-open:…`.

## 2. Cómo se construye una primitive (patrón oficial)

```ts
definePrimitive({
  name: "search-field",          // → data-slot raíz y prefijo de partes
  options: { input: "value", onSearch: "callback" },  // esquema con "kinds"
  state: (o: Opts) => ({ ... }), // estado inicial (lee default<Key>)
  sync: (o) => ({ ... }),        // controlled → state
  api: (ctx) => { const change = createChange(ctx); return { ... } },
  slots: (slot) => ({ root: slot({ role, focus, press, keys, on, attrs, bind, present }) }),
  agent: { actions: [...] },     // SIEMPRE al final
})
```

Reglas clave (de la skill y `core.md`):

- Rol en el slot (`role:`), nunca en `attrs`; TypeScript exige `focus`/`press`/`keys` según el rol.
- `attrs`/`state` puros (corren en servidor); DOM sólo en `bind` con cleanup.
- Controlled/uncontrolled: `<key>`, `default<Key>`, `on<Key>Change(value, details)` + `sync`.
- Todo cambio visible vía `change(key, value, { reason, event })`; eventos sin estado vía `dispatch(ctx, "onX", …)`.
- Render con `createParts(primitive, { root: "div", … })` en un fichero `"use client"`; el adapter **sólo renderiza** (sin handlers de teclado, foco ni ARIA).
- `__UI_SDK_STRICT__ = true` en tests convierte warnings de desarrollo en errores.

**Dos costuras de composición públicas** (`core.md#compose-ours`):

1. _Render ours inside yours_: tu primitive posee `open`, el Popover/Dialog de UI SDK renderiza con `open={state.open}` y reenvía `reason/event/source`.
2. _Wrap ours_: tu slot raíz escucha eventos que burbujean desde un componente de UI SDK y lo cambia por su **controller** público. (Es el patrón de nuestro `SearchField`.)

## 3. Inventario de behaviors útiles para Eskais UI

| Necesidad                                                                                                                        | UI SDK ya lo resuelve con                                                                          | Uso en Eskais UI                        |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Diálogo modal, focus trap, Escape, restaurar foco, inert, scroll lock, nested, animación                                         | `Dialog`, `AlertDialog` (`createPopup` + `bindLayer`)                                              | `Dialog`, `ConfirmDialog`               |
| Confirmación async: pending, sin doble submit, cierra al resolver, sigue abierto si rechaza, error en estado, anuncio a lectores | `AlertDialogClose`/`DialogClose` con `action` + `pendingAnnouncement`                              | `ConfirmDialog` (**sin código propio**) |
| Confirmar desde un handler (`await confirm(payload)`), cola de preguntas                                                         | `createConfirm()`, `confirm()` + `OverlayHost`                                                     | patrón documentado en la skill          |
| Formulario sucio: bloquear Escape/outside, preguntar                                                                             | `dismissible={false}` + `onDismissAttempt`                                                         | `Dialog`                                |
| Input con clear que devuelve el foco                                                                                             | `Input`, `InputGroup`, `InputClear`, `createInputController`                                       | `Input`, `SearchField`                  |
| Botón con pending/error, `aria-disabled` focusable                                                                               | `Button` (`onClick` async)                                                                         | `Button`                                |
| Label/descr./error accesibles                                                                                                    | `Field*`                                                                                           | `Field` (fase siguiente)                |
| Listas, menús, typeahead, selección, roving focus                                                                                | `Select`, `Combobox`, `Menu`, `Listbox`, `createRovingFocus`, `createTypeahead`, `createSelection` | DataTable/FilterBar más adelante        |
| Drag & drop / reorder (Kanban NF Board)                                                                                          | `createReorder`, `createTransfer`, `bindDrag`                                                      | NF Board                                |
| Paneles redimensionables (maximizar/restaurar)                                                                                   | `Resizable`                                                                                        | `PageLayout` (futuro)                   |
| Undo/redo de un valor                                                                                                            | `createUndoStack`                                                                                  | NF Board                                |

## 4. Capacidades agent-native que conservamos

| Capacidad                | API                                                                                                       | Dónde vive                                                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Inspección               | `createAgent().snapshot()` → `{ ref, component, label, value, actions, items, confirm, pending, error… }` | App consumidora crea el bridge (1 vez, cliente).                                                                                 |
| Acción                   | `agent.act({ steps: [{ ref, action, args }] })`                                                           | Idem. Steps encuentran componente por ref/label/row/kind.                                                                        |
| Búsqueda                 | `agent.query({ text, within, kind })`                                                                     | Idem.                                                                                                                            |
| Acciones declaradas      | `agent: { actions, closed, items, reveals, shown, secret }` en `definePrimitive`                          | **Librería** (nuestras primitives).                                                                                              |
| Permisos                 | `createAgent({ allow(step, {signal}) })`; `step.confirm`                                                  | App consumidora.                                                                                                                 |
| Marcas                   | `data-agent-confirm="frase"`, `data-agent-secret`, `data-agent-hidden`                                    | **Librería** las pone donde la semántica es fija (p.ej. botón confirmatorio destructivo de `ConfirmDialog`), la app en el resto. |
| Veto por valor           | `details.source === "agent"` + `details.cancel()`                                                         | App.                                                                                                                             |
| Observación              | `agent.subscribe`, `observe` (`@ui-sdk/react/observe`), `withSource`                                      | App.                                                                                                                             |
| History/Undo             | `createHistory(agent)`, `undoSource("agent")`, `stageChanges`                                             | App (experimental).                                                                                                              |
| WebMCP                   | `registerTools(agent, { allow })` → `document.modelContext`                                               | App (no-op sin WebMCP).                                                                                                          |
| Tools para modelo propio | `agentTools` (JSON Schemas de snapshot/act/query)                                                         | App.                                                                                                                             |

**Regla para Eskais UI**: los componentes deben (a) usar partes de UI SDK para todo control operable (un `<button>`/`<input>` desnudo es invisible al bridge), (b) tener nombre accesible siempre, (c) propagar `on*Change` y `controller` del componente subyacente sin ocultarlos, (d) declarar `agent.actions` explícitas en primitives propias, (e) nunca exponer como acción algo con efecto de negocio sin `data-agent-confirm`.

## 5. Personalización y composición

- Partes sin estilo + `className` (string o función de estado) + `render` (cambiar el elemento) → la API natural de shadcn se mantiene.
- Nuestros componentes = **partes de UI SDK con clases Tailwind basadas en tokens**, distribuidas como código fuente (registry). El consumidor edita el fichero.
- Exportamos tanto el componente "armado" (p.ej. `ConfirmDialog`) como las partes estilizadas (`DialogContent`, `DialogTitle`…) para componer libremente.
- No usamos `web.css` como base visual (choca con Tailwind preflight y con nuestros tokens), pero sí respetamos su contrato de capa: `@layer ui-sdk;` arriba del CSS global.

## 6. Limitaciones encontradas

- **Muy nuevo**: 0.1.0-beta.1 publicado el 2026-11-12; `latest`=beta.3 y `beta`=beta.5 el mismo día (15-11). Hay que **fijar versión exacta** y esperar breaking changes.
- `agent` key de `definePrimitive` y `history` están marcados **experimental**.
- El bridge sólo ve componentes UI SDK; un control "a mano" no existe para el agente.
- `InputGroup` aparece en el snapshot como un componente `input` **sin label** con acción `clear` (spike). Rompe el "todo entry tiene nombre" del test oficial → hay que nombrarlo o filtrarlo; documentado como gap a reportar.
- En jsdom, `dispatch` desde un evento sintético reporta `source: "programmatic"` (no `keyboard`). En navegador real no debería; los tests no deben afirmar `keyboard` en eventos de user-event para `dispatch`.
- `createAgent` no tiene `destroy`; un bridge por fichero de test.
- `happy-dom` da falsos negativos en `checkPattern` (ids de `aria-labelledby`, Enter en trigger). Usar **jsdom**.
- Contraste/posicionamiento/top layer sólo verificables en navegador real.
- React 19 y `@types/react >= 19.2.10` obligatorios.
- (P1) `InputGroup` sin nombre: resuelto en `SearchField` renderizándolo como `<fieldset aria-label>`. `data-agent-hidden` no sirve (oculta también el input).
- (P1) `shadcn add` escribe `^0.1.0-beta.5` en el consumidor: el caret admite betas posteriores con breaking changes. Los consumidores deben fijar la versión exacta.
- (P1) pnpm 11+ rechaza por defecto paquetes con menos de `minimumReleaseAge` (UI SDK beta.5 tiene días): el consumidor debe excluir `@ui-sdk/*` o bajar el umbral.

## 7. Arquitectura mínima que recomienda la documentación

1. Instalar `@ui-sdk/core` + `@ui-sdk/react` (peer), importar siempre desde entradas (`@ui-sdk/react/dialog`), nunca `internal/*`.
2. AGENTS.md apuntando a la skill y a `node_modules/@ui-sdk/react/docs/llms.txt`.
3. Interfaces con componentes del catálogo (path 1); sólo lo que falte, con `definePrimitive` + `createParts` (path 2).
4. Estilos por `data-slot`/estado; `@layer ui-sdk;` primero.
5. Bridge `createAgent` creado una vez en cliente por la app; `registerTools` opcional.
6. Tests: testing library + agent test por interfaz; primitives con `mount`/`checkPattern`/`checkServer`/`checkDirection` + "break it on purpose".

No hay una "segunda capa" recomendada: la doc empuja a componer partes y controllers directamente.

## 8. Spike ejecutado (scratchpad, no en repo todavía)

- Primitive `search-field` (rol `search`, Escape limpia sólo si hay texto y entonces hace `stopPropagation`, Enter → `dispatch("onSearch")`, `agent: { actions: ["submit"], shown: s => s.searchable }`) envolviendo `Input`/`InputGroup`/`InputClear` vía `createInputController`.
- `agent.snapshot()` lista `input "Search projects" [setValue, clear]` y `search-field "Search projects" [submit]`; `agent.act([setValue "atlas", submit])` → `ok: true` y `onSearch("atlas", { source: "agent" })`.
- `checkPattern(dialog, "dialog")` + Escape devuelve foco: **pasa** en Vitest+jsdom y en `bun test`+jsdom (preload); **falla** en `bun test`+happy-dom.
