import InvitationPanelExample from "../../../../site/src/examples/invitation-panel"

function InvitationPanelDemo() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-group p-inset-surface">
      <h1 className="text-display-sm tracking-tight">Members</h1>
      <InvitationPanelExample />
    </main>
  )
}

export { InvitationPanelDemo }
