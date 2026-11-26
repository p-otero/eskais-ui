import ConnectedAccountExample from "../../../../site/src/examples/connected-account"

function ConnectedAccountDemo() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-group p-inset-surface">
      <h1 className="text-display-sm tracking-tight">Connected accounts</h1>
      <ConnectedAccountExample />
    </main>
  )
}

export { ConnectedAccountDemo }
