import { parseFrontmatter } from "@/components/ui/markdown-view"

type Note = { slug: string; title: string; folder: string; markdown: string }

const initialNotes: Note[] = [
  {
    slug: "launch-plan",
    title: "Launch plan",
    folder: "Projects",
    markdown: `---
status: active
owner: Ines
tags: [launch, q3]
---
# Launch plan

The launch follows the [[goals|quarter's goals]] and keeps an eye on [[risks]].

![[timeline]]

## Milestones

- [x] Freeze the scope
- [ ] Beta to the first ten teams
- [ ] Public launch

## Open questions

Who owns the migration guide? See [[goals#owners]] and the **support** rota.

## Rollout

| Week | Teams | Gate |
| :--- | ---: | :--- |
| 36 | 10 | Error rate under 1% |
| 38 | 40 | Support load flat |
| 40 | all | Sign-off from the [[goals]] owners |

## Notes

Long notes scroll inside the document; the outline jumps between headings in both modes, and switching between
Edit and Read keeps the heading you were reading at the top.

The beta teams get a short survey after their first week. Their answers decide whether the migration guide needs
a video, and whether the importer should keep the folder structure of the old tool.

Support keeps a shared list of the questions that come up twice. Anything on it by week 38 goes into the guide
before the public launch.

Pricing stays as it is for the launch; the review comes with the next quarter's plan.

Week 36: the first ten teams move their notes with the importer. Each gets a named contact in support.

Week 37: we read the survey answers together and decide on the video for the migration guide.

Week 38: forty teams. The error budget is reviewed daily; a breach pauses the rollout, not the launch date.

Week 39: the guide is frozen. Translations start for Spanish and German.

Week 40: everyone. The old tool stays read-only for a quarter, then exports its archive.

After the launch, the retro goes in [[risks]] with what slipped and why.
`,
  },
  {
    slug: "goals",
    title: "Goals",
    folder: "Projects",
    markdown: `---
status: agreed
---
# Goals

1. Ship the beta in September.
2. Halve the time to the first document.

## Owners

Ines leads the launch; Kofi the [[launch-plan|plan]]'s migration guide.
`,
  },
  {
    slug: "risks",
    title: "Risks",
    folder: "Archive",
    markdown: `# Risks

| Risk | Owner | Status |
| :--- | :--- | ---: |
| Migration slips | Kofi | watching |
| Support load | Ines | planned |

> Back to the [[launch-plan]].
`,
  },
]

const titleOf = (notes: Note[], slug: string) => notes.find((note) => note.slug === slug.split("#")[0])?.title

function snippetOf(markdown: string) {
  const body = markdown.slice((parseFrontmatter(markdown)?.to ?? -1) + 1)
  return body
    .split("\n")
    .find((line) => line.trim() && !line.startsWith("#"))
    ?.trim()
}

export { initialNotes, snippetOf, titleOf }
