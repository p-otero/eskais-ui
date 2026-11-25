import type { ImageScanRegion } from "@/components/ui/image-scan"

const stillLife = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#e7e2d8"/><rect y="430" width="800" height="170" fill="#b58a62"/><ellipse cx="210" cy="230" rx="90" ry="70" fill="#4f8a4b"/><ellipse cx="170" cy="280" rx="60" ry="45" fill="#3f7a3c"/><ellipse cx="260" cy="285" rx="55" ry="40" fill="#5f9c58"/><path d="M150 330h120l-15 100h-90z" fill="#c4683f"/><rect x="360" y="335" width="90" height="95" rx="10" fill="#3d6ea6"/><path d="M450 355a28 28 0 0 1 0 56" fill="none" stroke="#3d6ea6" stroke-width="12"/><rect x="520" y="390" width="180" height="40" rx="4" fill="#7b4c8c"/><rect x="535" y="352" width="150" height="38" rx="4" fill="#d6a443"/></svg>`,
)}`

const stillLifeRegions: ImageScanRegion[] = [
  {
    id: "plant",
    label: "Plant",
    description: "94%",
    tone: "success",
    box: { x: 0.14, y: 0.26, width: 0.25, height: 0.46 },
  },
  { id: "mug", label: "Mug", description: "88%", tone: "info", box: { x: 0.44, y: 0.55, width: 0.16, height: 0.17 } },
  {
    id: "books",
    label: "Books",
    description: "81%",
    tone: "violet",
    box: { x: 0.65, y: 0.58, width: 0.23, height: 0.14 },
  },
]

const targets = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="#808080"/><rect x="80" y="80" width="160" height="200" fill="#ff0000"/><rect x="560" y="40" width="160" height="120" fill="#0000ff"/></svg>`,
)}`

const targetRegions: ImageScanRegion[] = [
  { id: "red", label: "Red square", tone: "destructive", box: { x: 0.1, y: 0.2, width: 0.2, height: 0.5 } },
  { id: "blue", label: "Blue square", tone: "info", box: { x: 0.7, y: 0.1, width: 0.2, height: 0.3 } },
]

const scanSteps = [
  { id: "read", label: "Read pixels" },
  { id: "detect", label: "Find objects" },
  { id: "label", label: "Label them" },
]

export { scanSteps, stillLife, stillLifeRegions, targetRegions, targets }
