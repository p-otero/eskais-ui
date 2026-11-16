import { use } from "react"

import { Badge } from "@/components/ui/badge"
import { Link } from "@/components/ui/link"

import { extractApi, type ApiModule } from "../lib/extract-api"
import type { RegistryItem } from "../registry"
import { Code, DocTable, H3, P } from "./prose"

const sources = import.meta.glob<string>("../../../../registry/{ui,lib,blocks}/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
})

const sourceKey = (path: string) => `../../../../${path}`

const cache = new Map<string, Promise<{ path: string; source: string; api: ApiModule }[]>>()

function loadApi(item: RegistryItem) {
  let promise = cache.get(item.name)
  if (!promise) {
    const files = (item.files ?? []).filter((file) => sources[sourceKey(file.path)])
    promise = Promise.all(
      files.map(async (file) => {
        const source = await sources[sourceKey(file.path)]!()
        return { path: file.path, source, api: extractApi(source) }
      }),
    )
    cache.set(item.name, promise)
  }
  return promise
}

function importPath(path: string) {
  const file = path.replace(/\.(tsx?|css)$/, "")
  if (file.startsWith("registry/ui/")) return `@/components/ui/${file.slice("registry/ui/".length)}`
  if (file.startsWith("registry/lib/")) return `@/lib/${file.slice("registry/lib/".length)}`
  if (file.startsWith("registry/blocks/")) return `@/components/${file.slice("registry/blocks/".length)}`
  return file
}

function useItemApi(item: RegistryItem) {
  return use(loadApi(item))
}

function importSnippet(modules: { path: string; api: ApiModule }[]) {
  return modules
    .filter((module) => module.api.exports.length > 0)
    .map((module) => {
      const names = module.api.exports
      const list = names.join(", ")
      return list.length > 70
        ? `import {\n${names.map((name) => `  ${name},`).join("\n")}\n} from "${importPath(module.path)}"`
        : `import { ${list} } from "${importPath(module.path)}"`
    })
    .join("\n")
}

function ApiSection({ item }: { item: RegistryItem }) {
  const modules = useItemApi(item)
  const components = modules.flatMap((module) => module.api.components)
  const otherExports = modules.flatMap((module) =>
    module.api.exports.filter((name) => !components.some((component) => component.name === name)),
  )
  const types = modules.flatMap((module) => module.api.types)
  return (
    <div className="flex flex-col gap-group">
      {components.length === 0 && (
        <P className="text-muted-foreground">This item exports functions and types rather than components.</P>
      )}
      {components.map((component) => (
        <div key={component.name} className="flex flex-col gap-items">
          <H3 id={`api-${component.name.toLowerCase()}`}>{component.name}</H3>
          {component.props.length > 0 && (
            <DocTable
              label={`${component.name} props`}
              head={["Prop", "Type", "Default"]}
              rows={component.props.map((prop) => [
                <span key="name" className="flex flex-col gap-inline">
                  <Code className="w-fit font-medium">{prop.name}</Code>
                  {!prop.optional && (
                    <Badge tone="info" className="w-fit">
                      required
                    </Badge>
                  )}
                  {prop.description && (
                    <span className="max-w-xs text-caption text-muted-foreground">{prop.description}</span>
                  )}
                </span>,
                <code key="type" className="font-mono text-caption break-words text-muted-foreground">
                  {prop.type}
                </code>,
                prop.defaultValue ? (
                  <Code key="default">{prop.defaultValue}</Code>
                ) : (
                  <span key="default" className="text-muted-foreground">
                    –
                  </span>
                ),
              ])}
            />
          )}
          {component.inherits.length > 0 && (
            <p className="text-body-sm text-muted-foreground">
              {component.props.length > 0 ? "Also takes " : "Takes "}
              {component.inherits.map((inherit, index) => (
                <span key={inherit.label}>
                  {index > 0 && ", "}
                  {inherit.href ? (
                    <Link href={inherit.href} external>
                      every prop of {inherit.label}
                    </Link>
                  ) : (
                    <Code>{inherit.label}</Code>
                  )}
                  {inherit.omitted?.length ? ` except ${inherit.omitted.join(", ")}` : ""}
                </span>
              ))}
              .
            </p>
          )}
          {component.props.length === 0 && component.inherits.length === 0 && (
            <p className="text-body-sm text-muted-foreground">No props.</p>
          )}
        </div>
      ))}
      {(otherExports.length > 0 || types.length > 0) && (
        <div className="flex flex-col gap-items">
          <H3 id="api-exports">Other exports</H3>
          <div className="flex flex-wrap gap-inline">
            {otherExports.map((name) => (
              <Code key={name}>{name}</Code>
            ))}
            {types.map((name) => (
              <Code key={name} className="text-muted-foreground">
                type {name}
              </Code>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export { ApiSection, importPath, importSnippet, loadApi, useItemApi }
