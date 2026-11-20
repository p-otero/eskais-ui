type ImageScanFit = "contain" | "cover"

/** A rectangle on the image, each value a fraction of its width or height, from its top left corner. */
type ImageScanBox = { x: number; y: number; width: number; height: number }

type ImageScanSize = { width: number; height: number }

/**
 * Where a region's box lands in the frame, in the frame's pixels, for an image drawn with `object-fit` and a centred
 * `object-position`. With `cover` the result can reach past the frame, which clips it.
 */
function mapRegionBox(
  box: ImageScanBox,
  { fit, image, frame }: { fit: ImageScanFit; image: ImageScanSize; frame: ImageScanSize },
): ImageScanBox {
  const scaleX = frame.width / image.width
  const scaleY = frame.height / image.height
  const scale = fit === "contain" ? Math.min(scaleX, scaleY) : Math.max(scaleX, scaleY)
  const width = image.width * scale
  const height = image.height * scale
  const left = (frame.width - width) / 2
  const top = (frame.height - height) / 2
  return { x: left + box.x * width, y: top + box.y * height, width: box.width * width, height: box.height * height }
}

/** A fraction from 0 to 1; anything else, or not a number, is pulled to the nearest end. */
const clampFraction = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))

/** Keeps a box inside the image, so a detector's rounding never draws a box past its edge. */
function clampBox(box: ImageScanBox): ImageScanBox {
  const x = clampFraction(box.x)
  const y = clampFraction(box.y)
  return {
    x,
    y,
    width: Math.min(clampFraction(box.width), 1 - x),
    height: Math.min(clampFraction(box.height), 1 - y),
  }
}

export { clampBox, clampFraction, mapRegionBox }
export type { ImageScanBox, ImageScanFit, ImageScanSize }
