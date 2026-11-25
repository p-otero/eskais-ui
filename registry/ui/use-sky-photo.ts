import { useEffect, useRef, useState } from "react"

import { analyzeSkyPhoto, type SkyPhotoAnalysis } from "@/lib/sky-photo"

type SkyPhotoState =
  | { status: "reading" }
  | { status: "ready"; analysis: SkyPhotoAnalysis }
  | { status: "failed"; error: string }

/** What to read from the photo besides its sky. */
type SkyPhotoFeatures = { skyMask?: string | undefined; clouds?: boolean | undefined; windows?: boolean | undefined }

type Settled = { key: string } & ({ status: "ready"; analysis: SkyPhotoAnalysis } | { status: "failed"; error: string })

/**
 * Reads a photo and finds its sky (and its clouds or windows, when asked), again whenever any of them changes; frees the
 * last one's URLs when it is replaced or the component unmounts. Undefined without a photo.
 */
function useSkyPhoto(
  src: string | undefined,
  { skyMask, clouds = false, windows = false }: SkyPhotoFeatures = {},
): SkyPhotoState | undefined {
  const [settled, setSettled] = useState<Settled | null>(null)
  const key = JSON.stringify([src, skyMask, clouds, windows])

  useEffect(() => {
    if (!src) return
    const controller = new AbortController()
    let analysis: SkyPhotoAnalysis | undefined
    analyzeSkyPhoto(src, { skyMask, clouds, windows, signal: controller.signal }).then(
      (result) => {
        analysis = result
        if (controller.signal.aborted) result.dispose()
        else setSettled({ key, status: "ready", analysis: result })
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setSettled({ key, status: "failed", error: error instanceof Error ? error.message : String(error) })
        }
      },
    )
    return () => {
      controller.abort()
      analysis?.dispose()
    }
  }, [key, src, skyMask, clouds, windows])

  if (!src) return undefined
  if (settled?.key !== key) return { status: "reading" }
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
export type { SkyPhotoFeatures, SkyPhotoState }
