import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, test } from "vitest"

import { diffTextAsync } from "@/lib/diff-async"
import { intraline, pairLines } from "@/lib/diff-intraline"
import { createLineDiff, diffFile, diffText, splitLines } from "@/lib/diff-lines"
import { formatHunks, parsePatch } from "@/lib/diff-patch"
import { createSequenceDiff, sequenceDiff } from "@/lib/diff-sequence"

const fixture = (name: string) => readFileSync(join(import.meta.dirname, "fixtures", "diff", name), "utf8")

const hunksOf = (patch: string) => patch.slice(patch.indexOf("@@")).trimEnd()

function lcsLength(a: Int32Array, b: Int32Array) {
  const row = new Int32Array(b.length + 1)
  for (let i = 1; i <= a.length; i++) {
    let previous = 0
    for (let j = 1; j <= b.length; j++) {
      const saved = row[j]!
      row[j] = a[i - 1] === b[j - 1] ? previous + 1 : Math.max(row[j]!, row[j - 1]!)
      previous = saved
    }
  }
  return row[b.length]!
}

function checkMatches(a: Int32Array, b: Int32Array, matches: Int32Array) {
  let last = -1
  let count = 0
  for (let i = 0; i < a.length; i++) {
    const j = matches[i]!
    if (j < 0) continue
    expect(j).toBeGreaterThan(last)
    expect(b[j]).toBe(a[i])
    last = j
    count++
  }
  return count
}

function seededRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648
    return state / 2_147_483_648
  }
}

function randomSequence(next: () => number, length: number, alphabet: number) {
  return Int32Array.from({ length }, () => Math.floor(next() * alphabet))
}

describe("sequence diff", () => {
  test("Myers finds a longest common subsequence, against a naive LCS on random inputs", () => {
    const next = seededRandom(42)
    for (let round = 0; round < 400; round++) {
      const a = randomSequence(next, Math.floor(next() * 40), 1 + Math.floor(next() * 6))
      const b =
        next() < 0.3 ? a.map((id) => (next() < 0.2 ? id + 1 : id)) : randomSequence(next, Math.floor(next() * 40), 6)
      const matches = sequenceDiff.match(a, b, "myers", 1_000_000)
      expect(checkMatches(a, b, matches), `round ${String(round)}`).toBe(lcsLength(a, b))
    }
  })

  test("histogram gives a valid common subsequence on random inputs", () => {
    const next = seededRandom(7)
    for (let round = 0; round < 400; round++) {
      const a = randomSequence(next, Math.floor(next() * 60), 1 + Math.floor(next() * 10))
      const b = randomSequence(next, Math.floor(next() * 60), 1 + Math.floor(next() * 10))
      const matched = checkMatches(a, b, sequenceDiff.match(a, b, "histogram"))
      expect(matched).toBeLessThanOrEqual(lcsLength(a, b))
    }
  })

  test("the cost cut still gives a valid, if longer, script", () => {
    const next = seededRandom(3)
    const a = randomSequence(next, 3000, 50)
    const b = randomSequence(next, 3000, 50)
    const matched = checkMatches(a, b, sequenceDiff.match(a, b, "myers", 4))
    expect(matched).toBeGreaterThan(0)
  })

  test("is self-contained, so a worker can run it from its source", () => {
    const rebuilt = new Function(`return (${String(createSequenceDiff)})()`)() as ReturnType<typeof createSequenceDiff>
    const lines = new Function("sequence", `return (${String(createLineDiff)})(sequence)`)(rebuilt) as ReturnType<
      typeof createLineDiff
    >
    expect(lines.diffText("a\nb\n", "a\nc\n")).toEqual(diffText("a\nb\n", "a\nc\n"))
  })
})

describe("line diff", () => {
  const oldCode = fixture("code-old.ts.txt")
  const newCode = fixture("code-new.ts.txt")

  test("matches git diff --histogram, headings included", () => {
    expect(formatHunks(diffText(oldCode, newCode).hunks)).toBe(hunksOf(fixture("code-histogram.patch")))
  })

  test("matches git diff --minimal with Myers", () => {
    expect(formatHunks(diffText(oldCode, newCode, { algorithm: "myers" }).hunks)).toBe(
      hunksOf(fixture("code-myers.patch")),
    )
  })

  test("counts and line numbers", () => {
    const diff = diffText("a\nb\nc\n", "a\nB\nc\nd\n", { context: 0 })
    expect(diff).toMatchObject({ status: "ok", additions: 2, deletions: 1, oldLineCount: 3, newLineCount: 4 })
    expect(formatHunks(diff.hunks)).toBe("@@ -2 +2 @@ a\n-b\n+B\n@@ -3,0 +4 @@ b\n+d")
  })

  test("merges changes closer than two contexts into one hunk", () => {
    const old = "1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n"
    expect(diffText(old, old.replace("2\n", "two\n").replace("8\n", "eight\n")).hunks).toHaveLength(1)
    expect(diffText(old, old.replace("1\n", "one\n").replace("9\n", "nine\n")).hunks).toHaveLength(2)
  })

  test("a missing final newline is a change of its own", () => {
    const diff = diffText("a\nb", "a\nb\n")
    expect(formatHunks(diff.hunks)).toBe("@@ -1,2 +1,2 @@\n a\n-b\n\\ No newline at end of file\n+b")
  })

  test("whitespace options", () => {
    expect(diffText("a  b\n", "a b\n", { ignoreWhitespace: "change" }).hunks).toHaveLength(0)
    expect(diffText("a b\n", "ab\n", { ignoreWhitespace: "all" }).hunks).toHaveLength(0)
    expect(diffText("a \n", "a\n", { ignoreWhitespace: "trailing" }).hunks).toHaveLength(0)
    expect(diffText("a \n", "a\n").hunks).toHaveLength(1)
  })

  test("guards binary and very large inputs", () => {
    expect(diffText("a\0b", "a").status).toBe("binary")
    expect(diffText("a\nb\nc\n", "a\n", { maxLines: 2 }).status).toBe("too-large")
    expect(diffText("abc", "abcd", { maxChars: 3 }).status).toBe("too-large")
  })

  test("diffFile names the status from the paths", () => {
    expect(diffFile("a\n", "b\n", { oldPath: "x" })).toMatchObject({ status: "modified", newPath: "x", oldText: "a\n" })
    expect(diffFile("", "b\n", { oldPath: null, newPath: "x" }).status).toBe("added")
    expect(diffFile("a\n", "", { oldPath: "x", newPath: null }).status).toBe("deleted")
    expect(diffFile("a\n", "b\n", { oldPath: "x", newPath: "y" }).status).toBe("renamed")
    expect(diffFile("a\0", "b").binary).toBe(true)
  })

  test("CRLF and LF split the same", () => {
    expect(splitLines("a\r\nb\r\n")).toEqual(["a", "b"])
    expect(splitLines("")).toEqual([])
  })

  test("a 20,000-line file with scattered edits diffs quickly", () => {
    const old = Array.from({ length: 20_000 }, (_, index) => `line ${String(index)} ${String(index % 97)}`)
    const next = old.map((line, index) => (index % 50 === 0 ? `${line} changed` : line))
    const start = performance.now()
    const diff = diffText(old.join("\n"), next.join("\n"))
    // Perf: guards against a quadratic blowup (minutes), loose for shared CI runners; diff-bench times it for real.
    expect(performance.now() - start).toBeLessThan(5000)
    expect(diff.additions).toBe(400)
    expect(diff.deletions).toBe(400)
  })

  test("two unrelated large files stay fast", () => {
    const next = seededRandom(9)
    const a = Array.from({ length: 10_000 }, () => String(Math.floor(next() * 500))).join("\n")
    const b = Array.from({ length: 10_000 }, () => String(Math.floor(next() * 500))).join("\n")
    const start = performance.now()
    diffText(a, b, { algorithm: "myers" })
    expect(performance.now() - start).toBeLessThan(10_000)
  })

  test("diffTextAsync falls back to the main thread without workers", async () => {
    expect(await diffTextAsync("a\n", "b\n", { worker: true })).toEqual(diffText("a\n", "b\n"))
    const controller = new AbortController()
    controller.abort()
    await expect(diffTextAsync("a", "b", { signal: controller.signal })).rejects.toThrow(/aborted/)
  })
})

describe("intraline", () => {
  test("highlights the words that changed", () => {
    const result = intraline("const fallbackPage = 10", "const fallbackPage = 12")
    expect(result).toEqual({ old: [[21, 23]], new: [[21, 23]] })
  })

  test("joins two changed words across a space", () => {
    const result = intraline("let alpha beta = 1", "let gamma delta = 1")
    expect(result?.new).toEqual([[4, 15]])
  })

  test("char mode", () => {
    expect(intraline("color", "colour", { mode: "char" })).toEqual({ old: [], new: [[4, 5]] })
  })

  test("no highlight for a rewritten or very long line", () => {
    expect(intraline("alpha beta gamma", "one two three")).toBeNull()
    expect(intraline("x".repeat(2000), "y".repeat(2000))).toBeNull()
    expect(intraline("same", "same")).toBeNull()
  })

  test("pairs removed and added lines in order", () => {
    const diff = diffText("a\nb\nc\n", "A\nB\nc\n")
    const lines = diff.hunks[0]!.lines
    const partners = pairLines(lines)
    expect(partners.get(lines[0]!)).toBe(lines[2])
    expect(partners.get(lines[3]!)).toBe(lines[1])
    expect(partners.has(lines[4]!)).toBe(false)
  })
})

describe("parsePatch", () => {
  const files = parsePatch(fixture("real.patch"))
  const byPath = (path: string) => files.find((file) => (file.newPath ?? file.oldPath) === path)!

  test("reads every file of a real git diff", () => {
    expect(files.map((file) => [file.oldPath, file.newPath, file.status])).toEqual([
      [null, "added.txt", "added"],
      ["café.md", "café.md", "modified"],
      ["eof.txt", "eof.txt", "modified"],
      ["gone.txt", null, "deleted"],
      ["image.bin", "image.bin", "modified"],
      ["math.js", "math.js", "modified"],
      ["modify.txt", "modify.txt", "modified"],
      ["pure-old.txt", "pure-new.txt", "renamed"],
      ["renamed-old.txt", "renamed-new.txt", "renamed"],
      ["script.sh", "script.sh", "modified"],
      ["with space.txt", "with space.txt", "modified"],
    ])
  })

  test("counts, modes, similarity, binary and missing newlines", () => {
    expect(byPath("added.txt")).toMatchObject({ additions: 2, deletions: 0, newMode: "100644" })
    expect(byPath("image.bin")).toMatchObject({ binary: true, hunks: [] })
    expect(byPath("script.sh")).toMatchObject({ oldMode: "100644", newMode: "100755", hunks: [] })
    expect(byPath("pure-new.txt")).toMatchObject({ similarity: 100, hunks: [] })
    expect(byPath("renamed-new.txt")).toMatchObject({ similarity: 93, additions: 1, deletions: 1 })
    expect(byPath("eof.txt").hunks[0]!.lines[0]).toMatchObject({ kind: "removed", noNewline: true })
    expect(byPath("math.js").hunks[0]).toMatchObject({
      oldStart: 2,
      newStart: 2,
      heading: "export function add(a, b) {",
    })
  })

  test("round-trips hunks", () => {
    const patch = fixture("code-histogram.patch")
    const [file] = parsePatch(patch)
    expect(formatHunks(file!.hunks)).toBe(patch.slice(patch.indexOf("@@")).trimEnd())
  })

  test("a removed line that starts with -- stays in its hunk", () => {
    const [file] = parsePatch("--- a/x\n+++ b/x\n@@ -1,2 +1,1 @@\n--- not a header\n keep\n")
    expect(file!.hunks[0]!.lines.map((line) => line.kind)).toEqual(["removed", "context"])
    expect(file!.hunks[0]!.lines[0]!.text).toBe("-- not a header")
  })

  test("skips a commit message and reads plain diff -u", () => {
    const parsed = parsePatch(
      "From abc Mon Sep 17 00:00:00 2001\nSubject: [PATCH] x\n\n---\n x | 2 +-\n\n--- x.orig\t2024-01-01\n+++ x\t2024-01-02\n@@ -1 +1 @@\n-a\n+b\n",
    )
    expect(parsed).toHaveLength(1)
    expect(parsed[0]).toMatchObject({ oldPath: "x.orig", newPath: "x", additions: 1, deletions: 1 })
  })
})
