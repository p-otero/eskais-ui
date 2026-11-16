"use client"

import { Preferences } from "@ui-sdk/react/preferences"
import { useLayoutEffect, type ReactNode } from "react"

import { createAppearance, type Appearance as AppearanceState } from "@/lib/appearance-state"

type AppearanceProps<Theme extends string> = {
  appearance: AppearanceState<Theme>
  children?: ReactNode
}

/** Keeps `.dark` and `data-theme` on `<html>` in sync with `appearance` while it's mounted. */
function Appearance<Theme extends string>({ appearance, children }: AppearanceProps<Theme>) {
  useLayoutEffect(() => appearance.connect(), [appearance])
  return <Preferences preferences={[appearance.colorScheme]}>{children}</Preferences>
}

export { Appearance, createAppearance }
export type { AppearanceProps, AppearanceState }
