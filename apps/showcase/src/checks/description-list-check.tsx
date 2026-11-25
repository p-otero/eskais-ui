import {
  DescriptionDetails,
  DescriptionItem,
  DescriptionList,
  DescriptionTerm,
  type DescriptionListLayout,
} from "@/components/ui/description-list"
import { StatusPill } from "@/components/ui/status-pill"

const widths = { wide: "40rem", narrow: "20rem" } as const

function Fields({ layout, width }: { layout: DescriptionListLayout; width: keyof typeof widths }) {
  return (
    <DescriptionList
      layout={layout}
      columns={3}
      aria-label={`${layout} ${width}`}
      data-testid={`${layout}-${width}`}
      style={{ width: widths[width] }}
    >
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

function DescriptionListCheck() {
  return (
    <main className="flex flex-col gap-section p-section">
      {(["stacked", "inline", "grid"] as const).map((layout) => (
        <section key={layout} aria-label={layout} className="flex flex-wrap items-start gap-section">
          <Fields layout={layout} width="wide" />
          <Fields layout={layout} width="narrow" />
        </section>
      ))}
    </main>
  )
}

export { DescriptionListCheck }
