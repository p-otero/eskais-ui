"use client"

import { Preferences } from "@ui-sdk/react/preferences"
import { useLayoutEffect, type ReactNode } from "react"

import { createAppearance, type Appearance as AppearanceState } from "@/lib/appearance-state"

type AppearanceProps<Theme extends string, Palette extends string> = {
  appearance: AppearanceState<Theme, Palette>
  children?: ReactNode
}

/** Keeps `.dark`, `data-theme` and `data-palette` on `<html>` in sync with `appearance` while it's mounted. */
function Appearance<Theme extends string, Palette extends string>({
  appearance,
  children,
}: AppearanceProps<Theme, Palette>) {
  useLayoutEffect(() => appearance.connect(), [appearance])
  return <Preferences preferences={[appearance.colorScheme]}>{children}</Preferences>
}

export { Appearance, createAppearance }
export type { AppearanceProps, AppearanceState }
