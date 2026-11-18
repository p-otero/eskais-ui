import { memo, useDeferredValue, useMemo, useState, type ComponentProps, type ReactNode } from "react"

import {
  markdownBlocks,
  type FrontmatterDisplay,
  type MarkdownBlock,
  type Parsed,
  type RenderOptions,
} from "@/components/ui/markdown-view-render"
import type { CodeBlockLabels } from "@/components/ui/code-block"
import { parseFrontmatter, type Frontmatter, type FrontmatterProperty } from "@/components/ui/markdown-frontmatter"
import { extractHeadings, type MarkdownHeading } from "@/components/ui/markdown-outline"
import type { WikilinkResolver } from "@/components/ui/markdown-syntax"
import { cn } from "@/lib/utils"

type MarkdownViewProps = Omit<ComponentProps<"div">, "children"> & {
  markdown: string
  resolveWikilink?: WikilinkResolver
  /**
   * Where a resolved wikilink points; without it, wikilinks render as styled text. Keep this and
   * `resolveWikilink` stable (module-level or `useCallback`): a new function re-renders every block.
   */
  wikilinkHref?: (slug: string) => string | undefined
  /**
   * Takes a wikilink's plain clicks, and agents' `follow`, for client routing; modified clicks keep the browser's
   * behaviour. A wikilink with no address becomes a button that calls it. Keep it stable, like `resolveWikilink`.
   */
  onWikilinkClick?: (target: string, event: Event | undefined) => void
  /** What `![[target]]` and `![[target|alias]]` show; without it, a link to the target. Keep it stable. */
  renderEmbed?: (target: string, alias: string | undefined) => ReactNode
  /**
   * An image's size, so its box is reserved before it loads and the text below doesn't move. `![alt|300x200](src)`
   * (or `|300` for the width alone) sets it in the Markdown, as in Obsidian; this answers for the others. Keep it
   * stable.
   */
  imageSize?: (src: string, alt: string) => { width: number; height?: number } | undefined
  /** A leading YAML block: hidden (default), a list of its `key: value` properties, or its text. */
  frontmatter?: FrontmatterDisplay
  /** Renders the frontmatter yourself, whatever `frontmatter` says. Keep it stable. */
  renderFrontmatter?: (frontmatter: Frontmatter) => ReactNode
  /** The accessible name of the properties list. */
  frontmatterLabel?: string
  taskLabel?: string
  /** Names for fenced code blocks and their copy buttons. Keep it stable, like `resolveWikilink`. */
  codeLabels?: Partial<CodeBlockLabels>
  /** Marks each table cell with its offset in `markdown` (`data-source-from`). */
  sourcePositions?: boolean
}

const prose = [
  "flex flex-col gap-items text-body text-foreground",
  "[&_h1]:text-display-sm [&_h1]:tracking-tight [&_h2]:text-title [&_h2]:tracking-tight [&_h3]:text-title-sm [&_h4]:font-semibold [&_h5]:font-semibold [&_h6]:text-body-sm [&_h6]:font-semibold",
  "[&_a]:text-link [&_a]:underline [&_a]:underline-offset-2 [&_[data-wikilink]]:text-link [&_[data-wikilink]]:underline [&_[data-wikilink]]:underline-offset-2",
  "[&_[data-unresolved]]:text-link-soft [&_[data-unresolved]]:decoration-dashed",
  "[&_button[data-wikilink]]:cursor-pointer [&_[data-wikilink=embed]]:inline-flex [&_[data-wikilink=embed]]:rounded-control [&_[data-wikilink=embed]]:border [&_[data-wikilink=embed]]:border-dashed [&_[data-wikilink=embed]]:border-input-strong [&_[data-wikilink=embed]]:px-inset-chip",
  "[&_[data-slot=markdown-properties]]:grid [&_[data-slot=markdown-properties]]:grid-cols-[minmax(0,auto)_minmax(0,1fr)] [&_[data-slot=markdown-properties]]:gap-x-group [&_[data-slot=markdown-properties]]:gap-y-inline [&_[data-slot=markdown-properties]]:rounded-surface [&_[data-slot=markdown-properties]]:border [&_[data-slot=markdown-properties]]:px-inset-item [&_[data-slot=markdown-properties]]:py-inset-item [&_[data-slot=markdown-properties]]:text-body-sm",
  "[&_[data-slot=markdown-property]]:col-span-2 [&_[data-slot=markdown-property]]:grid [&_[data-slot=markdown-property]]:grid-cols-subgrid [&_[data-slot=markdown-property]_dt]:text-muted-foreground [&_[data-slot=markdown-property]_dd]:wrap-anywhere",
  "[&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:flex [&_ul,&_ol]:flex-col [&_ul,&_ol]:gap-inline [&_ul,&_ol]:ps-group",
  "[&_li:has(>[data-slot=markdown-view-task])]:list-none [&_[data-slot=markdown-view-task]]:inline-flex [&_[data-slot=markdown-view-task]]:items-baseline [&_[data-slot=markdown-view-task]]:gap-inline [&_input]:accent-primary",
  "[&_blockquote]:flex [&_blockquote]:flex-col [&_blockquote]:gap-items [&_blockquote]:border-s-2 [&_blockquote]:ps-items [&_blockquote]:text-muted-foreground",
  "[&_:not(pre)>code]:rounded-sm [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-px [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[0.9em]",
  "[&_[data-slot=markdown-view-raw]]:font-mono [&_[data-slot=markdown-view-raw]]:text-xs [&_[data-slot=markdown-view-raw]]:whitespace-pre-wrap [&_[data-slot=markdown-view-raw]]:text-muted-foreground",
  "[&_hr]:border-border [&_table]:w-full [&_table]:border-collapse [&_th]:border-b [&_th]:px-inset-item [&_th]:py-inset-item [&_th]:text-start [&_th]:font-semibold [&_td]:border-b [&_td]:px-inset-item [&_td]:py-inset-item",
  "[&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-control",
].join(" ")

type BlockProps = { block: MarkdownBlock; references: string; options: RenderOptions }

// Unchanged blocks keep their elements: the text, the link references and the options are all a block reads.
const Block = memo(
  ({ block }: BlockProps) => block.render(),
  (previous, next) =>
    previous.block.text === next.block.text &&
    previous.block.anchors === next.block.anchors &&
    previous.references === next.references &&
    previous.options === next.options,
)

const lastParse = new WeakMap<object, Parsed>()

function MarkdownView({
  markdown,
  resolveWikilink,
  wikilinkHref,
  onWikilinkClick,
  renderEmbed,
  imageSize,
  frontmatter = "hide",
  renderFrontmatter,
  frontmatterLabel = "Properties",
  taskLabel = "Task done",
  codeLabels,
  sourcePositions,
  className,
  ...props
}: MarkdownViewProps) {
  const deferred = useDeferredValue(markdown)
  const options = useMemo<RenderOptions>(
    () => ({
      resolveWikilink,
      wikilinkHref,
      onWikilinkClick,
      renderEmbed,
      imageSize,
      frontmatter,
      renderFrontmatter,
      frontmatterLabel,
      taskLabel,
      sourcePositions,
      codeLabels,
    }),
    [
      resolveWikilink,
      wikilinkHref,
      onWikilinkClick,
      renderEmbed,
      imageSize,
      frontmatter,
      renderFrontmatter,
      frontmatterLabel,
      taskLabel,
      sourcePositions,
      codeLabels,
    ],
  )
  const [instance] = useState(() => ({}))
  const { blocks, references } = useMemo(() => {
    const result = markdownBlocks(deferred, options, lastParse.get(instance))
    lastParse.set(instance, result.parsed)
    return result
  }, [deferred, options, instance])
  return (
    <div data-slot="markdown-view" className={cn(prose, className)} {...props}>
      {blocks.map((block) => (
        <Block key={block.key} block={block} references={references} options={options} />
      ))}
    </div>
  )
}

export { extractHeadings, MarkdownView, parseFrontmatter }
export type { Frontmatter, FrontmatterDisplay, FrontmatterProperty, MarkdownHeading, MarkdownViewProps }
