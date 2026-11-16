import { memo, useDeferredValue, useMemo, useState, type ComponentProps } from "react"

import {
  markdownBlocks,
  type MarkdownBlock,
  type Parsed,
  type RenderOptions,
} from "@/components/ui/markdown-view-render"
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
  taskLabel?: string
  /** Marks each table cell with its offset in `markdown` (`data-source-from`). */
  sourcePositions?: boolean
}

const prose = [
  "flex flex-col gap-items text-body text-foreground",
  "[&_h1]:text-display-sm [&_h1]:tracking-tight [&_h2]:text-title [&_h2]:tracking-tight [&_h3]:text-title-sm [&_h4]:font-semibold [&_h5]:font-semibold [&_h6]:text-body-sm [&_h6]:font-semibold",
  "[&_a]:text-link [&_a]:underline [&_a]:underline-offset-2 [&_[data-slot=markdown-wikilink]]:text-link [&_[data-slot=markdown-wikilink]]:underline [&_[data-slot=markdown-wikilink]]:underline-offset-2",
  "[&_[data-unresolved]]:text-link-soft [&_[data-unresolved]]:decoration-dashed",
  "[&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:flex [&_ul,&_ol]:flex-col [&_ul,&_ol]:gap-inline [&_ul,&_ol]:ps-group",
  "[&_li:has(>[data-slot=markdown-view-task])]:list-none [&_[data-slot=markdown-view-task]]:inline-flex [&_[data-slot=markdown-view-task]]:items-baseline [&_[data-slot=markdown-view-task]]:gap-inline [&_input]:accent-primary",
  "[&_blockquote]:flex [&_blockquote]:flex-col [&_blockquote]:gap-items [&_blockquote]:border-s-2 [&_blockquote]:ps-items [&_blockquote]:text-muted-foreground",
  "[&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-px [&_code]:font-mono [&_code]:text-[0.9em]",
  "[&_pre]:overflow-x-auto [&_pre]:rounded-control [&_pre]:bg-muted [&_pre]:px-inset-item [&_pre]:py-inset-item [&_pre]:font-mono [&_pre]:text-xs [&_pre_code]:bg-transparent [&_pre_code]:px-0",
  "[&_[data-slot=markdown-view-raw]]:whitespace-pre-wrap [&_[data-slot=markdown-view-raw]]:bg-transparent [&_[data-slot=markdown-view-raw]]:text-muted-foreground",
  "[&_hr]:border-border [&_table]:w-full [&_table]:border-collapse [&_th]:border-b [&_th]:px-inset-item [&_th]:py-inset-item [&_th]:text-start [&_th]:font-semibold [&_td]:border-b [&_td]:px-inset-item [&_td]:py-inset-item",
  "[&_img]:max-w-full [&_img]:rounded-control",
].join(" ")

type BlockProps = { block: MarkdownBlock; references: string; options: RenderOptions }

// Unchanged blocks keep their elements: the text, the link references and the options are all a block reads.
const Block = memo(
  ({ block }: BlockProps) => block.render(),
  (previous, next) =>
    previous.block.text === next.block.text &&
    previous.references === next.references &&
    previous.options === next.options,
)

const lastParse = new WeakMap<object, Parsed>()

function MarkdownView({
  markdown,
  resolveWikilink,
  wikilinkHref,
  taskLabel = "Task done",
  sourcePositions,
  className,
  ...props
}: MarkdownViewProps) {
  const deferred = useDeferredValue(markdown)
  const options = useMemo<RenderOptions>(
    () => ({ resolveWikilink, wikilinkHref, taskLabel, sourcePositions }),
    [resolveWikilink, wikilinkHref, taskLabel, sourcePositions],
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

export { MarkdownView }
export type { MarkdownViewProps }
