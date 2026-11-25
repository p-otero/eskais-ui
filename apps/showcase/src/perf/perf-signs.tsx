import { Teletext } from "@/components/ui/teletext"

import "../../../../registry/styles/teletext.css"
import { teletextDemoPages } from "../signs/teletext-pages"

function TeletextScenario() {
  return (
    <div className="w-full max-w-3xl">
      <Teletext label="Teletext" service="ESKAIS" pages={teletextDemoPages} searchMs={0} clock={false} />
    </div>
  )
}

export { TeletextScenario }
