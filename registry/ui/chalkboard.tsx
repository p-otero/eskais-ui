"use client"

import { usePart, usePrimitive } from "@ui-sdk/react/primitive"
import { type AnimationEvent, useState, useSyncExternalStore } from "react"

import {
  chalkboardBlocks,
  type ChalkboardBlock,
  type ChalkboardContent,
  type ChalkboardMenuItem,
  type ChalkColor,
} from "@/components/ui/chalkboard-content"
import { chalkboard, type ChalkboardOptions } from "@/components/ui/chalkboard-primitive"
import { cn, cssVars } from "@/lib/utils"

type ChalkboardSurface = "slate" | "green"

type ChalkboardState = { writing: boolean }

type ChalkboardProps = ChalkboardOptions & {
  /** The board's accessible name: "Today's menu", "Notices". */
  label: string
  /** Writes each line in by hand, left to right, when it first shows and after every wipe. Never under reduced motion. */
  reveal?: boolean
  /** How fast the hand writes, in characters per second. Default 32. */
  writingSpeed?: number
  /** The board: black `slate` (the default) or a school `green`. */
  surface?: ChalkboardSurface
  /** Shows the wooden ledge with chalk and an eraser under the board. Default true. */
  tray?: boolean
  /** Classes for the frame; a function gets the board's state. */
  className?: string | ((state: ChalkboardState) => string | undefined)
}

const eraseMs = 700
const tilts = [-0.6, 0.35, -0.2, 0.5, -0.4, 0.15, 0.45, -0.3]

type Stroke = { at: number; for: number }

const lineCount = (block: ChalkboardBlock) =>
  block.type === "heading" || block.type === "text" ? 1 : block.items.length

function lineLengths(block: ChalkboardBlock): number[] {
  if (block.type === "heading" || block.type === "text") return [block.text.length]
  if (block.type === "list") return block.items.map((item) => item.length + 2)
  return block.items.map((item) => item.name.length + item.price.length + 8)
}

function strokes(blocks: readonly ChalkboardBlock[], charsPerSecond: number, startMs: number): Stroke[] {
  let at = startMs
  return blocks.flatMap(lineLengths).map((length) => {
    const stroke = { at, for: Math.max(260, (length / charsPerSecond) * 1000) }
    at += stroke.for + 140
    return stroke
  })
}

function uniqueKeys(texts: readonly string[]) {
  const seen = new Map<string, number>()
  return texts.map((text) => {
    const count = seen.get(text) ?? 0
    seen.set(text, count + 1)
    return count ? `${text}#${String(count)}` : text
  })
}

type Lines = { first: number; strokes: readonly Stroke[] }

function lineStyle({ first, strokes: planned }: Lines, offset = 0) {
  const index = first + offset
  const stroke = planned[index]
  return cssVars({
    "--chalk-tilt": `${String(tilts[index % tilts.length]!)}deg`,
    "--chalk-at": stroke ? `${String(Math.round(stroke.at))}ms` : undefined,
    "--chalk-for": stroke ? `${String(Math.round(stroke.for))}ms` : undefined,
  })
}

const chalkOf = (color: ChalkColor | undefined) => color ?? "white"

function MenuItem({ item, lines, offset }: { item: ChalkboardMenuItem; lines: Lines; offset: number }) {
  return (
    <li data-slot="chalkboard-menu-item" data-line="" style={lineStyle(lines, offset)}>
      <span data-slot="chalkboard-dish">{item.name}</span>
      <span data-slot="chalkboard-leader" aria-hidden="true" />
      <span data-slot="chalkboard-price">{item.price}</span>
      {item.note ? <span data-slot="chalkboard-note">{item.note}</span> : null}
    </li>
  )
}

function Block({ block, lines }: { block: ChalkboardBlock; lines: Lines }) {
  const chalk = chalkOf(block.color)
  if (block.type === "heading") {
    return (
      <h2 data-slot="chalkboard-heading" data-chalk={chalk} data-line="" style={lineStyle(lines)}>
        {block.text}
      </h2>
    )
  }
  if (block.type === "text") {
    return (
      <p data-slot="chalkboard-text" data-chalk={chalk} data-line="" style={lineStyle(lines)}>
        {block.text}
      </p>
    )
  }
  if (block.type === "list") {
    return (
      <ul data-slot="chalkboard-list" data-chalk={chalk}>
        {uniqueKeys(block.items).map((key, index) => (
          <li key={key} data-line="" style={lineStyle(lines, index)}>
            {block.items[index]}
          </li>
        ))}
      </ul>
    )
  }
  return (
    <ul data-slot="chalkboard-menu" data-chalk={chalk}>
      {uniqueKeys(block.items.map((item) => `${item.name} ${item.price}`)).map((key, index) => (
        <MenuItem key={key} item={block.items[index]!} lines={lines} offset={index} />
      ))}
    </ul>
  )
}

function Writing({ blocks, strokes: planned }: { blocks: readonly ChalkboardBlock[]; strokes: readonly Stroke[] }) {
  const keys = uniqueKeys(blocks.map((block) => JSON.stringify(block)))
  const firsts = blocks.map((_, index) => blocks.slice(0, index).reduce((sum, block) => sum + lineCount(block), 0))
  return blocks.map((block, index) => (
    <Block key={keys[index]} block={block} lines={{ first: firsts[index]!, strokes: planned }} />
  ))
}

const dataAttributes = (values: Record<string, string | undefined>): Record<`data-${string}`, string | undefined> =>
  Object.fromEntries(Object.entries(values).map(([key, value]) => [`data-${key}`, value]))

const keyOf = (blocks: readonly ChalkboardBlock[]) => JSON.stringify(blocks)

/**
 * A bar or café chalkboard in a wooden frame: headings, notices, lists and menus with prices on dot leaders, in chalk.
 * The words are real text, selectable and read in order. It can write itself in line by line, and when the content
 * changes the eraser wipes the old words, leaving a smudge, before the new ones go up.
 */
function Chalkboard({
  label,
  content,
  defaultContent,
  onContentChange,
  reveal = false,
  writingSpeed = 32,
  surface = "slate",
  tray = true,
  className,
}: ChalkboardProps) {
  const handle = usePrimitive(chalkboard, { content, defaultContent, onContentChange })
  useSyncExternalStore(handle.instance.subscribe, handle.instance.get, handle.instance.get)
  const blocks = chalkboardBlocks(handle.state.content) ?? []
  const key = keyOf(blocks)
  const [shown, setShown] = useState({ key, blocks, wiped: false })
  const [erased, setErased] = useState<{ key: string; blocks: readonly ChalkboardBlock[] } | null>(null)
  if (key !== shown.key) {
    setErased({ key: shown.key, blocks: shown.blocks })
    setShown({ key, blocks, wiped: true })
  }
  const writing = reveal || erased !== null
  const planned = reveal ? strokes(shown.blocks, writingSpeed, shown.wiped ? eraseMs : 0) : []

  const onSmudgeEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) setErased(null)
  }

  return usePart(
    handle,
    "root",
    {},
    {
      "aria-label": label,
      ...dataAttributes({ surface, reveal: reveal ? "" : undefined }),
      className: cn(
        "relative flex w-full flex-col",
        typeof className === "function" ? className({ writing }) : className,
      ),
      children: (
        <>
          <div data-slot="chalkboard-slate">
            <div
              key={shown.key}
              data-slot="chalkboard-writing"
              data-wiped={shown.wiped ? "" : undefined}
              data-reveal={reveal ? "" : undefined}
              style={cssVars({ "--chalk-erase": `${String(eraseMs)}ms` })}
            >
              <Writing blocks={shown.blocks} strokes={planned} />
            </div>
            {erased ? (
              <>
                <div key={erased.key} data-slot="chalkboard-erasing" aria-hidden="true" inert>
                  <Writing blocks={erased.blocks} strokes={[]} />
                </div>
                <div data-slot="chalkboard-smudge" aria-hidden="true" onAnimationEnd={onSmudgeEnd} />
              </>
            ) : null}
          </div>
          {tray ? (
            <div data-slot="chalkboard-tray" aria-hidden="true">
              <span data-slot="chalkboard-chalk" data-chalk="white" />
              <span data-slot="chalkboard-chalk" data-chalk="yellow" />
              <span data-slot="chalkboard-eraser" />
            </div>
          ) : null}
        </>
      ),
    },
    "section",
  )
}

export { Chalkboard }
export type {
  ChalkboardBlock,
  ChalkboardContent,
  ChalkboardMenuItem,
  ChalkboardProps,
  ChalkboardState,
  ChalkColor,
  ChalkboardSurface,
}
