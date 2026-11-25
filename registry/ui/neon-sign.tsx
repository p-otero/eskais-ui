"use client"

import { usePart, usePrimitive } from "@ui-sdk/react/primitive"
import { type AnimationEvent, useRef, useState, useSyncExternalStore } from "react"

import { neonSign, type NeonSignOptions } from "@/components/ui/neon-sign-primitive"
import { useNeonBuzz } from "@/components/ui/use-neon-buzz"
import { cn, cssVars } from "@/lib/utils"

type NeonColor = "pink" | "red" | "orange" | "green" | "blue" | "cyan" | "violet" | "white"

type NeonWall = "brick" | "dark"

type NeonSignLabels = {
  /** Follows the text in the status while the tubes are off: "On air, off". */
  off: string
}

const neonSignLabels: NeonSignLabels = { off: "off" }

type NeonSignState = { on: boolean }

type NeonSignProps = NeonSignOptions & {
  /** The status's accessible name: "Studio", "Shop". */
  label: string
  /** What the tubes spell: "On air", "Open", "Recording". */
  text: string
  /** A smaller second line under it, in its own tube. */
  sub?: string
  /** The tube's colour. Default `pink`. */
  color?: NeonColor
  /** The second line's colour. Defaults to `color`. */
  subColor?: NeonColor
  /** What the sign hangs on. Default `brick`. */
  wall?: NeonWall
  /** Now and then dims a letter for a moment while lit, as a tired transformer does. Never under reduced motion. Default true. */
  buzz?: boolean
  labels?: Partial<NeonSignLabels>
  /** Classes for the wall; a function gets the sign's state. */
  className?: string | ((state: NeonSignState) => string | undefined)
}

const strikeDelaysMs = [0, 90, 30, 160, 60, 0, 120, 40]
const lateStrikeMs = 620

function lettersOf(text: string): string[] {
  if (typeof Intl.Segmenter === "function")
    return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map(({ segment }) => segment)
  return [...text]
}

const dataAttributes = (values: Record<string, string | undefined>): Record<`data-${string}`, string | undefined> =>
  Object.fromEntries(Object.entries(values).map(([key, value]) => [`data-${key}`, value]))

type Tube = { text: string; color: NeonColor; line: "main" | "sub" }

function Tube({ text, color, line }: Tube) {
  const letters = lettersOf(text)
  const late = (letters.length * 5 + 3) % Math.max(1, letters.length)
  const lettersAs = (lit: boolean) =>
    letters.map((letter, index) => (
      <span
        // oxlint-disable-next-line react/no-array-index-key -- a letter repeats, and only its place in the word tells it apart
        key={index}
        data-letter={lit ? "lit" : "glass"}
        style={
          lit
            ? cssVars({
                "--neon-strike": `${String(index === late ? lateStrikeMs : strikeDelaysMs[index % strikeDelaysMs.length]!)}ms`,
              })
            : undefined
        }
      >
        {letter}
      </span>
    ))
  return (
    <span data-slot="neon-sign-tube" data-line={line} data-color={color} aria-hidden="true">
      <span data-slot="neon-sign-glass">{lettersAs(false)}</span>
      <span data-slot="neon-sign-light">{lettersAs(true)}</span>
    </span>
  )
}

/**
 * A neon tube sign on a brick or dark wall, for a status read at a glance: "On air", "Open", "Recording". It strikes
 * with a flicker when turned on, then glows steady with a rare buzz; reduced motion fades it on and never buzzes. It
 * is a status: its label names it, and its text, with "off" while dark, is what screen readers hear.
 */
function NeonSign({
  label,
  text,
  sub,
  color = "pink",
  subColor,
  wall = "brick",
  buzz = true,
  on,
  defaultOn,
  onOnChange,
  labels: ownLabels,
  className,
}: NeonSignProps) {
  const labels = { ...neonSignLabels, ...ownLabels }
  const handle = usePrimitive(neonSign, { on, defaultOn, onOnChange })
  useSyncExternalStore(handle.instance.subscribe, handle.instance.get, handle.instance.get)
  const lit = handle.state.on
  const [wasLit, setWasLit] = useState(lit)
  const [striking, setStriking] = useState(false)
  if (lit !== wasLit) {
    setWasLit(lit)
    setStriking(lit)
  }
  const sign = useRef<HTMLDivElement>(null)
  useNeonBuzz(sign, lit && buzz && !striking)

  const onAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) setStriking(false)
  }
  const spoken = [text, sub].filter(Boolean).join(", ")

  return usePart(
    handle,
    "root",
    {},
    {
      ref: sign,
      "aria-label": label,
      ...dataAttributes({ wall, color, striking: striking ? "" : undefined }),
      onAnimationEnd,
      className: cn(
        "relative flex w-full flex-col items-center justify-center",
        typeof className === "function" ? className({ on: lit }) : className,
      ),
      children: (
        <>
          <span data-slot="neon-sign-board">
            <Tube text={text} color={color} line="main" />
            {sub ? <Tube text={sub} color={subColor ?? color} line="sub" /> : null}
          </span>
          <span className="sr-only">{lit ? spoken : `${spoken}, ${labels.off}`}</span>
        </>
      ),
    },
    "div",
  )
}

export { NeonSign, neonSignLabels }
export type { NeonColor, NeonSignLabels, NeonSignProps, NeonSignState, NeonWall }
