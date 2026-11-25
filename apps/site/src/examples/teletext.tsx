import { Teletext } from "@/components/ui/teletext"

import { teletextDemoPages } from "../../../showcase/src/signs/teletext-pages"

export default function TeletextDemo() {
  return (
    <div className="w-full max-w-xl">
      <Teletext label="Teletext" service="ESKAIS" pages={teletextDemoPages} />
    </div>
  )
}
