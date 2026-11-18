import { WidgetType, type EditorView } from "@codemirror/view"

type PortalEntry =
  | { kind: "code-language"; host: HTMLElement; view: EditorView; info: string }
  | { kind: "table"; host: HTMLElement; view: EditorView; source: string }
  | { kind: "embed"; host: HTMLElement; view: EditorView; target: string; alias: string | undefined }

/** Widgets whose content React renders through portals, so their controls are UI SDK parts. */
class PortalStore {
  private entries = new Map<HTMLElement, PortalEntry>()
  private listeners = new Set<() => void>()
  private snapshot: PortalEntry[] = []

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  readonly getSnapshot = () => this.snapshot

  set(entry: PortalEntry) {
    this.entries.set(entry.host, entry)
    this.changed()
  }
  delete(host: HTMLElement) {
    if (this.entries.delete(host)) this.changed()
  }
  private changed() {
    this.snapshot = [...this.entries.values()]
    for (const listener of this.listeners) listener()
  }
}

class BulletWidget extends WidgetType {
  override eq() {
    return true
  }
  toDOM() {
    const span = document.createElement("span")
    span.dataset.slot = "markdown-bullet"
    span.setAttribute("aria-hidden", "true")
    return span
  }
  override ignoreEvent() {
    return false
  }
}

class TaskWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly label: string,
  ) {
    super()
  }
  override eq(other: TaskWidget) {
    return other.checked === this.checked && other.label === this.label
  }
  toDOM() {
    const box = document.createElement("input")
    box.type = "checkbox"
    box.checked = this.checked
    box.dataset.slot = "markdown-task"
    box.setAttribute("aria-label", this.label)
    return box
  }
  override ignoreEvent() {
    return false
  }
}

class LabelWidget extends WidgetType {
  constructor(readonly text: string) {
    super()
  }
  override eq(other: LabelWidget) {
    return other.text === this.text
  }
  toDOM() {
    const span = document.createElement("span")
    span.textContent = this.text
    return span
  }
  override ignoreEvent() {
    return false
  }
}

class CodeLanguageWidget extends WidgetType {
  constructor(
    readonly info: string,
    readonly store: PortalStore,
  ) {
    super()
  }
  override eq(other: CodeLanguageWidget) {
    return other.info === this.info && other.store === this.store
  }
  toDOM(view: EditorView) {
    const host = document.createElement("span")
    host.dataset.slot = "markdown-code-language"
    host.contentEditable = "false"
    this.store.set({ kind: "code-language", host, view, info: this.info })
    return host
  }
  override destroy(dom: HTMLElement) {
    this.store.delete(dom)
  }
}

class TableWidget extends WidgetType {
  constructor(
    readonly source: string,
    readonly store: PortalStore,
    readonly rows: number,
  ) {
    super()
  }
  override eq(other: TableWidget) {
    return other.source === this.source && other.store === this.store
  }
  override get estimatedHeight() {
    return this.rows * 36
  }
  toDOM(view: EditorView) {
    const host = document.createElement("div")
    host.dataset.slot = "markdown-table-widget"
    host.contentEditable = "false"
    this.store.set({ kind: "table", host, view, source: this.source })
    return host
  }
  override ignoreEvent(event: Event) {
    return event.type !== "mousedown"
  }
  override destroy(dom: HTMLElement) {
    this.store.delete(dom)
  }
}

class EmbedWidget extends WidgetType {
  constructor(
    readonly target: string,
    readonly alias: string | undefined,
    readonly store: PortalStore,
  ) {
    super()
  }
  override eq(other: EmbedWidget) {
    return other.target === this.target && other.alias === this.alias && other.store === this.store
  }
  toDOM(view: EditorView) {
    const host = document.createElement("span")
    host.dataset.slot = "markdown-embed-widget"
    host.contentEditable = "false"
    this.store.set({ kind: "embed", host, view, target: this.target, alias: this.alias })
    return host
  }
  override destroy(dom: HTMLElement) {
    this.store.delete(dom)
  }
}

export { BulletWidget, CodeLanguageWidget, EmbedWidget, LabelWidget, PortalStore, TableWidget, TaskWidget }
export type { PortalEntry }
