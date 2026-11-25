import { renderToStaticMarkup } from "react-dom/server"

import { markdownParser } from "@/components/ui/markdown-syntax"
import { MarkdownView } from "@/components/ui/markdown-view"

function note(lines: number) {
  const out: string[] = []
  for (let n = 1; out.length < lines; n++) {
    out.push(
      `## Section ${n}`,
      "",
      `Paragraph ${n} with **bold**, _italic_, \`code\`, a [link](https://example.com/${n}) and [[note-${n}]].`,
      "",
    )
    out.push(`- [ ] task ${n}`, `- [x] done ${n}`, "  - nested item with ~~strike~~", "")
    out.push("| a | b | c |", "| --- | :-: | --: |", `| ${n} | x | y |`, "")
    out.push("```ts", `const value${n}: number = ${n}`, "```", "", `> quote ${n}`, "")
  }
  return out.slice(0, lines).join("\n") + "\n"
}

function time(label: string, run: () => void, rounds = 20) {
  run()
  const samples: number[] = []
  for (let i = 0; i < rounds; i++) {
    const start = performance.now()
    run()
    samples.push(performance.now() - start)
  }
  samples.sort((a, b) => a - b)
  console.log(`${label}: median ${samples[Math.floor(rounds / 2)]!.toFixed(1)} ms`)
}

const markdown = note(5000)
console.log(`${markdown.length} bytes, 5000 lines`)
time("Lezer parse (GFM + wikilinks)", () => void markdownParser.parse(markdown))
time("MarkdownView parse + render to HTML", () => void renderToStaticMarkup(<MarkdownView markdown={markdown} />))
