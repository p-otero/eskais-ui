import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Bento, BentoTile } from "@/components/ui/bento"
import { ButtonLink } from "@/components/ui/button-link"
import { CodeBlock } from "@/components/ui/code-block"
import { Hero } from "@/components/ui/hero"
import { SectionHeading } from "@/components/ui/section-heading"
import { SiteFooter } from "@/components/ui/site-footer"
import { Step, Steps } from "@/components/ui/steps"

// The page's content in one place: edit these, then the props below, rather than the layout.
const content = {
  name: "Acme",
  hero: {
    eyebrow: "Now in public beta",
    title: "Ship the page,",
    titleMuted: "not the layout.",
    description: "Every section of this page is a registry block. Change its props and slots; the layout stays put.",
    primary: { label: "Get started", href: "#start" },
    secondary: { label: "See the features", href: "#features" },
    install: "npx shadcn@latest add @eskais/landing-page",
  },
  features: [
    { title: "Composed", description: "Hero, Bento, Steps and SiteFooter are blocks with props.", span: 3 },
    { title: "Accessible", description: "Landmarks, headings and links come right.", span: 3 },
    { title: "Themeable", description: "Tokens for colour, spacing and type.", span: 2 },
    { title: "Agent-ready", description: "Every control is a UI SDK part.", span: 4 },
  ],
  steps: [
    {
      title: "Install",
      description: "Add the block and its dependencies.",
      code: "npx shadcn@latest add @eskais/hero",
    },
    { title: "Edit", description: "Change the content object at the top of the page." },
    { title: "Ship", description: "It's your code: deploy it like any page." },
  ],
  footer: [
    {
      title: "Product",
      links: [
        { label: "Features", href: "#features" },
        { label: "Get started", href: "#start" },
      ],
    },
    { title: "Company", links: [{ label: "About", href: "#about" }] },
  ],
}

type LandingPageProps = {
  /** The site header, usually a Floating bar with the logo and navigation. */
  header?: ReactNode
  /** `div` when the page already has its `<main>`, like a preview inside another page. */
  as?: "main" | "div"
}

/** A whole landing page composed only of blocks: copy it, then edit `content` and the props. */
function LandingPage({ header, as: Main = "main" }: LandingPageProps) {
  return (
    <div className="flex min-h-full flex-col">
      {header}
      <Main
        id={Main === "main" ? "main" : undefined}
        tabIndex={Main === "main" ? -1 : undefined}
        className="flex flex-col gap-section px-section outline-none narrow:px-group"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-section">
          <Hero
            eyebrow={content.hero.eyebrow}
            title={content.hero.title}
            titleMuted={content.hero.titleMuted}
            description={content.hero.description}
            install={content.hero.install}
            actions={
              <>
                <ButtonLink size="lg" href={content.hero.primary.href}>
                  {content.hero.primary.label}
                </ButtonLink>
                <ButtonLink size="lg" variant="outline" href={content.hero.secondary.href}>
                  {content.hero.secondary.label}
                </ButtonLink>
              </>
            }
            aside={
              <BentoTile headingLevel={2} title={content.name} eyebrow="Preview" description={content.hero.description}>
                <div className="flex flex-wrap gap-inline">
                  <Badge tone="success">Ready</Badge>
                  <Badge tone="info">Composed</Badge>
                </div>
              </BentoTile>
            }
          />
          <section aria-labelledby="features" className="flex flex-col gap-section">
            <SectionHeading headingId="features" eyebrow="Features" title="Everything is a block." />
            <Bento>
              {content.features.map((feature) => (
                <BentoTile
                  key={feature.title}
                  span={feature.span}
                  title={feature.title}
                  description={feature.description}
                />
              ))}
            </Bento>
          </section>
          <section aria-labelledby="start" className="flex flex-col gap-section pb-section">
            <SectionHeading headingId="start" eyebrow="Get started" title="Three steps." />
            <Steps>
              {content.steps.map((step) => (
                <Step key={step.title} title={step.title} description={step.description}>
                  {step.code && <CodeBlock code={step.code} language="bash" aria-label={`${step.title} command`} />}
                </Step>
              ))}
            </Steps>
          </section>
        </div>
      </Main>
      <SiteFooter
        className="mt-auto"
        brand={content.name}
        description={content.hero.description}
        groups={content.footer}
        bottom={`© ${content.name}`}
      />
    </div>
  )
}

export { LandingPage }
export type { LandingPageProps }
