import MasterDetailExample from "../../../../site/src/examples/master-detail"

/** The layout blocks alone: ?demo=master-detail fills the window, for tooling/shell-check.mjs and screenshots. */
function MasterDetailDemo() {
  return (
    <main className="flex h-dvh flex-col p-inset-surface narrow:p-0">
      <h1 className="sr-only">Devices</h1>
      <MasterDetailExample className="min-h-0 flex-1" />
    </main>
  )
}

export { MasterDetailDemo }
