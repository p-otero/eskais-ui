import SecretListExample from "../../../../site/src/examples/secret-list"

function SecretListDemo() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-group p-inset-surface">
      <h1 className="text-display-sm tracking-tight">Secrets</h1>
      <SecretListExample />
    </main>
  )
}

export { SecretListDemo }
