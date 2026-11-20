import { ansiCssColor, parseAnsi } from "@/lib/ansi"

const ESC = "\u001b"

// What a terminal sends, escapes written out, and what parseAnsi keeps of it.
const samples = [
  `${ESC}[32m✓${ESC}[0m built in ${ESC}[1m412ms${ESC}[0m`,
  `${ESC}[31;1mERROR${ESC}[0m ${ESC}[38;5;208mredis${ESC}[0m connect ECONNREFUSED`,
  `${ESC}]8;;https://example.com${ESC}\\link text${ESC}]8;;${ESC}\\ and ${ESC}[2Kno cursor moves`,
  `downloading 10%\rdownloading 100% ${ESC}[38;2;120;180;255mdone${ESC}[0m`,
]

const visible = (raw: string) => raw.replaceAll(ESC, "ESC").replaceAll("\r", "\\r")

export default function AnsiDemo() {
  return (
    <ul className="flex w-full flex-col gap-items font-mono text-caption">
      {samples.map((raw) => {
        const line = parseAnsi(raw)
        return (
          <li
            key={raw}
            className="flex flex-col gap-inline rounded-surface border bg-muted px-inset-item py-inset-item"
          >
            <span className="break-all text-muted-foreground">{visible(raw)}</span>
            <span className="whitespace-pre-wrap">
              {(line.spans ?? [{ text: line.text }]).map((span, index) => (
                <span
                  // oxlint-disable-next-line react/no-array-index-key -- a line's runs have no identity but their order
                  key={index}
                  className={span.style?.bold ? "font-semibold" : undefined}
                  style={span.style?.fg === undefined ? undefined : { color: ansiCssColor(span.style.fg) }}
                >
                  {span.text}
                </span>
              ))}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
