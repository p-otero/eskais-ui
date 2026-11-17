import type { SyntaxNode } from "@lezer/common"
import type { ReactNode } from "react"

import { CodeBlock } from "@/components/ui/code-block"
import { Link } from "@/components/ui/link"
import type { Frontmatter } from "@/components/ui/markdown-frontmatter"
import type { RenderContext as Context } from "@/components/ui/markdown-view-render"

const slice = (cx: Context, node: { from: number; to: number }) => cx.src.slice(node.from, node.to)

function wikilinkParts(cx: Context, node: SyntaxNode) {
  const target = node.getChild("WikilinkTarget")
  const label = node.getChild("WikilinkLabel")
  return { slug: target ? slice(cx, target).trim() : "", alias: label ? slice(cx, label) : undefined }
}

/**
 * A wikilink with an address is a Link, so fast links, hash routes and agents' `follow` work, and
 * `onWikilinkClick` takes its plain clicks. Without an address, the callback makes it a button agents can follow.
 */
function wikilink(cx: Context, key: number, slug: string, alias: string | undefined, slot: string) {
  const resolution = cx.resolveWikilink?.(slug) ?? { exists: true }
  const text = alias ?? resolution.label ?? slug
  const href = resolution.exists ? cx.wikilinkHref?.(slug) : undefined
  const { onWikilinkClick } = cx
  // A Link with onFollow takes the link primitive's data-slot, so data-wikilink is what styles and finds it.
  const props = {
    "data-slot": slot,
    "data-wikilink": slot === "markdown-embed" ? "embed" : "link",
    "data-target": slug,
    "data-unresolved": resolution.exists ? undefined : "",
  }
  const onFollow =
    onWikilinkClick && ((_href: string, details: { event?: Event }) => onWikilinkClick(slug, details.event))
  if (href) {
    return (
      <Link key={key} href={href} onFollow={onFollow} {...props}>
        {text}
      </Link>
    )
  }
  if (onFollow) {
    return (
      // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- the Link renders the wikilink's text inside it
      <Link key={key} render={<button type="button" />} fast={false} onFollow={onFollow} {...props}>
        {text}
      </Link>
    )
  }
  return (
    <span key={key} {...props}>
      {text}
    </span>
  )
}

/** A paragraph that holds only an embed renders it as a block, so what `renderEmbed` returns isn't inside a <p>. */
function renderSoleEmbed(cx: Context, paragraph: SyntaxNode): ReactNode {
  const only = paragraph.firstChild
  if (!only || only.nextSibling || only.name !== "Embed" || !cx.renderEmbed) return null
  const outside = cx.src.slice(paragraph.from, only.from) + cx.src.slice(only.to, paragraph.to)
  if (outside.trim()) return null
  const { slug, alias } = wikilinkParts(cx, only)
  return (
    <div key={paragraph.from} data-slot="markdown-embed" data-target={slug}>
      {cx.renderEmbed(slug, alias)}
    </div>
  )
}

function renderFrontmatter(cx: Context, frontmatter: Frontmatter): ReactNode {
  if (cx.renderFrontmatter) return cx.renderFrontmatter(frontmatter)
  if (cx.frontmatter === "raw") return <CodeBlock code={frontmatter.raw} language="yaml" labels={cx.codeLabels} />
  if (cx.frontmatter !== "properties" || !frontmatter.properties.length) return null
  return (
    <dl data-slot="markdown-properties" aria-label={cx.frontmatterLabel}>
      {frontmatter.properties.map((property, index) => (
        <div key={`${property.key}.${String(index)}`} data-slot="markdown-property">
          <dt>{property.key}</dt>
          <dd>{typeof property.value === "string" ? property.value : property.value.join(", ")}</dd>
        </div>
      ))}
    </dl>
  )
}

export { renderFrontmatter, renderSoleEmbed, wikilink, wikilinkParts }
