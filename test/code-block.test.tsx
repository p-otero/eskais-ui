import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { Code, CodeBlock } from "@/components/ui/code-block"
import { codeBlock } from "@/components/ui/code-block-primitive"
import { highlight, loadParser, normalizeLanguage } from "@/components/ui/code-highlight"
import { CodeTabs } from "@/components/ui/code-tabs"
import { MarkdownView } from "@/components/ui/markdown-view"

import { axeViolations } from "./axe"

const agent = createAgent()
const writeText = vi.fn(async (_text: string) => {})

beforeEach(() => {
  writeText.mockClear()
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
})

afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard")
})

const toneOf = (code: string, language: Parameters<typeof highlight>[1], text: string) =>
  highlight(code, language)
    .flatMap((line) => line.tokens)
    .find((token) => token.text.trim() === text.trim())?.tone

test("languages normalise from fence names and aliases", () => {
  expect(normalizeLanguage("TypeScript")).toBe("ts")
  expect(normalizeLanguage("tsx title=app.tsx")).toBe("tsx")
  expect(normalizeLanguage("zsh")).toBe("bash")
  expect(normalizeLanguage("markdown")).toBe("md")
  expect(normalizeLanguage("cobol")).toBe("plaintext")
  expect(normalizeLanguage()).toBe("plaintext")
})

test("each language gives its tokens a syntax tone once its parser loads", async () => {
  await Promise.all((["tsx", "json", "css", "html", "md"] as const).map((language) => loadParser(language)))
  const tsx = 'import { x } from "y"\n// note\nconst n = 42\nfunction go() {}\n<Card title="a" />'
  expect(toneOf(tsx, "tsx", "import")).toBe("keyword")
  expect(toneOf(tsx, "tsx", '"y"')).toBe("string")
  expect(toneOf(tsx, "tsx", "// note")).toBe("comment")
  expect(toneOf(tsx, "tsx", "42")).toBe("number")
  expect(toneOf(tsx, "tsx", "go")).toBe("function")
  expect(toneOf(tsx, "tsx", "Card")).toBe("tag")
  expect(toneOf('{ "a": true }', "json", '"a"')).toBe("property")
  expect(toneOf(".a { color: red }", "css", "color")).toBe("property")
  expect(toneOf('<div class="a"></div>', "html", "div")).toBe("tag")
  expect(toneOf("# Title", "md", "Title")).toBe("keyword")
  expect(toneOf("npx shadcn add --yes $HOME # done", "bash", "npx")).toBe("function")
  expect(toneOf("npx shadcn add --yes $HOME # done", "bash", " --yes")).toBe("type")
  expect(toneOf("npx shadcn add --yes $HOME # done", "bash", "# done")).toBe("comment")
  expect(highlight("+ added\n- removed\n@@ -1 +1 @@\n same", "diff").map((line) => line.diff)).toEqual([
    "inserted",
    "deleted",
    "hunk",
    undefined,
  ])
})

test("renders highlighted React elements, never an HTML string", async () => {
  const { container } = render(<CodeBlock code={'const a = "<b>x</b>"'} language="ts" title="a.ts" />)
  await waitFor(() => expect(container.querySelector(".text-syntax-keyword")?.textContent).toBe("const"))
  expect(container.querySelector("b")).toBeNull()
  expect(container.textContent).toContain('"<b>x</b>"')
  expect(await axeViolations(container)).toEqual([])
})

test("copy writes the code, says Copied and calls onCopy", async () => {
  const onCopy = vi.fn()
  render(<CodeBlock code={"npm i\n"} language="bash" onCopy={onCopy} />)
  await userEvent.click(screen.getByRole("button", { name: "Copy code" }))
  expect(writeText).toHaveBeenCalledWith("npm i")
  expect(onCopy).toHaveBeenCalledWith("npm i", expect.objectContaining({ reason: "copy" }))
  expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy()
  expect(screen.getByRole("status").textContent).toBe("Copied")
})

test("line numbers, highlighted lines, wrap and maxHeight", () => {
  const { container } = render(
    <CodeBlock
      code={"a\nb\nc\nd"}
      lineNumbers
      highlightLines={[1, [3, 4]]}
      wrap
      maxHeight="10rem"
      labels={{ code: "Sample" }}
    />,
  )
  const lines = [...container.querySelectorAll("[data-slot=code-line]")]
  expect(lines.map((line) => line.hasAttribute("data-highlighted"))).toEqual([true, false, true, true])
  expect(lines[1]?.querySelector("[data-slot=code-line-number]")?.textContent).toBe("2")
  expect(container.querySelector("pre")?.className).toContain("whitespace-pre-wrap")
  expect(container.querySelector("pre")?.getAttribute("tabindex")).toBe("0")
  expect(screen.getByRole("group", { name: "Sample" })).toBeTruthy()
})

test("agents read the code and copy it by the block's name", async () => {
  render(<CodeBlock code="npx shadcn add @eskais/link" language="bash" title="Install" />)
  const entry = agent.snapshot().find((item) => !item.offPage && item.component === "code-block")
  expect(entry?.label).toBe("Install")
  expect(entry?.value).toBe("npx shadcn add @eskais/link")
  expect(entry?.actions).toEqual(["copy"])
  const labels = agent
    .snapshot()
    .filter((item) => !item.offPage)
    .map((item) => item.label)
  expect(labels).not.toContain("Copy code")
  const result = await agent.act({ steps: [{ ref: "Install", action: "copy" }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(writeText).toHaveBeenCalledWith("npx shadcn add @eskais/link")
})

test("CodeTabs shows one file per tab", async () => {
  render(
    <CodeTabs
      aria-label="Files"
      files={[
        { title: "app.tsx", code: "export {}", language: "tsx" },
        { title: "app.css", code: "a {}", language: "css" },
      ]}
    />,
  )
  expect(screen.getByRole("tablist", { name: "Files" })).toBeTruthy()
  await userEvent.click(screen.getByRole("tab", { name: "app.css" }))
  expect(screen.getByRole("group", { name: "app.css" }).textContent).toContain("a {}")
})

test("Code is inline code", () => {
  render(
    <p>
      Run <Code>bun test</Code>
    </p>,
  )
  expect(screen.getByText("bun test").tagName).toBe("CODE")
})

test("MarkdownView renders fenced code with CodeBlock", async () => {
  await act(() => loadParser("ts"))
  const { container } = render(<MarkdownView markdown={"```ts\nconst a = 1\n```"} />)
  const block = container.querySelector("[data-slot=code-block]")
  expect(block?.getAttribute("data-language")).toBe("ts")
  expect(block?.querySelector(".text-syntax-keyword")?.textContent).toBe("const")
})

test("primitive: renders on the server", () => {
  checkServer(codeBlock, { text: "a" }, "<root><pre>a</pre></root>")
})
