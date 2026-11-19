import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { StatusDot, StatusPill } from "@/components/ui/status-pill"
import { tones, type Tone as ToneName } from "@/lib/tone"

import { A, Article, Code, DocTable, DocTitle, H2, P, Pre, Ul } from "../docs/prose"

const meanings: Record<ToneName, string> = {
  neutral: "No judgement: draft, queued, unknown",
  info: "Something to know, in progress",
  success: "Done, healthy, passed",
  warning: "Needs attention soon",
  destructive: "Failed, blocked, irreversible",
  violet: "A category (a label, a kind of item), no status",
}

export default function Tone() {
  return (
    <Article>
      <DocTitle
        eyebrow="Theming"
        title="Tone and colour"
        description="One vocabulary says what a status means, across Badge, Alert, StatusPill, StatusDot, Progress, Meter and Toast."
      />

      <H2 id="tones">The six tones</H2>
      <DocTable
        label="Tones"
        head={["Tone", "Meaning", "Looks"]}
        rows={tones.map((tone) => [
          <Code key="t">{tone}</Code>,
          meanings[tone],
          <span key="l" className="flex flex-wrap items-center gap-inline">
            <StatusDot tone={tone} label={tone} />
            <Badge tone={tone}>{tone}</Badge>
            <StatusPill tone={tone}>{tone}</StatusPill>
          </span>,
        ])}
      />
      <P>
        Never add a component-specific word for these (<Code>error</Code>, <Code>danger</Code>, <Code>positive</Code>):
        map it to a tone. Import the type and the names from <Code>@/lib/tone</Code> (
        <A to="/docs/components/tone">the tone item</A>).
      </P>
      <Pre code={`import { Tone } from "@/lib/tone"\n\n<Badge tone={Tone.success}>Ready</Badge>`} />

      <H2 id="soft">Soft tokens</H2>
      <P>
        Every tone has a soft fill, text that holds 4.5:1 on it, and an edge:{" "}
        <Code>bg-info-soft text-info-soft-foreground border-info-border</Code>. Never tint with an opacity modifier (
        <Code>bg-info/10</Code>): it disappears over a dark or glass surface.
      </P>
      <div className="grid grid-cols-2 gap-items max-sm:grid-cols-1">
        <Alert tone="success">
          <AlertTitle>Deployed</AlertTitle>
          <AlertDescription>Apollo is live.</AlertDescription>
        </Alert>
        <Alert tone="warning">
          <AlertTitle>Quota almost used</AlertTitle>
          <AlertDescription>New runs pause at 100%.</AlertDescription>
        </Alert>
      </div>

      <H2 id="links">Links</H2>
      <Ul>
        <li>
          <Code>text-link</Code> for inline links and Button <Code>variant="link"</Code>; <Code>text-link-soft</Code>{" "}
          for quieter references and an editor caret. Both derive from <Code>--link-brand</Code> and reach 4.5:1 on
          background, card and muted in every palette.
        </li>
        <li>Pair a link colour with an underline, at rest or on hover, so it doesn't rely on colour alone.</li>
        <li>
          <Code>accent</Code> is a hover and selected surface only, never a text colour or a stroke. For a stroke use{" "}
          <Code>border-input-strong</Code>, <Code>border-primary</Code> or <Code>ring-ring</Code>.
        </li>
      </Ul>

      <H2 id="charts">Chart series</H2>
      <P>
        Categorical series use <Code>--chart-1</Code> to <Code>--chart-5</Code>. A series with a meaning uses{" "}
        <Code>--series-positive</Code>, <Code>--series-negative</Code>, <Code>--series-target</Code> or{" "}
        <Code>--series-remaining</Code>, each 3:1 on background and card. Still add a legend and dash a target line.
      </P>
    </Article>
  )
}
