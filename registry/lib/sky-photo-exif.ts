/** What a photo's EXIF says about where and how it was taken. Every field is missing when the file doesn't carry it. */
type SkyPhotoExif = {
  /** EXIF orientation, 1 to 8; browsers already draw the image upright. */
  orientation?: number
  /** The capture time as the camera's clock showed it, `"2025-04-14T06:43:28"`, with no zone. */
  capturedAt?: string
  /** The clock's offset from UTC at capture, `"+08:00"`, when the camera wrote one. */
  utcOffset?: string
  latitude?: number
  longitude?: number
  /** The compass heading the lens pointed at, in degrees from true or magnetic north (see `headingReference`). */
  heading?: number
  headingReference?: "true" | "magnetic"
  /** The lens's focal length in millimetres. */
  focalLength?: number
  /** The focal length a full-frame (36 × 24 mm) camera would need for the same view. */
  focalLength35mm?: number
  /** Pixel size the camera recorded, before any orientation. */
  width?: number
  height?: number
}

const tags = {
  orientation: 0x0112,
  exifPointer: 0x8769,
  gpsPointer: 0x8825,
  dateTimeOriginal: 0x9003,
  offsetTimeOriginal: 0x9011,
  focalLength: 0x920a,
  focalLength35mm: 0xa405,
  pixelWidth: 0xa002,
  pixelHeight: 0xa003,
  gpsLatitudeRef: 0x0001,
  gpsLatitude: 0x0002,
  gpsLongitudeRef: 0x0003,
  gpsLongitude: 0x0004,
  gpsImgDirectionRef: 0x0010,
  gpsImgDirection: 0x0011,
} as const

const typeSizes: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }

type Entry = { type: number; count: number; offset: number }

class TiffReader {
  readonly view: DataView
  readonly start: number
  readonly little: boolean

  constructor(view: DataView, start: number) {
    this.view = view
    this.start = start
    this.little = view.getUint16(start) === 0x4949
  }

  u16(at: number) {
    return this.view.getUint16(this.start + at, this.little)
  }

  u32(at: number) {
    return this.view.getUint32(this.start + at, this.little)
  }

  inBounds(at: number, size: number) {
    return at >= 0 && this.start + at + size <= this.view.byteLength
  }

  directory(at: number): Map<number, Entry> {
    const entries = new Map<number, Entry>()
    if (!this.inBounds(at, 2)) return entries
    const count = this.u16(at)
    for (let index = 0; index < count; index++) {
      const entry = at + 2 + index * 12
      if (!this.inBounds(entry, 12)) break
      const type = this.u16(entry + 2)
      const valueCount = this.u32(entry + 4)
      const size = (typeSizes[type] ?? 0) * valueCount
      entries.set(this.u16(entry), { type, count: valueCount, offset: size <= 4 ? entry + 8 : this.u32(entry + 8) })
    }
    return entries
  }

  numbers(entry: Entry | undefined): number[] {
    if (!entry) return []
    const size = typeSizes[entry.type] ?? 0
    if (size === 0 || !this.inBounds(entry.offset, size * entry.count)) return []
    const values: number[] = []
    for (let index = 0; index < entry.count; index++) {
      const at = entry.offset + index * size
      if (entry.type === 3) values.push(this.u16(at))
      else if (entry.type === 4) values.push(this.u32(at))
      else if (entry.type === 9) values.push(this.view.getInt32(this.start + at, this.little))
      else if (entry.type === 5 || entry.type === 10) {
        const signed = entry.type === 10
        const numerator = signed ? this.view.getInt32(this.start + at, this.little) : this.u32(at)
        const denominator = signed ? this.view.getInt32(this.start + at + 4, this.little) : this.u32(at + 4)
        values.push(denominator === 0 ? Number.NaN : numerator / denominator)
      } else values.push(this.view.getUint8(this.start + at))
    }
    return values
  }

  text(entry: Entry | undefined) {
    if (entry?.type !== 2 || !this.inBounds(entry.offset, entry.count)) return undefined
    let text = ""
    for (let index = 0; index < entry.count; index++) {
      const code = this.view.getUint8(this.start + entry.offset + index)
      if (code === 0) break
      text += String.fromCharCode(code)
    }
    return text.trim() || undefined
  }
}

const finite = (value: number | undefined) => (value !== undefined && Number.isFinite(value) ? value : undefined)

function degreesOf(parts: number[], reference: string | undefined) {
  if (parts.length < 3 || !parts.every(Number.isFinite)) return undefined
  const degrees = parts[0]! + parts[1]! / 60 + parts[2]! / 3600
  return reference === "S" || reference === "W" ? -degrees : degrees
}

const capturedPattern = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/

function readTiff(view: DataView, start: number): SkyPhotoExif {
  const tiff = new TiffReader(view, start)
  if (tiff.u16(2) !== 42) return {}
  const main = tiff.directory(tiff.u32(4))
  const exifAt = tiff.numbers(main.get(tags.exifPointer))[0]
  const gpsAt = tiff.numbers(main.get(tags.gpsPointer))[0]
  const exif = exifAt === undefined ? new Map<number, Entry>() : tiff.directory(exifAt)
  const gps = gpsAt === undefined ? new Map<number, Entry>() : tiff.directory(gpsAt)
  const result: SkyPhotoExif = {}

  const orientation = tiff.numbers(main.get(tags.orientation))[0]
  if (orientation !== undefined && orientation >= 1 && orientation <= 8) result.orientation = orientation
  const captured = capturedPattern.exec(tiff.text(exif.get(tags.dateTimeOriginal)) ?? "")
  if (captured) {
    const [, year, month, day, hours, minutes, seconds] = captured
    result.capturedAt = `${year!}-${month!}-${day!}T${hours!}:${minutes!}:${seconds!}`
  }
  const offset = tiff.text(exif.get(tags.offsetTimeOriginal))
  if (offset && /^[+-]\d{2}:\d{2}$/.test(offset)) result.utcOffset = offset
  const focalLength = finite(tiff.numbers(exif.get(tags.focalLength))[0])
  if (focalLength && focalLength > 0) result.focalLength = focalLength
  const focalLength35mm = finite(tiff.numbers(exif.get(tags.focalLength35mm))[0])
  if (focalLength35mm && focalLength35mm > 0) result.focalLength35mm = focalLength35mm
  const width = tiff.numbers(exif.get(tags.pixelWidth))[0]
  const height = tiff.numbers(exif.get(tags.pixelHeight))[0]
  if (width && height) {
    result.width = width
    result.height = height
  }

  const latitude = degreesOf(tiff.numbers(gps.get(tags.gpsLatitude)), tiff.text(gps.get(tags.gpsLatitudeRef)))
  const longitude = degreesOf(tiff.numbers(gps.get(tags.gpsLongitude)), tiff.text(gps.get(tags.gpsLongitudeRef)))
  if (latitude !== undefined && longitude !== undefined && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
    result.latitude = latitude
    result.longitude = longitude
  }
  const heading = finite(tiff.numbers(gps.get(tags.gpsImgDirection))[0])
  if (heading !== undefined && heading >= 0 && heading <= 360) {
    result.heading = heading % 360
    result.headingReference = tiff.text(gps.get(tags.gpsImgDirectionRef)) === "M" ? "magnetic" : "true"
  }
  return result
}

const exifHeader = 0x45786966

/**
 * Reads a JPEG's EXIF (its APP1 segment) or a bare TIFF. Unknown, broken or missing data gives an empty object; it
 * never throws. The first 128 KB of a file are enough: cameras write EXIF before the image.
 */
function readSkyPhotoExif(bytes: ArrayBuffer | ArrayBufferView): SkyPhotoExif {
  const view = ArrayBuffer.isView(bytes)
    ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    : new DataView(bytes)
  try {
    if (view.byteLength < 8) return {}
    const first = view.getUint16(0)
    if (first === 0x4949 || first === 0x4d4d) return readTiff(view, 0)
    if (first !== 0xffd8) return {}
    let at = 2
    while (at + 4 <= view.byteLength) {
      const marker = view.getUint16(at)
      if ((marker & 0xff00) !== 0xff00 || marker === 0xffda || marker === 0xffd9) return {}
      const length = view.getUint16(at + 2)
      if (marker === 0xffe1 && at + 10 <= view.byteLength && view.getUint32(at + 4) === exifHeader) {
        return readTiff(view, at + 10)
      }
      at += 2 + length
    }
    return {}
  } catch {
    return {}
  }
}

/** Reads the EXIF of a `File` or `Blob` from its first 128 KB. */
async function readSkyPhotoExifFrom(blob: Blob): Promise<SkyPhotoExif> {
  return readSkyPhotoExif(await blob.slice(0, 131_072).arrayBuffer())
}

export { readSkyPhotoExif, readSkyPhotoExifFrom }
export type { SkyPhotoExif }
