"use client"

import type { ChangeDetails } from "@ui-sdk/core"
import { useMemo, useState, useSyncExternalStore } from "react"

import {
  createSidebarController,
  type SidebarCollapsedChangeReason,
  type SidebarController,
} from "@/components/ui/sidebar-primitive"

type SidebarStateOptions = {
  /** Remembers the collapsed state in localStorage under this key, across reloads and tabs. */
  storageKey?: string
  defaultCollapsed?: boolean
}

type SidebarState = {
  controller: SidebarController
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
  /** Spread on the Sidebar. */
  sidebarProps: {
    controller: SidebarController
    collapsed: boolean
    onCollapsedChange: (collapsed: boolean, details: ChangeDetails<SidebarCollapsedChangeReason>) => void
  }
  /** Spread on the SidebarTrigger that toggles it, like one in a Topbar's `leading`. */
  triggerProps: { controller: SidebarController; collapsed: boolean }
}

const listeners = new Map<string, Set<() => void>>()

// Spec: storage can throw (blocked site data, a sandboxed frame).
function readStored(key: string): boolean | undefined {
  let value: string | null = null
  try {
    value = localStorage.getItem(key)
  } catch {
    return undefined
  }
  return value === null ? undefined : value === "collapsed"
}

function writeStored(key: string, collapsed: boolean) {
  try {
    localStorage.setItem(key, collapsed ? "collapsed" : "expanded")
  } catch {}
  for (const listener of listeners.get(key) ?? []) listener()
}

function subscribeTo(key: string) {
  return (notify: () => void) => {
    const own = listeners.get(key) ?? new Set()
    listeners.set(key, own)
    own.add(notify)
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) notify()
    }
    addEventListener("storage", onStorage)
    return () => {
      own.delete(notify)
      removeEventListener("storage", onStorage)
    }
  }
}

const noStorage = () => () => {}

/**
 * A sidebar's controller and collapsed state for a Sidebar and the SidebarTrigger that toggles it, remembered under
 * `storageKey`. The server and the first client render use `defaultCollapsed`, so hydration matches.
 */
function useSidebarState({ storageKey, defaultCollapsed = false }: SidebarStateOptions = {}): SidebarState {
  const [controller] = useState(createSidebarController)
  const [own, setOwn] = useState(defaultCollapsed)
  const subscribe = useMemo(() => (storageKey === undefined ? noStorage : subscribeTo(storageKey)), [storageKey])
  const stored = useSyncExternalStore(
    subscribe,
    () => (storageKey === undefined ? undefined : readStored(storageKey)),
    () => undefined,
  )
  const collapsed = storageKey === undefined ? own : (stored ?? defaultCollapsed)
  const setCollapsed = (next: boolean) => (storageKey === undefined ? setOwn(next) : writeStored(storageKey, next))
  return {
    controller,
    collapsed,
    setCollapsed,
    sidebarProps: {
      controller,
      collapsed,
      onCollapsedChange: (next, details) => {
        if (!details.canceled) setCollapsed(next)
      },
    },
    triggerProps: { controller, collapsed },
  }
}

export { useSidebarState }
export type { SidebarState, SidebarStateOptions }
