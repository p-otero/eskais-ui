const OPEN = "({[<"
const CLOSE = ")}]>"

function indexAfterClosingBracket(text: string, start: number) {
  let depth = 0
  for (let index = start; index < text.length; index++) {
    const char = text[index]!
    if (char === '"' || char === "'" || char === "`") {
      index = skipString(text, index)
      continue
    }
    if (char === "/" && text[index + 1] === "*") {
      index = text.indexOf("*/", index + 2) + 1
      if (index === 0) return text.length
      continue
    }
    if (char === "/" && text[index + 1] === "/") {
      const end = text.indexOf("\n", index)
      index = end === -1 ? text.length : end
      continue
    }
    if (char === ">" && text[index - 1] === "=") continue
    if (OPEN.includes(char)) depth++
    else if (CLOSE.includes(char)) {
      depth--
      if (depth === 0) return index + 1
    }
  }
  return text.length
}

function skipString(text: string, start: number) {
  const quote = text[start]
  for (let index = start + 1; index < text.length; index++) {
    if (text[index] === "\\") index++
    else if (text[index] === quote) return index
  }
  return text.length
}

function splitTopLevel(text: string, separator: string) {
  const parts: string[] = []
  let depth = 0
  let from = 0
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!
    if (char === '"' || char === "'" || char === "`") {
      index = skipString(text, index)
      continue
    }
    if (char === "/" && text[index + 1] === "*") {
      const end = text.indexOf("*/", index + 2)
      index = end === -1 ? text.length : end + 1
      continue
    }
    if (char === ">" && text[index - 1] === "=") continue
    if (OPEN.includes(char)) depth++
    else if (CLOSE.includes(char)) depth--
    else if (depth === 0 && text.startsWith(separator, index)) {
      parts.push(text.slice(from, index))
      from = index + separator.length
    }
  }
  parts.push(text.slice(from))
  return parts.map((part) => part.trim()).filter(Boolean)
}

const squash = (text: string) => text.replaceAll(/\s+/g, " ").trim()

function stripParens(text: string) {
  let result = text.trim()
  while (result.startsWith("(") && indexAfterClosingBracket(result, 0) === result.length)
    result = result.slice(1, -1).trim()
  return result
}

export { CLOSE, OPEN, indexAfterClosingBracket, skipString, splitTopLevel, squash, stripParens }
