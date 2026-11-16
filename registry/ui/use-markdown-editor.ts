"use client"

import { EditorView } from "@codemirror/view"
import type { TextEditorAdapter } from "@ui-sdk/react/trigger-menu"
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type RefObject } from "react"

import type { MarkdownEditorProps } from "@/components/ui/markdown-editor"
import { createAdapterBridge } from "@/components/ui/markdown-editor-adapter"
import { createEditorState, reconfigure, type EditorSettings } from "@/components/ui/markdown-editor-state"
import { useMarkdownSync } from "@/components/ui/markdown-editor-sync"

/**
 * Mounts a CodeMirror view in `hostRef` once, keeps its settings current, and feeds it each new `value`. Props
 * other than `value` are read when CodeMirror or the sync timers need them, so changing them never rebuilds it.
 */
function useMarkdownEditorView(props: MarkdownEditorProps, settings: EditorSettings) {
  const hostRef = useRef<HTMLDivElement>(null)
  const latest = useRef(props)
  const settingsRef = useRef(settings)
  const [view, setView] = useState<EditorView>()
  const [adapter, setAdapter] = useState<TextEditorAdapter>()
  const sync = useMarkdownSync(latest)
  const { value } = props

  // oxlint-disable-next-line p-otero/no-latest-ref-effect -- CodeMirror's listeners and the sync timers run outside React and read the newest props through these refs; useMarkdownSync takes them as a ref
  useLayoutEffect(() => {
    latest.current = props
    settingsRef.current = settings
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const bridge = createAdapterBridge()
    const hooks = {
      bridge: bridge.extension,
      onUpdate: sync.onUpdate,
      openWikilink: (slug: string) => latest.current.onOpenWikilink?.(slug),
    }
    const initial = latest.current.value ?? latest.current.defaultValue ?? ""
    const languages = latest.current.codeLanguages
    const editor = new EditorView({
      state: createEditorState(initial, settingsRef.current, hooks, languages),
      parent: host,
    })
    const detach = sync.attach(editor, initial, (markdown) =>
      editor.setState(createEditorState(markdown, settingsRef.current, hooks, languages)),
    )
    const attached = bridge.attach(editor)
    setView(editor)
    setAdapter(attached.adapter)
    return () => {
      detach()
      attached.detach()
      editor.destroy()
    }
  }, [sync])

  useEffect(() => {
    if (view) reconfigure(view, settings)
  }, [view, settings])

  useEffect(() => {
    if (view && value !== undefined) sync.receive(value)
  }, [view, value, sync])

  return { hostRef, view, adapter, sync }
}

/** Calls `onResize` with the element each time ResizeObserver reports it, starting with its first size. */
function useResizeObserver<Element extends HTMLElement>(
  ref: RefObject<Element | null>,
  onResize: (element: Element) => void,
) {
  const resized = useEffectEvent(onResize)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => resized(element))
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
}

/** Asks CodeMirror to measure again after every render, since a widget's React content can change its height. */
function useRequestMeasure(view: EditorView) {
  useLayoutEffect(() => view.requestMeasure())
}

export { useMarkdownEditorView, useRequestMeasure, useResizeObserver }
