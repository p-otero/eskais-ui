import { OPEN, indexAfterClosingBracket, skipString, splitTopLevel, squash, stripParens } from "./source-scan"

type ApiProp = {
  name: string
  type: string
  optional: boolean
  defaultValue?: string
  description?: string
}

type ApiInherit = { label: string; href?: string; omitted?: string[] }

type ApiComponent = { name: string; props: ApiProp[]; inherits: ApiInherit[] }

type ApiModule = { exports: string[]; types: string[]; components: ApiComponent[] }

type ImportInfo = { imported: string; source: string }

function readImports(source: string) {
  const imports = new Map<string, ImportInfo>()
  for (const match of source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"([^"]+)"/g)) {
    for (const specifier of match[1]!.split(",")) {
      const clean = specifier.replace(/^\s*type\s+/, "").trim()
      if (!clean) continue
      const [imported, local] = clean.split(/\s+as\s+/)
      imports.set((local ?? imported)!.trim(), { imported: imported!.trim(), source: match[2]! })
    }
  }
  return imports
}

function readExports(source: string) {
  const values: string[] = []
  const types: string[] = []
  for (const match of source.matchAll(/export\s+(type\s+)?\{([^}]*)\}(?:\s+from\s+"[^"]+")?/g)) {
    const names = match[2]!
      .split(",")
      .map((name) =>
        name
          .trim()
          .split(/\s+as\s+/)
          .pop()!
          .trim(),
      )
      .filter(Boolean)
    for (const name of names) {
      if (match[1] || name.startsWith("type ")) types.push(name.replace(/^type\s+/, ""))
      else values.push(name)
    }
  }
  for (const match of source.matchAll(/export\s+(?:async\s+)?(function|const|type)\s+([A-Za-z0-9_]+)/g)) {
    ;(match[1] === "type" ? types : values).push(match[2]!)
  }
  return { values: [...new Set(values)], types: [...new Set(types)] }
}

function readTypeAliases(source: string) {
  const aliases = new Map<string, string>()
  for (const match of source.matchAll(/(?:^|\n)(?:export\s+)?type\s+([A-Za-z0-9_]+)\s*(<[^=]*>)?\s*=/g)) {
    let index = match.index! + match[0].length
    const start = index
    for (; index < source.length; index++) {
      const char = source[index]!
      if (OPEN.includes(char) && !(char === ">" && source[index - 1] === "=")) {
        index = indexAfterClosingBracket(source, index) - 1
        continue
      }
      if (char === '"' || char === "'" || char === "`") {
        index = skipString(source, index)
        continue
      }
      if (char === "\n") {
        const rest = source.slice(index + 1).trimStart()
        if (!rest.startsWith("&") && !rest.startsWith("|")) break
      }
    }
    aliases.set(match[1]!, source.slice(start, index).trim())
  }
  return aliases
}

function readMembers(body: string) {
  const members: ApiProp[] = []
  const inner = body.trim().slice(1, -1)
  let description: string | undefined
  let index = 0
  while (index < inner.length) {
    const rest = inner.slice(index)
    const space = /^[\s;,]+/.exec(rest)
    if (space) {
      index += space[0].length
      continue
    }
    if (rest.startsWith("/**")) {
      const end = inner.indexOf("*/", index)
      description = squash(
        inner
          .slice(index + 3, end)
          .split("\n")
          .map((line) => line.replace(/^\s*\*\s?/, ""))
          .join(" "),
      )
      index = end + 2
      continue
    }
    if (rest.startsWith("//")) {
      const end = inner.indexOf("\n", index)
      index = end === -1 ? inner.length : end
      continue
    }
    const head = /^(readonly\s+)?("[^"]+"|'[^']+'|[A-Za-z0-9_$]+)(\?)?\s*:/.exec(rest)
    if (!head) {
      const end = inner.indexOf("\n", index)
      index = end === -1 ? inner.length : end + 1
      description = undefined
      continue
    }
    let cursor = index + head[0].length
    const typeStart = cursor
    for (; cursor < inner.length; cursor++) {
      const char = inner[cursor]!
      if (OPEN.includes(char) && !(char === ">" && inner[cursor - 1] === "=")) {
        cursor = indexAfterClosingBracket(inner, cursor) - 1
        continue
      }
      if (char === '"' || char === "'" || char === "`") {
        cursor = skipString(inner, cursor)
        continue
      }
      if (char === ";" || char === ",") break
      if (char === "\n") {
        const next = inner.slice(cursor + 1).trimStart()
        if (!next.startsWith("|") && !next.startsWith("&")) break
      }
    }
    members.push({
      name: head[2]!.replaceAll(/["']/g, ""),
      type: squash(inner.slice(typeStart, cursor)),
      optional: Boolean(head[3]),
      description,
    })
    description = undefined
    index = cursor + 1
  }
  return members
}

function readVariants(source: string, name: string) {
  const start = source.search(new RegExp(`const\\s+${name}\\s*=\\s*cva\\(`))
  if (start === -1) return []
  const call = source.slice(start, indexAfterClosingBracket(source, source.indexOf("(", start)))
  const block = (key: string) => {
    const at = call.search(new RegExp(`\\b${key}\\s*:\\s*\\{`))
    if (at === -1) return ""
    const open = call.indexOf("{", at)
    return call.slice(open, indexAfterClosingBracket(call, open))
  }
  const defaults = new Map<string, string>()
  for (const match of block("defaultVariants").matchAll(/([A-Za-z]+)\s*:\s*("[^"]*"|true|false)/g)) {
    defaults.set(match[1]!, match[2]!)
  }
  const variants = block("variants")
  const props: ApiProp[] = []
  const inner = variants.slice(1, -1)
  for (const match of inner.matchAll(/([A-Za-z]+)\s*:\s*\{/g)) {
    const open = match.index! + match[0].length - 1
    if (inner.slice(0, match.index).split("{").length - inner.slice(0, match.index).split("}").length !== 0) continue
    const options = inner
      .slice(open + 1, indexAfterClosingBracket(inner, open) - 1)
      .replaceAll(/`[^`]*`/g, "0")
      .replaceAll(/"(?:[^"\\]|\\.)*"(?!\s*:)/g, "0")
    const keys = [...options.matchAll(/(?:^|[\s,{])("[^"]+"|[A-Za-z0-9_-]+)\s*:/g)]
      .filter((key) => {
        const before = options.slice(0, key.index)
        return before.split("{").length === before.split("}").length
      })
      .map((key) => key[1]!.replaceAll('"', ""))
    const values = keys.every((key) => key === "true" || key === "false")
      ? "boolean"
      : keys.map((key) => `"${key}"`).join(" | ")
    props.push({ name: match[1]!, type: values, optional: true, defaultValue: defaults.get(match[1]!) })
  }
  return props
}

const uiSdkEntry = (source: string) => /^@ui-sdk\/react\/([a-z-]+)$/.exec(source)?.[1]

function describeTypeof(local: string, imports: Map<string, ImportInfo>): ApiInherit {
  const name = local.replace(/<.*$/, "")
  const info = imports.get(name)
  const entry = info && uiSdkEntry(info.source)
  if (info && entry) {
    return {
      label: `UI SDK ${info.imported}`,
      href: `https://ui-sdk.dev/docs/react/components/${entry}`,
    }
  }
  if (info) return { label: info.imported }
  return { label: name }
}

type Resolved = { props: ApiProp[]; inherits: ApiInherit[] }

function resolveType(
  expression: string,
  context: { source: string; aliases: Map<string, string>; imports: Map<string, ImportInfo> },
  seen = new Set<string>(),
): Resolved {
  const text = stripParens(expression)
  const union = splitTopLevel(text, "|")
  if (union.length > 1) return mergeAll(union.map((part) => resolveType(part, context, seen)))
  const intersection = splitTopLevel(text, "&")
  if (intersection.length > 1) return mergeAll(intersection.map((part) => resolveType(part, context, seen)))

  if (text.startsWith("{")) return { props: readMembers(text), inherits: [] }

  const omit = /^Omit<([\s\S]+),\s*("[^"]*"(?:\s*\|\s*"[^"]*")*)\s*>$/.exec(text)
  if (omit) {
    const omitted = [...omit[2]!.matchAll(/"([^"]+)"/g)].map((match) => match[1]!)
    const inner = resolveType(omit[1]!, context, seen)
    return {
      props: inner.props.filter((prop) => !omitted.includes(prop.name)),
      inherits: inner.inherits.map((inherit) => ({ ...inherit, omitted: [...(inherit.omitted ?? []), ...omitted] })),
    }
  }

  const partial = /^Partial<([\s\S]+)>$/.exec(text)
  if (partial) {
    const inner = resolveType(partial[1]!, context, seen)
    return { ...inner, props: inner.props.map((prop) => ({ ...prop, optional: true })) }
  }

  const componentProps = /^ComponentProps(?:WithoutRef)?<\s*(?:typeof\s+([A-Za-z0-9_<>]+)|"([a-z]+)")\s*>$/.exec(text)
  if (componentProps) {
    if (componentProps[2]) return { props: [], inherits: [{ label: `<${componentProps[2]}> attributes` }] }
    return { props: [], inherits: [describeTypeof(componentProps[1]!, context.imports)] }
  }

  const partProps = /^PartProps<\s*"([a-z]+)"\s*>$/.exec(text)
  if (partProps) return { props: [], inherits: [{ label: `<${partProps[1]}> attributes and render` }] }

  const variantProps = /^VariantProps<\s*typeof\s+([A-Za-z0-9_]+)\s*>$/.exec(text)
  if (variantProps) return { props: readVariants(context.source, variantProps[1]!), inherits: [] }

  const named = /^([A-Za-z0-9_]+)(?:<[\s\S]*>)?(?:\[[^\]]*\])?$/.exec(text)
  if (named && context.aliases.has(named[1]!) && !seen.has(named[1]!)) {
    return resolveType(context.aliases.get(named[1]!)!, context, new Set([...seen, named[1]!]))
  }
  const imported = named && context.imports.get(named[1]!)
  if (imported) return { props: [], inherits: [{ label: imported.imported }] }
  return { props: [], inherits: [{ label: squash(text) }] }
}

function mergeAll(results: Resolved[]): Resolved {
  const props = new Map<string, ApiProp>()
  for (const result of results) {
    for (const prop of result.props) {
      const existing = props.get(prop.name)
      if (!existing) props.set(prop.name, prop)
      else if (existing.type !== prop.type) {
        const types = new Set([...existing.type.split(" | "), ...prop.type.split(" | ")])
        props.set(prop.name, {
          ...existing,
          type: [...types].join(" | "),
          optional: existing.optional || prop.optional,
          description: existing.description ?? prop.description,
        })
      }
    }
  }
  const inherits = new Map<string, ApiInherit>()
  for (const result of results) for (const inherit of result.inherits) inherits.set(inherit.label, inherit)
  return { props: [...props.values()], inherits: [...inherits.values()] }
}

function readDefaults(pattern: string) {
  const defaults = new Map<string, string>()
  for (const part of splitTopLevel(pattern.trim().slice(1, -1), ",")) {
    const match = /^([A-Za-z0-9_$]+)(?:\s*:\s*[A-Za-z0-9_$]+)?\s*=\s*([\s\S]+)$/.exec(part)
    if (match) defaults.set(match[1]!, squash(match[2]!))
  }
  return defaults
}

function indexedAccess(
  prop: ApiProp,
  context: { source: string; aliases: Map<string, string>; imports: Map<string, ImportInfo> },
): ApiProp {
  const replaced = prop.type.replaceAll(
    /([A-Za-z0-9_]+)\["([A-Za-z0-9_]+)"\]/g,
    (whole, alias: string, key: string) => {
      if (!context.aliases.has(alias)) return whole
      const target = resolveType(alias, context).props.find((candidate) => candidate.name === key)
      return target ? target.type : whole
    },
  )
  const excluded = /^Exclude<("[^"]+"(?: \| "[^"]+")*), ("[^"]+"(?: \| "[^"]+")*)>(.*)$/.exec(replaced)
  const type = excluded
    ? `${excluded[1]!
        .split(" | ")
        .filter((value) => !excluded[2]!.split(" | ").includes(value))
        .join(" | ")}${excluded[3]!}`
    : replaced
  const literalAliases = type
    .split(" | ")
    .map((part) => {
      const alias = context.aliases.get(part)
      return alias && /^"[^"]+"(\s*\|\s*"[^"]+")*$/.test(squash(alias)) ? squash(alias) : part
    })
    .join(" | ")
  const variantDefault = /^([A-Za-z0-9_]+)\["([A-Za-z0-9_]+)"\]/.exec(prop.type)
  const defaultValue =
    prop.defaultValue ??
    (variantDefault && context.aliases.has(variantDefault[1]!)
      ? resolveType(variantDefault[1]!, context).props.find((candidate) => candidate.name === variantDefault[2])
          ?.defaultValue
      : undefined)
  return { ...prop, type: literalAliases, defaultValue }
}

function readComponents(source: string, exported: string[]) {
  const imports = readImports(source)
  const aliases = readTypeAliases(source)
  const context = { source, aliases, imports }
  const components: ApiComponent[] = []
  for (const match of source.matchAll(/(?:^|\n)(?:export\s+)?function\s+([A-Z][A-Za-z0-9]*)\s*(<[^(]*>)?\s*\(/g)) {
    const name = match[1]!
    if (!exported.includes(name)) continue
    const open = match.index! + match[0].length - 1
    const params = source.slice(open + 1, indexAfterClosingBracket(source, open) - 1).trim()
    if (!params) {
      components.push({ name, props: [], inherits: [] })
      continue
    }
    let defaults = new Map<string, string>()
    let typeText = ""
    if (params.startsWith("{")) {
      const end = indexAfterClosingBracket(params, 0)
      defaults = readDefaults(params.slice(0, end))
      typeText = params.slice(end).replace(/^\s*:\s*/, "")
    } else {
      typeText = params.replace(/^[A-Za-z0-9_]+\s*:\s*/, "")
    }
    typeText = typeText.replace(/,\s*$/, "")
    const resolved = typeText ? resolveType(typeText, context) : { props: [], inherits: [] }
    const props = resolved.props.map((prop) => {
      const indexed = indexedAccess(prop, context)
      return { ...indexed, defaultValue: defaults.get(prop.name) ?? indexed.defaultValue }
    })
    components.push({ name, props, inherits: resolved.inherits })
  }
  return components
}

function extractApi(source: string): ApiModule {
  const { values, types } = readExports(source)
  return { exports: values, types, components: readComponents(source, values) }
}

export { extractApi, indexAfterClosingBracket, splitTopLevel }
export type { ApiComponent, ApiInherit, ApiModule, ApiProp }
