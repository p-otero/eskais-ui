"use client"

import { mergeProps, renderElement, type PartProps } from "@ui-sdk/react/primitive"

import { useFastLink, type FastLinkOptions } from "@/components/ui/use-fast-link"

type FastLinkRegionProps = PartProps<"div"> & FastLinkOptions

/** Fast links for plain anchors in prose or rendered HTML; `Link` already has them. */
function FastLinkRegion({ enabled, onFollow, render, ...props }: FastLinkRegionProps) {
  const ref = useFastLink<HTMLDivElement>({ enabled, onFollow })
  return renderElement("div", mergeProps({ "data-slot": "fast-link-region", ref }, props), render)
}

export { FastLinkRegion, useFastLink }
export type { FastLinkOptions, FastLinkRegionProps }
