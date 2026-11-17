import { DescriptionDetails, DescriptionItem, DescriptionList, DescriptionTerm } from "@/components/ui/description-list"
import { StatusPill } from "@/components/ui/status-pill"

export default function DescriptionListDemo() {
  return (
    <DescriptionList layout="inline" aria-label="Deployment" className="w-full max-w-xl">
      <DescriptionItem>
        <DescriptionTerm>Status</DescriptionTerm>
        <DescriptionDetails>
          <StatusPill tone="success">Live</StatusPill>
        </DescriptionDetails>
      </DescriptionItem>
      <DescriptionItem>
        <DescriptionTerm>Region</DescriptionTerm>
        <DescriptionDetails>eu-west-1</DescriptionDetails>
      </DescriptionItem>
      <DescriptionItem>
        <DescriptionTerm>Commit</DescriptionTerm>
        <DescriptionDetails copyable mono>
          9f2c4e1
        </DescriptionDetails>
      </DescriptionItem>
      <DescriptionItem>
        <DescriptionTerm>Owner</DescriptionTerm>
        <DescriptionDetails />
      </DescriptionItem>
    </DescriptionList>
  )
}
