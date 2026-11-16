import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Lightbox, ThemedImage } from "@/components/ui/lightbox"

import { screenshots } from "./fixtures"

export default function LightboxDemo() {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  return (
    <>
      <ul className="flex flex-wrap justify-center gap-items" aria-label="Release screenshots">
        {screenshots.map((shot, position) => (
          <li key={shot.id}>
            <Button
              variant="outline"
              aria-label={`View ${shot.name}`}
              className="h-24 w-36 overflow-hidden p-0"
              onClick={() => {
                setIndex(position)
                setOpen(true)
              }}
            >
              <ThemedImage src={shot.src} srcDark={shot.srcDark} alt="" className="size-full object-cover" />
            </Button>
          </li>
        ))}
      </ul>
      <Lightbox items={screenshots} index={index} onIndexChange={setIndex} open={open} onOpenChange={setOpen} />
    </>
  )
}
