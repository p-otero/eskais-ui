import type { CSSProperties } from "react"

import SettingsPageExample from "../../../../site/src/examples/settings-page"

/** ?demo=settings-page: the settings page under a sticky bar, as in an app shell. */
function SettingsPageDemo() {
  return (
    <>
      <header
        data-testid="app-bar"
        className="sticky top-0 z-sticky flex h-(--topbar-height) items-center border-b bg-background px-inset-surface"
      >
        <span className="text-title-sm">Workspace</span>
      </header>
      <main
        className="mx-auto flex w-full max-w-5xl flex-col gap-group p-inset-surface"
        style={{ "--docs-top": "var(--topbar-height)" } as CSSProperties}
      >
        <h1 className="text-display-sm tracking-tight">Settings</h1>
        <SettingsPageExample />
      </main>
    </>
  )
}

export { SettingsPageDemo }
