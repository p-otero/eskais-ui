import { useEffect, useRef, useState } from "react"

import { analyzeSkyPhoto, type SkyPhotoAnalysis } from "@/lib/sky-photo"

type SkyPhotoState =
  | { status: "reading" }
  | { status: "ready"; analysis: SkyPhotoAnalysis }
  | { status: "failed"; error: string }

type Settled = { src: string; skyMask: string | undefined } & (
  | { status: "ready"; analysis: SkyPhotoAnalysis }
  | { status: "failed"; error: string }
)

/**
 * Reads a photo and finds its sky, again whenever `src` or `skyMask` changes; frees the last one's mask URL when it is
 * replaced or the component unmounts. Undefined without a photo.
 */
function useSkyPhoto(src: string | undefined, skyMask: string | undefined): SkyPhotoState | undefined {
  const [settled, setSettled] = useState<Settled | null>(null)

  useEffect(() => {
    if (!src) return
    const controller = new AbortController()
    let analysis: SkyPhotoAnalysis | undefined
    analyzeSkyPhoto(src, { skyMask, signal: controller.signal }).then(
      (result) => {
        analysis = result
        if (controller.signal.aborted) result.dispose()
        else setSettled({ src, skyMask, status: "ready", analysis: result })
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setSettled({ src, skyMask, status: "failed", error: error instanceof Error ? error.message : String(error) })
        }
      },
    )
    return () => {
      controller.abort()
      analysis?.dispose()
    }
  }, [src, skyMask])

  if (!src) return undefined
  if (settled?.src !== src || settled.skyMask !== skyMask) return { status: "reading" }
  return settled.status === "ready"
    ? { status: "ready", analysis: settled.analysis }
    : { status: "failed", error: settled.error }
}

/** Keeps the object URLs a component makes for local files: each new one frees the one before, and unmounting frees the last. */
function useObjectUrlOwner() {
  const current = useRef<string | null>(null)
  useEffect(
    () => () => {
      if (current.current) URL.revokeObjectURL(current.current)
    },
    [],
  )
  return (blob: Blob) => {
    if (current.current) URL.revokeObjectURL(current.current)
    current.current = URL.createObjectURL(blob)
    return current.current
  }
}

export { useObjectUrlOwner, useSkyPhoto }
export type { SkyPhotoState }
