import { createElement, lazy, Suspense, use, useRef, type ComponentType, type RefObject } from "react"

import { Code, CodeBlock } from "@/components/ui/code-block"
import { Link } from "@/components/ui/link"
import { MarkdownView } from "@/components/ui/markdown-view"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsIndicator, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"

import { categoryOf } from "../content/categories"
import { itemNotes } from "../content/items"
import { findItem, type RegistryItem } from "../registry"
import { componentPath } from "../routes"
import { linkTo } from "../router"
import { AgentPanel } from "./agent-panel"
import { ApiSection, importSnippet, useItemApi } from "./api-section"
import { DocTitle, H2, P, Ul } from "./prose"

const exampleModules = import.meta.glob<{ default: ComponentType }>("../examples/*.tsx")
const exampleSources = import.meta.glob<string>("../examples/*.tsx", { query: "?raw", import: "default" })

const exampleComponents = new Map<string, ComponentType>()
const sourceCache = new Map<string, Promise<string>>()

function exampleComponent(name: string) {
  let component = exampleComponents.get(name)
  const load = exampleModules[`../examples/${name}.tsx`]
  if (!component && load) {
    component = lazy(load)
    exampleComponents.set(name, component)
  }
  return component
}

function exampleSource(name: string) {
  let promise = sourceCache.get(name)
  const load = exampleSources[`../examples/${name}.tsx`]
  if (!promise && load) {
    promise = load()
    sourceCache.set(name, promise)
  }
  return promise
}

// Examples import from the app's aliases; show them the way a consumer's project has them.
const consumerSource = (source: string) => source.replace(/\n*$/, "\n")

function ExampleSource({ name }: { name: string }) {
  const promise = exampleSource(name)
  if (!promise) return null
  return <CodeBlock code={consumerSource(use(promise))} language="tsx" title={`${name}-demo.tsx`} maxHeight="28rem" />
}

const installCommand = (name: string) => `npx shadcn@latest add @eskais/${name}`

function Preview({ item, preview }: { item: RegistryItem; preview: RefObject<HTMLDivElement | null> }) {
  const example = exampleComponent(item.name)
  return (
    <Tabs defaultValue="preview" className="flex flex-col gap-items">
      <h2 className="sr-only">Example</h2>
      <TabsList aria-label={`${item.title} example`} className="w-fit">
        <TabsIndicator />
        <TabsTab value="preview">Preview</TabsTab>
        <TabsTab value="code">Code</TabsTab>
      </TabsList>
      <TabsPanel value="preview" keepMounted>
        <div
          ref={preview}
          data-slot="preview"
          className="relative flex min-h-64 items-center justify-center overflow-x-auto rounded-surface border bg-card px-section py-section narrow:px-group"
        >
          <div className="pointer-events-none absolute inset-0 bg-grid-lines opacity-60" aria-hidden="true" />
          <div className="relative flex w-full min-w-0 justify-center">
            <Suspense fallback={<Spinner label="Loading example" />}>
              {example ? createElement(example) : null}
            </Suspense>
          </div>
        </div>
      </TabsPanel>
      <TabsPanel value="code">
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <ExampleSource name={item.name} />
        </Suspense>
      </TabsPanel>
    </Tabs>
  )
}

function Usage({ item }: { item: RegistryItem }) {
  const modules = useItemApi(item)
  const snippet = importSnippet(modules)
  return snippet ? <CodeBlock code={snippet} language="tsx" title="Import" /> : null
}

function Dependencies({ item }: { item: RegistryItem }) {
  const packages = (item.dependencies ?? []).filter((dependency) => !dependency.startsWith("@ui-sdk/"))
  const registryDependencies = (item.registryDependencies ?? [])
    .map((dependency) => dependency.replace("@eskais/", ""))
    .filter((name) => !["utils", "theme"].includes(name))
  if (packages.length === 0 && registryDependencies.length === 0) return null
  return (
    <div className="flex flex-col gap-items text-body-sm">
      {registryDependencies.length > 0 && (
        <div className="flex flex-wrap items-center gap-inline">
          <span className="text-muted-foreground">Brings along</span>
          {registryDependencies.map((name) =>
            findItem(name) && categoryOf(name) ? (
              <Link
                key={name}
                {...linkTo(componentPath(name))}
                className="inline-flex min-h-6 items-center px-inline font-mono text-caption"
              >
                {name}
              </Link>
            ) : (
              <Code key={name} className="text-caption">
                {name}
              </Code>
            ),
          )}
        </div>
      )}
      {packages.length > 0 && (
        <div className="flex flex-wrap items-center gap-inline">
          <span className="text-muted-foreground">npm packages</span>
          {packages.map((name) => (
            <Code key={name} className="text-caption">
              {name}
            </Code>
          ))}
        </div>
      )}
    </div>
  )
}

function ItemPage({ item }: { item: RegistryItem }) {
  const notes = itemNotes[item.name]
  const category = categoryOf(item.name)
  const related = notes?.related ?? []
  const preview = useRef<HTMLDivElement>(null)
  return (
    <>
      <DocTitle eyebrow={category} title={item.title ?? item.name} description={item.description} />
      <Preview item={item} preview={preview} />

      <section className="flex flex-col gap-items" aria-labelledby="installation">
        <H2 id="installation">Installation</H2>
        <CodeBlock code={installCommand(item.name)} language="bash" aria-label="Install command" />
        <Dependencies item={item} />
      </section>

      <section className="flex flex-col gap-items" aria-labelledby="usage">
        <H2 id="usage">Usage</H2>
        <Suspense fallback={<Skeleton className="h-16 w-full" />}>
          <Usage item={item} />
        </Suspense>
        {notes?.usage && <P>{notes.usage}</P>}
        {item.docs && <MarkdownView markdown={item.docs} className="max-w-prose" />}
      </section>

      <section className="flex flex-col gap-items" aria-labelledby="api">
        <H2 id="api">API reference</H2>
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <ApiSection item={item} />
        </Suspense>
      </section>

      {notes?.a11y && notes.a11y.length > 0 && (
        <section className="flex flex-col gap-items" aria-labelledby="accessibility">
          <H2 id="accessibility">Accessibility</H2>
          <Ul>
            {notes.a11y.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </Ul>
        </section>
      )}

      <section className="flex flex-col gap-items" aria-labelledby="agents">
        <H2 id="agents">Agent actions</H2>
        {notes?.agent && <P>{notes.agent}</P>}
        <AgentPanel preview={preview} />
      </section>

      {related.length > 0 && (
        <section className="flex flex-col gap-items" aria-labelledby="related">
          <H2 id="related">Related</H2>
          <ul className="flex flex-wrap gap-inline">
            {related.map((name) => (
              <li key={name}>
                <Link
                  {...linkTo(componentPath(name))}
                  variant="nav"
                  className="inline-flex rounded-control border px-inset-chip py-inset-chip text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  {findItem(name)?.title ?? name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

export { exampleComponent, installCommand, ItemPage }
