import { seededRandom, type Context2D } from "@/lib/three-textures"

function grilleHoles(context: Context2D, size: number) {
  context.fillStyle = "#fff"
  context.fillRect(0, 0, size, size)
  context.fillStyle = "#000"
  for (let y = 4; y < size; y += 8) {
    for (let x = (y / 8) % 2 ? 8 : 4; x < size; x += 8) {
      context.beginPath()
      context.arc(x, y, 2.3, 0, Math.PI * 2)
      context.fill()
    }
  }
}

const runOutGrooves = [0.62, 0.78, 0.92]

function grooves(context: Context2D, size: number) {
  const random = seededRandom(33)
  const center = size / 2
  context.fillStyle = "#808080"
  context.fillRect(0, 0, size, size)
  for (let radius = center * 0.4; radius < center * 0.985; radius += 1.6) {
    const gap = runOutGrooves.some((groove) => Math.abs(radius / center - groove) < 0.006)
    context.strokeStyle = gap ? "#9a9a9a" : random() > 0.5 ? "#6c6c6c" : "#767676"
    context.lineWidth = gap ? 1.6 : 0.8
    context.beginPath()
    context.arc(center, center, radius, 0, Math.PI * 2)
    context.stroke()
  }
}

function tangents(context: Context2D, size: number) {
  const image = context.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - size / 2 + 0.5
      const dy = size / 2 - y - 0.5
      const length = Math.hypot(dx, dy) || 1
      const index = (y * size + x) * 4
      image.data[index] = ((-dy / length) * 0.5 + 0.5) * 255
      image.data[index + 1] = ((dx / length) * 0.5 + 0.5) * 255
      image.data[index + 2] = 255
      image.data[index + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
}

export { grilleHoles, grooves, tangents }
