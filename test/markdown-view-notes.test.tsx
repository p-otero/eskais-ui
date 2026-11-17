import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, test, vi } from "vitest"

import { extractHeadings, MarkdownView, parseFrontmatter } from "@/components/ui/markdown-view"
import { markdownParser } from "@/components/ui/markdown-syntax"

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
const nodeNames = (markdown: string) => {
  const names: string[] = []
  markdownParser.parse(markdown).iterate({ enter: (ref) => void names.push(ref.name) })
  return names
}

const renderEmbed = (target: string, alias?: string) => <figure data-embed={target}>{alias ?? target}</figure>

test("![[target]] and ![[target|alias]] parse as embeds, not as an image around a link", () => {
  expect(nodeNames("![[diagram.png]]")).toEqual(expect.arrayContaining(["Embed", "EmbedMark", "WikilinkTarget"]))
  expect(nodeNames("![[diagram.png]]")).not.toContain("Image")
  expect(nodeNames("![[a|b]]")).toEqual(expect.arrayContaining(["Embed", "WikilinkPipe", "WikilinkLabel"]))
  expect(nodeNames("![alt](x.png)")).toContain("Image")
  expect(nodeNames("![[]]")).not.toContain("Embed")
})

test("an embed renders a link-like placeholder by default, or what renderEmbed returns", () => {
  const plain = renderToStaticMarkup(<MarkdownView markdown={"See ![[plan|the plan]] and ![[diagram.png]]\n"} />)
  expect(plain).toContain('data-slot="markdown-embed"')
  expect(plain).toContain(">the plan</span>")
  expect(plain).not.toContain("![[")

  const html = renderToStaticMarkup(
    <MarkdownView markdown={"![[diagram.png]]\n\nInline ![[plan|Plan]] here.\n"} renderEmbed={renderEmbed} />,
  )
  // Alone in its paragraph, the embed is a block, so a block element never lands inside a <p>.
  expect(html).toMatch(/^<div[^>]*><div data-slot="markdown-embed" data-target="diagram.png"><figure/)
  expect(html).toContain(
    '<p>Inline <span data-slot="markdown-embed" data-target="plan"><figure data-embed="plan">Plan</figure></span> here.</p>',
  )
})

test("an embed with an address is a link, like a wikilink", () => {
  render(<MarkdownView markdown="![[plan|The plan]]" wikilinkHref={(slug) => `#/note/${slug}`} />)
  const link = screen.getByRole("link", { name: "The plan" })
  expect(link.getAttribute("href")).toBe("#/note/plan")
  expect(link.dataset.wikilink).toBe("embed")
})

test("onWikilinkClick takes a wikilink's plain click, and agents follow it by name", async () => {
  const onWikilinkClick = vi.fn()
  render(
    <MarkdownView
      markdown="Read [[roadmap|the roadmap]] and [[missing]]."
      resolveWikilink={(slug) => ({ exists: slug === "roadmap" })}
      wikilinkHref={(slug) => `#/note/${slug}`}
      onWikilinkClick={onWikilinkClick}
    />,
  )
  await settle()
  const link = screen.getByRole("link", { name: "the roadmap" })
  expect(link.getAttribute("href")).toBe("#/note/roadmap")
  expect(link.dataset.wikilink).toBe("link")
  fireEvent.click(link)
  expect(onWikilinkClick).toHaveBeenCalledWith("roadmap", expect.any(MouseEvent))

  // No address: still followable, as a button.
  const missing = screen.getByRole("button", { name: "missing" })
  expect(missing.hasAttribute("data-unresolved")).toBe(true)
  fireEvent.click(missing)
  expect(onWikilinkClick).toHaveBeenLastCalledWith("missing", expect.any(MouseEvent))

  onWikilinkClick.mockClear()
  const agent = createAgent()
  const entries = agent.snapshot().filter((entry) => entry.component === "link")
  expect(entries.map((entry) => entry.label)).toEqual(["the roadmap", "missing"])
  const result = await agent.act({ steps: [{ ref: "the roadmap", action: "follow" }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(onWikilinkClick).toHaveBeenCalledWith("roadmap", undefined)
})

test("a modified click on a wikilink stays with the browser", () => {
  const onWikilinkClick = vi.fn()
  render(
    <MarkdownView markdown="[[roadmap]]" wikilinkHref={() => "/notes/roadmap"} onWikilinkClick={onWikilinkClick} />,
  )
  fireEvent.click(screen.getByRole("link", { name: "roadmap" }), { ctrlKey: true })
  expect(onWikilinkClick).not.toHaveBeenCalled()
})

const withYaml = "---\ntitle: Atlas\ntags: [planning, q3]\naliases:\n  - atlas\n  - 'the map'\n---\n# Atlas\n\nBody\n"

test("frontmatter is hidden by default instead of rendering as a rule and a heading", () => {
  const html = renderToStaticMarkup(<MarkdownView markdown={withYaml} />)
  expect(html).not.toContain("<hr")
  expect(html).not.toContain("title: Atlas")
  expect(html.match(/<h[1-6]/g)).toEqual(["<h1"])
})

test('frontmatter="properties" lists the properties; "raw" shows the YAML; renderFrontmatter replaces both', () => {
  render(<MarkdownView markdown={withYaml} frontmatter="properties" frontmatterLabel="Note properties" />)
  const list = screen.getByLabelText("Note properties")
  expect(list.tagName).toBe("DL")
  expect(
    within(list)
      .getAllByRole("term")
      .map((term) => term.textContent),
  ).toEqual(["title", "tags", "aliases"])
  expect(
    within(list)
      .getAllByRole("definition")
      .map((value) => value.textContent),
  ).toEqual(["Atlas", "planning, q3", "atlas, the map"])

  const raw = renderToStaticMarkup(<MarkdownView markdown={withYaml} frontmatter="raw" />)
  expect(raw).toContain('data-slot="code-block"')
  expect(raw).toContain("tags: [planning, q3]")

  const custom = renderToStaticMarkup(
    <MarkdownView markdown={withYaml} renderFrontmatter={(yaml) => <aside>{yaml.raw.length}</aside>} />,
  )
  expect(custom).toContain("<aside>")
})

test("parseFrontmatter reads key: value lines, lists and blocks, and needs a closing fence", () => {
  const parsed = parseFrontmatter(
    '---\ntitle: "Plan: Q3"\naliases:\n  - plan\n  - \'q3 plan\'\ntags: [a, "b, c"]\nsummary: |\n  Two lines\n  of text\nnote: kept # comment\n# comment\nempty:\nnested:\n  key: skipped\n---\nBody\n',
  )
  expect(parsed?.properties).toEqual([
    { key: "title", value: "Plan: Q3" },
    { key: "aliases", value: ["plan", "q3 plan"] },
    { key: "tags", value: ["a", "b, c"] },
    { key: "summary", value: "Two lines\nof text" },
    { key: "note", value: "kept" },
    { key: "empty", value: "" },
    { key: "nested", value: "" },
  ])
  expect(parsed?.from).toBe(0)
  expect(parsed?.raw.startsWith("title:")).toBe(true)
  expect(parsed?.raw.endsWith("key: skipped")).toBe(true)

  expect(parseFrontmatter("---\r\ntitle: x\r\n...\r\nText\r\n")).toEqual({
    from: 0,
    to: 18,
    raw: "title: x",
    properties: [{ key: "title", value: "x" }],
  })
  expect(parseFrontmatter("---\n---\n")?.raw).toBe("")
  expect(parseFrontmatter("---\ntitle: x\n\nno closing fence\n")).toBeNull()
  expect(parseFrontmatter("\n---\ntitle: x\n---\n")).toBeNull()
  expect(parseFrontmatter("--- \ntitle: x\n---")?.properties).toEqual([{ key: "title", value: "x" }])
})

test("extractHeadings lists headings in order with plain text, editor lines and offsets, past the frontmatter", () => {
  const markdown = `${withYaml}\n## Second **bold** [[page|Page]] \`code\`\n\nSetext\n---\n\n\`\`\`\n# not a heading\n\`\`\`\n`
  const headings = extractHeadings(markdown)
  expect(headings.map(({ level, text, line }) => ({ level, text, line }))).toEqual([
    { level: 1, text: "Atlas", line: 8 },
    { level: 2, text: "Second bold Page code", line: 12 },
    { level: 2, text: "Setext", line: 14 },
  ])
  for (const heading of headings) {
    expect(markdown.split("\n")[heading.line - 1]).toBe(markdown.slice(heading.from).split("\n")[0])
  }
  expect(markdown.slice(headings[0]!.textFrom, headings[0]!.textFrom + 5)).toBe("Atlas")
  expect(markdown.slice(headings[1]!.textFrom).startsWith("Second")).toBe(true)
  expect(extractHeadings("# One\r\n\r\n## Two\r\n").map((heading) => heading.line)).toEqual([1, 3])
  expect(extractHeadings("")).toEqual([])
})
