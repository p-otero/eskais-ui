"use client"

import { createContext, use, useEffect, useEffectEvent, type RefObject } from "react"

import { addShortcut, type ShortcutLayer } from "@/components/ui/shortcuts-registry"

type ScopeContextValue = { scope: string; layer: () => Element | null }

const ScopeContext = createContext<ScopeContextValue | null>(null)

type UseShortcutOptions = {
  /** A named scope; inside a `ShortcutScope` it defaults to that scope's name. `null` makes it global. */
  scope?: string | null
  /** `false` leaves it unregistered. */
  enabled?: boolean
  /** What it does, for the `ShortcutsDialog`. Without one it still runs but isn't listed. */
  description?: string
  /** Whether it runs while focus is in a text field or contenteditable. Shortcuts with ⌘, Ctrl or ⌥ always do. */
  allowInInput?: boolean
  /** Checked on every key press. */
  when?: () => boolean
  /** An element inside a popup, or a ref to one: the shortcut runs only while that popup is open. */
  layer?: ShortcutLayer | RefObject<Element | null>
}

function layerOf(layer: UseShortcutOptions["layer"], scope: ScopeContextValue | null): ShortcutLayer {
  if (layer === undefined) return scope ? scope.layer : undefined
  if (layer instanceof Element || typeof layer === "function") return layer
  return () => layer.current
}

/**
 * Registers a shortcut while the component is mounted: `"u"`, `"mod+k"`, `"?"` or a sequence `"g i"`. Plain keys
 * never fire while someone types in a field or contenteditable, nor during IME composition. Built on UI SDK's
 * shared `shortcuts`, so modals pause page shortcuts and `ShortcutsDialog` lists them.
 */
function useShortcut(
  keys: string | null | undefined,
  handler: (event: KeyboardEvent) => void,
  { scope, enabled = true, description, allowInInput, when, layer }: UseShortcutOptions = {},
) {
  const context = use(ScopeContext)
  const resolvedScope = scope === null ? undefined : (scope ?? context?.scope)
  const run = useEffectEvent((event: KeyboardEvent) => handler(event))
  const check = useEffectEvent(() => when?.() ?? true)
  const layerContext = scope === null ? null : context
  const hasLayer = layer !== undefined || layerContext !== null
  const currentLayer = useEffectEvent(() => {
    const resolved = layerOf(layer, layerContext)
    return typeof resolved === "function" ? (resolved() ?? null) : (resolved ?? null)
  })

  useEffect(() => {
    if (!keys || !enabled) return
    return addShortcut({
      keys,
      handler: run,
      scope: resolvedScope,
      layer: hasLayer ? currentLayer : undefined,
      description,
      allowInInput,
      when: check,
    })
  }, [keys, enabled, resolvedScope, hasLayer, description, allowInInput])
}

export { ScopeContext, useShortcut }
export type { ScopeContextValue, UseShortcutOptions }
