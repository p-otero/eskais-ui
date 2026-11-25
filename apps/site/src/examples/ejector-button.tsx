import { EjectorButton } from "@/components/ui/ejector-button"

export default function EjectorButtonDemo() {
  return (
    <div className="w-full max-w-sm">
      <EjectorButton
        label="Delete staging"
        agentConfirm="Deletes the staging environment and its data"
        onEject={() => new Promise((done) => setTimeout(done, 1200))}
      />
    </div>
  )
}
