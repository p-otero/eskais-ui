import DeviceApprovalExample from "../../../../site/src/examples/device-approval"

function DeviceApprovalDemo() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-group p-inset-surface">
      <h1 className="text-display-sm tracking-tight">Devices</h1>
      <DeviceApprovalExample />
    </main>
  )
}

export { DeviceApprovalDemo }
