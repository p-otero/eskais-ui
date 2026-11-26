import DeviceCodePromptExample from "../../../../site/src/examples/device-code-prompt"

function DeviceCodePromptDemo() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-group p-inset-surface">
      <h1 className="text-display-sm tracking-tight">Sign in</h1>
      <DeviceCodePromptExample />
    </main>
  )
}

export { DeviceCodePromptDemo }
