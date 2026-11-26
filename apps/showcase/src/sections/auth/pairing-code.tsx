import PairingCodeExample from "../../../../site/src/examples/pairing-code"

function PairingCodeDemo() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-group p-inset-surface">
      <h1 className="text-display-sm tracking-tight">Connect a device</h1>
      <PairingCodeExample />
    </main>
  )
}

export { PairingCodeDemo }
