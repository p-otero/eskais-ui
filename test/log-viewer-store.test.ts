import { expect, test, vi } from "vitest"

import { createLogIndex } from "@/components/ui/log-viewer-index"
import { createLogStore, isErrorLevel } from "@/components/ui/log-viewer-store"

const ESC = "\u001b"
const now = (notify: () => void) => notify()

test("appending notifies once per scheduled frame, however many lines arrive", () => {
  const frames: (() => void)[] = []
  const store = createLogStore({ schedule: (notify) => frames.push(notify) })
  const listener = vi.fn()
  store.subscribe(listener)
  store.append("one")
  store.append(["two", { text: "three", source: "db", level: "warn", time: new Date(5) }])
  expect(frames).toHaveLength(1)
  expect(listener).not.toHaveBeenCalled()
  frames[0]?.()
  expect(listener).toHaveBeenCalledTimes(1)
  expect(store.getSnapshot()).toMatchObject({ firstId: 1, lastId: 3, size: 3, dropped: 0 })
  expect(store.get(3)).toEqual({ id: 3, text: "three", source: "db", level: "warn", time: 5 })
})

test("the buffer keeps the newest maxLines, and ids stay with their lines", () => {
  const store = createLogStore({ maxLines: 3, schedule: now })
  store.append(["a", "b", "c", "d", "e"])
  expect(store.lines().map((line) => [line.id, line.text])).toEqual([
    [3, "c"],
    [4, "d"],
    [5, "e"],
  ])
  expect(store.get(2)).toBeUndefined()
  expect(store.getSnapshot()).toMatchObject({ firstId: 3, lastId: 5, size: 3, dropped: 2 })
  for (let index = 0; index < 20; index++) store.append(String(index))
  expect(store.lines().map((line) => line.text)).toEqual(["17", "18", "19"])
  expect(store.get(store.getSnapshot().lastId)?.text).toBe("19")
})

test("text with newlines becomes lines, CRLF included, and long lines are cut", () => {
  const store = createLogStore({ schedule: now, maxLineLength: 5 })
  store.append({ text: "one\r\ntwo\nthree-long", source: "api" })
  expect(store.lines().map((line) => [line.text, line.source])).toEqual([
    ["one", "api"],
    ["two", "api"],
    ["three…", "api"],
  ])
})

test("write keeps a partial line until the rest arrives, per source, and carries colours across lines", () => {
  const store = createLogStore({ schedule: now })
  store.write(`${ESC}[31mred sta`, { source: "backend" })
  store.write("front", { source: "frontend" })
  expect(store.getSnapshot().size).toBe(0)
  store.write("rts\nstill red\n", { source: "backend" })
  store.write(`${ESC}[0mplain\n`, { source: "backend" })
  store.end("frontend")
  const lines = store.lines()
  expect(lines.map((line) => [line.source, line.text])).toEqual([
    ["backend", "red starts"],
    ["backend", "still red"],
    ["backend", "plain"],
    ["frontend", "front"],
  ])
  expect(lines[1]?.spans).toEqual([{ text: "still red", style: { fg: 1 } }])
  expect(lines[2]?.spans).toBeUndefined()
})

test("clear empties the buffer and notifies at once", () => {
  const store = createLogStore({ schedule: () => {} })
  const listener = vi.fn()
  store.subscribe(listener)
  store.append(["a", "b"])
  store.clear()
  expect(listener).toHaveBeenCalledTimes(1)
  expect(store.getSnapshot()).toMatchObject({ size: 0, generation: 1, lastId: 2, firstId: 3 })
})

test("the index follows appends and evictions without reading the whole buffer, and steps through errors", () => {
  const store = createLogStore({ maxLines: 6, schedule: now })
  const index = createLogIndex(isErrorLevel)
  store.append([
    { text: "boot", source: "api" },
    { text: "query", source: "db" },
    { text: "boom", source: "api", level: "error" },
    { text: "deadlock", source: "db", level: "ERROR" },
  ])
  index.setFilter(store, { hidden: new Set(["db"]), query: "" })
  expect([index.count, index.errorCount, index.sources()]).toEqual([2, 1, ["api", "db"]])

  store.append([
    { text: "retry", source: "api" },
    { text: "fatal: gone", source: "api", level: "fatal" },
    { text: "ok", source: "api" },
  ])
  expect(index.sync(store)).toEqual({ added: 3, removed: 1, rebuilt: false })
  expect([index.count, index.errorCount]).toEqual([4, 2])

  index.setFilter(store, { hidden: new Set(), query: "" })
  const ids = Array.from({ length: index.count }, (_, position) => index.idAt(position))
  expect(ids).toEqual([2, 3, 4, 5, 6, 7])
  expect(index.error(-1, 1)).toBe(1)
  expect(index.error(1, 1)).toBe(2)
  expect(index.error(2, 1)).toBe(4)
  expect(index.error(4, 1)).toBe(-1)
  expect(index.error(index.count, -1)).toBe(4)
  expect(index.error(1, -1)).toBe(-1)

  index.setFilter(store, { hidden: new Set(), query: "  RE" })
  expect(Array.from({ length: index.count }, (_, position) => store.get(index.idAt(position) ?? 0)?.text)).toEqual([
    "retry",
  ])
})
