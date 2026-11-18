import { ImageCropper } from "@/components/ui/image-cropper"

const photo = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><rect width="640" height="420" fill="#e5e5e5"/><circle cx="460" cy="150" r="56" fill="#fafafa"/><path d="M0 280 120 170l110 100 120-130 130 125 90-60 70 40v175H0z" fill="#a3a3a3"/><path d="M0 330l160-80 120 70 150-80 210 85v95H0z" fill="#525252"/></svg>`,
)}`

export default function ImageCropperDemo() {
  return (
    <ImageCropper
      aria-label="Profile photo"
      src={photo}
      alt="Mountains at sunset"
      mode="frame"
      shape="circle"
      aspectRatio={1}
      maxZoom={4}
      className="max-w-sm"
    />
  )
}
