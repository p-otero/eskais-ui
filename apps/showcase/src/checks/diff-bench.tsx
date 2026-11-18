import { GitDiff } from "@/components/ui/git-diff"
import { TextDiff } from "@/components/ui/text-diff"
import { diffText } from "@/lib/diff-lines"
import { formatHunks } from "@/lib/diff-patch"

declare global {
  var diffBench: { start: number; mounted?: number; ready?: boolean } | undefined
}

const params = new URLSearchParams(location.search)
const kind = params.get("kind") === "patch" ? "patch" : "text"
const lines = Number(params.get("lines") ?? 20_000)
const fileCount = Number(params.get("files") ?? 500)
const layout = params.get("layout") === "split" ? "split" : "unified"
const findable = params.get("findable") !== "false"
const tree = params.get("tree") !== "false"

// Code-shaped lines, so the highlighter does real work.
function source(count: number, seed: number) {
  const out: string[] = []
  for (let index = 0; index < count; index++) {
    const n = (index * 7 + seed) % 97
    if (index % 12 === 0) out.push(`export function handler${String(index)}(input: string, limit = ${String(n)}) {`)
    else if (index % 12 === 11) out.push("}")
    else if (index % 5 === 0) out.push(`  // step ${String(index)}: normalize the value before it is stored`)
    else out.push(`  const value${String(index)} = input.slice(${String(n)}, limit) + "${String(index)}"`)
  }
  return out
}

function edit(base: string[], every: number) {
  return base.flatMap((line, index) => {
    if (index % every === 3) return [line.replace("const", "let").replace("value", "next")]
    if (index % every === 7) return [line, `  console.log("added ${String(index)}")`]
    if (index % every === 9) return []
    return [line]
  })
}

const oldLines = source(lines, 1)
const oldText = `${oldLines.join("\n")}\n`
const newText = `${edit(oldLines, 40).join("\n")}\n`

function buildPatch() {
  const parts: string[] = []
  for (let file = 0; file < fileCount; file++) {
    const base = source(60 + (file % 7) * 40, file)
    const path = `packages/pkg-${String(file % 23)}/src/module-${String(file)}.ts`
    const diff = diffText(`${base.join("\n")}\n`, `${edit(base, 30).join("\n")}\n`)
    parts.push(
      `diff --git a/${path} b/${path}`,
      "index 1111111..2222222 100644",
      `--- a/${path}`,
      `+++ b/${path}`,
      formatHunks(diff.hunks),
    )
  }
  return `${parts.join("\n")}\n`
}

const patch = kind === "patch" ? buildPatch() : ""

globalThis.diffBench = { start: performance.now() }

function markMounted(node: HTMLElement | null) {
  if (!node) return
  const check = () => {
    if (!node.querySelector('[role="gridcell"]')) {
      requestAnimationFrame(check)
      return
    }
    requestAnimationFrame(() => {
      const channel = new MessageChannel()
      channel.port1.addEventListener("message", () => {
        if (globalThis.diffBench) {
          globalThis.diffBench.mounted = performance.now() - globalThis.diffBench.start
          globalThis.diffBench.ready = true
        }
      })
      channel.port1.start()
      channel.port2.postMessage(null)
    })
  }
  check()
}

/** ?demo=diff-bench&kind=text&lines=20000 or kind=patch&files=500: the diffs tooling/diff-bench.mjs times. */
function DiffBench() {
  return (
    <main ref={markMounted} className="flex h-dvh flex-col p-inset-surface">
      {kind === "text" ? (
        <TextDiff
          aria-label="Benchmark diff"
          oldText={oldText}
          newText={newText}
          language="ts"
          defaultLayout={layout}
          height="fill"
          className="min-h-0 flex-1"
        />
      ) : (
        <GitDiff
          aria-label="Benchmark patch"
          patch={patch}
          defaultLayout={layout}
          findable={findable}
          fileTree={tree}
          className="min-h-0 flex-1"
        />
      )}
    </main>
  )
}

export { DiffBench }
