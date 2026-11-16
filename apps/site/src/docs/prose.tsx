import type { ComponentProps, ReactNode } from "react"

import { Code, CodeBlock, type CodeLanguage } from "@/components/ui/code-block"
import { Link } from "@/components/ui/link"
import { cn } from "@/lib/utils"

import { linkTo } from "../router"

function DocTitle({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: ReactNode }) {
  return (
    <header className="flex flex-col gap-items">
      {eyebrow && <p className="text-meta tracking-meta text-muted-foreground uppercase">{eyebrow}</p>}
      <h1 className="text-display tracking-tight text-balance">{title}</h1>
      {description && <p className="max-w-2xl text-body text-pretty text-muted-foreground">{description}</p>}
    </header>
  )
}

function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} data-toc="2" className="pt-group text-title tracking-tight">
      {children}
    </h2>
  )
}

function H3({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} data-toc="3" className="text-title-sm tracking-tight">
      {children}
    </h3>
  )
}

function P({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("max-w-prose text-body text-pretty", className)} {...props} />
}

function Ul({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul className={cn("flex max-w-prose list-disc flex-col gap-inline ps-group text-body", className)} {...props} />
  )
}

function Ol({ className, ...props }: ComponentProps<"ol">) {
  return (
    <ol className={cn("flex max-w-prose list-decimal flex-col gap-items ps-group text-body", className)} {...props} />
  )
}

function A({ to, href, children }: { to?: string; href?: string; children: ReactNode }) {
  if (to) return <Link {...linkTo(to)}>{children}</Link>
  return (
    <Link href={href} external={Boolean(href?.startsWith("http"))}>
      {children}
    </Link>
  )
}

function Pre({ code, language = "tsx", title }: { code: string; language?: CodeLanguage; title?: string }) {
  return <CodeBlock code={code} language={language} title={title} />
}

type TableProps = { head: string[]; rows: ReactNode[][]; label: string }

function DocTable({ head, rows, label }: TableProps) {
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a table that scrolls sideways must take focus so keyboard users can scroll it
    <section className="overflow-x-auto rounded-surface border" aria-label={label} tabIndex={0}>
      <table className="w-full border-collapse text-body-sm">
        <thead className="bg-muted/60">
          <tr>
            {head.map((cell) => (
              <th key={cell} scope="col" className="border-b px-inset-item py-inset-item text-start font-semibold">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            // oxlint-disable-next-line react/no-array-index-key -- rows of a static table
            <tr key={index} className="border-b last:border-0">
              {row.map((cell, column) => (
                // oxlint-disable-next-line react/no-array-index-key -- cells of a static row
                <td key={column} className="px-inset-item py-inset-item align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function Article({ children }: { children: ReactNode }) {
  return <article className="flex min-w-0 flex-col gap-group">{children}</article>
}

export { A, Article, Code, DocTable, DocTitle, H2, H3, Ol, P, Pre, Ul }
