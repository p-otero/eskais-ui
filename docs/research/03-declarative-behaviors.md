# 03 · ¿Capa de comportamientos declarativos? (evaluación P2)

Pregunta: ¿necesitamos una capa propia que declare comportamientos semánticos (cerrar al éxito, pending, limpiar búsqueda…) para que los agentes no repitan boilerplate?

## Lo que UI SDK ya da (verificado en docs beta.5)

| Comportamiento repetido en Eskais                  | Mecanismo UI SDK                                                                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| pending + evitar doble confirmación                | `AlertDialogClose action={fn}`: `data-pending`, `aria-busy`, `aria-disabled`, otros Close y dismiss bloqueados   |
| cerrar al terminar bien / seguir abierto al fallar | `action` devuelve Promise: resuelve → cierra (reason `action`); rechaza → abierto con `state.error`              |
| anuncio de espera a lectores                       | `pendingAnnouncement`                                                                                            |
| foco inicial / restauración                        | `initialFocus`, `finalFocus`, restauración por defecto al trigger                                                |
| "objeto objetivo" del diálogo                      | `payload` en trigger o `controller.open({ payload })`                                                            |
| confirmar desde un handler                         | `await createConfirm<T>()(payload)` / `confirm()` + `OverlayHost`                                                |
| formulario sucio                                   | `dismissible={false}` + `onDismissAttempt`                                                                       |
| limpiar input + devolver foco                      | `InputClear`, `createInputController().clear()`                                                                  |
| botón async con error                              | `Button onClick` async → pending/error en estado                                                                 |
| sincronizar apertura                               | `open`/`onOpenChange(open, { reason, source, cancel })`, `onOpenChangeComplete`                                  |
| agentes                                            | todo lo anterior aparece en `snapshot` y es ejecutable por `act`; `data-agent-confirm` en el Close confirmatorio |

## Alternativas

|                            | A. Sólo UI SDK                                                                                                 | B. Componentes compuestos                                                                                                                            | C. Capa declarativa propia                                                                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Qué es                     | El consumidor usa partes estilizadas y props UI SDK (`action`, `payload`…)                                     | Componentes de alto nivel que pre-ensamblan partes UI SDK con defaults (p.ej. `ConfirmDialog onConfirm`) y **re-exportan las partes**                | DSL/hook propio (`useDialogBehavior({ closeOnSuccess, … })`, máquina de estados ligera)                                                                     |
| Ventajas                   | Cero abstracción, docs oficiales sirven tal cual, agentes ya conocen la API vía skill oficial                  | Elimina el ensamblaje repetido (título, descripción, botones, variante destructiva, `data-agent-confirm`), API pequeña, sigue siendo código editable | Uniformidad entre componentes                                                                                                                               |
| Inconvenientes             | ~25 líneas de JSX por confirmación; el agente debe recordar `value="confirm"`, `action`, marca de confirmación | Una capa fina más que mantener                                                                                                                       | Duplica lo que UI SDK ya resuelve (pending, dismiss, foco); se rompe con cada beta; oculta `details`/controllers al agente; viola "no reimplementar UI SDK" |
| Complejidad                | Nula                                                                                                           | Baja                                                                                                                                                 | Media-alta                                                                                                                                                  |
| Compatibilidad con agentes | Total                                                                                                          | Total si sólo compone partes UI SDK                                                                                                                  | Riesgo de esconder estado/acciones                                                                                                                          |
| Caso real Eskais           | Diálogos con formularios complejos                                                                             | Las 6 confirmaciones B3/B4, 4 búsquedas B9                                                                                                           | Ninguno que A+B no cubra                                                                                                                                    |

## Recomendación

**A + B. No construir C.**

- La evidencia (B3, B4, B5, B8, B1/B2) muestra que el boilerplate de Eskais existía porque Radix no ofrece `action`/`payload`/`pendingAnnouncement`. UI SDK sí. La capa C sería una reimplementación.
- B se limita a **componentes compuestos editables** que siguen exponiendo las props UI SDK (`controller`, `onOpenChange`, `payload`) y sus partes.
- Lo que queda fuera de UI SDK es presentación (`FilterBar` con reset, `DataState`) → componentes B normales, sin "behaviors".
- Reglas de separación que documenta la skill de Eskais UI:
  - _UI genérica_ (abrir/cerrar, pending, foco): UI SDK.
  - _Aplicación reutilizable_ (confirmar antes de borrar): componente B (`ConfirmDialog`).
  - _Negocio_ (llamar al backend, toasts, invalidar caché): siempre en `onConfirm` del consumidor; el componente nunca ejecuta efectos por sí mismo.

## PoC comparativa: ConfirmDialog

**1 · Convencional (Eskais hoy, Radix)** — ~30 líneas por sitio + `AppConfirmDialog`:

```tsx
const [target, setTarget] = useState<Project | null>(null)
const [busy, setBusy] = useState(false)
const pendingRef = useRef(false)
async function confirm() {
  if (pendingRef.current) return
  pendingRef.current = true; setBusy(true)
  try { await remove(target!.id); setTarget(null) }
  catch (e) { setError(e) }
  finally { pendingRef.current = false; setBusy(false) }
}
<AppConfirmDialog open={target !== null} onConfirm={confirm} onCancel={() => setTarget(null)} … />
// sin aria-describedby, Escape no bloqueado mientras busy, ningún agente lo ve
```

**2 · UI SDK directo (A)** — ~20 líneas, cero estado propio:

```tsx
<AlertDialog pendingAnnouncement="Deleting project">
  <AlertDialogTrigger>Delete project</AlertDialogTrigger>
  <AlertDialogBackdrop />
  <AlertDialogContent>
    <AlertDialogTitle>Delete Apollo?</AlertDialogTitle>
    <AlertDialogDescription>…</AlertDialogDescription>
    <AlertDialogClose>Cancel</AlertDialogClose>
    <AlertDialogClose value="confirm" action={() => remove(id)} data-agent-confirm="Deletes the project and its files">
      Delete forever
    </AlertDialogClose>
  </AlertDialogContent>
</AlertDialog>
```

**3 · Eskais UI `ConfirmDialog` (B)** — ~6 líneas:

```tsx
<ConfirmDialog
  trigger={<Button variant="destructive">Delete project</Button>}
  title="Delete Apollo?"
  description="…"
  confirmLabel="Delete forever"
  tone="destructive"
  agentConfirm="Deletes the project and its files"
  onConfirm={() => remove(id)} // Promise: pending, cierre al éxito, error inline
/>
```

| Criterio                 | 1                       | 2                       | 3                                                        |
| ------------------------ | ----------------------- | ----------------------- | -------------------------------------------------------- |
| Líneas repetidas por uso | ~30                     | ~20                     | ~6                                                       |
| Estado propio            | 3 hooks                 | 0                       | 0                                                        |
| API                      | pequeña pero incompleta | partes (la de UI SDK)   | 8 props + partes re-exportadas                           |
| Flexibilidad             | baja                    | total                   | alta (caer a 2 es trivial: mismo fichero, mismas partes) |
| Accesibilidad            | parcial                 | APG alertdialog probado | idem 2                                                   |
| Agentes                  | invisible               | snapshot/act + confirm  | idem 2, con la marca por defecto en destructivo          |
| Tests                    | a mano                  | `checkPattern`          | `checkPattern` + agent test                              |
| Mantenimiento            | propio                  | upstream                | upstream + ~60 líneas                                    |

Conclusión: implementar `ConfirmDialog` (B) en v0.1 como demostración; no hay hook ni DSL propio.
