"use client"

import {
  Children,
  isValidElement,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react"

import { Button as ButtonPrimitive } from "@ui-sdk/react/button"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DescriptionList, type DescriptionListProps } from "@/components/ui/description-list"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Link } from "@/components/ui/link"
import { isPlainClick } from "@/components/ui/link-primitive"
import { Select } from "@/components/ui/select"
import {
  PendingSectionContext,
  useObservedSection,
  usePendingSection,
  useSectionMounted,
  useUrlSection,
} from "@/components/ui/use-settings-page"
import type { UrlParamAdapter } from "@/lib/url-param"
import { cn } from "@/lib/utils"

type SettingsPageLabels = {
  /** Names the navigation of sections. */
  nav: string
  /** Names the section picker on narrow containers. */
  jump: string
}

const settingsPageLabels: SettingsPageLabels = { nav: "Settings sections", jump: "Go to section" }

type SettingsSectionLink = { id: string; label: string }

/** Why the current section changed: `scroll` reading, `nav` the navigation or picker, `url` the URL. */
type SettingsSectionChangeReason = "scroll" | "nav" | "url"

type SettingsPageProps = Omit<ComponentProps<"div">, "onChange"> & {
  /** The navigation's entries. By default, every direct `SettingsSection` child's `id` and `navLabel` or text title. */
  sections?: readonly SettingsSectionLink[]
  /** The section marked current; set it to follow your own state, otherwise it follows scrolling. */
  currentSection?: string
  onSectionChange?: (id: string, details: { reason: SettingsSectionChangeReason }) => void
  /**
   * Keeps the section in the URL and scrolls to it on load and on Back: `createUrlParam("section")` from
   * `@/lib/url-param`, which never touches `location.hash`, or `createUrlParam("section", { router: hashRouter() })`
   * for `#/settings?section=id` inside a hash route. Its `href` builds the navigation's links. A section that
   * renders later, like after its data loads, is scrolled to when it mounts, unless the person has acted since.
   */
  url?: UrlParamAdapter
  /**
   * A navigation entry's href, for opening in a new tab: by default the `url` adapter's href for the section, else
   * `#id`. A plain click scrolls without following it.
   */
  getHref?: (id: string) => string
  /**
   * `links` (default): the navigation's entries are links to each section, which open in a new tab. `buttons`:
   * buttons that scroll to a section, for a page whose sections have no address of their own.
   */
  navigation?: "links" | "buttons"
  labels?: Partial<SettingsPageLabels>
  /**
   * `--settings-top` (0 by default): the height of anything sticky above the page, like a topbar. `--settings-height`
   * (the viewport by default): the height of the box that scrolls the page, for a page inside a pane.
   */
  style?: CSSProperties
}

function sectionsOf(children: ReactNode): SettingsSectionLink[] {
  const links: SettingsSectionLink[] = []
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) continue
    const props = (child as ReactElement<Partial<SettingsSectionProps>>).props
    const label = props.navLabel ?? (typeof props.title === "string" ? props.title : undefined)
    if (typeof props.id === "string" && label !== undefined) links.push({ id: props.id, label })
  }
  return links
}

function reducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
}

function focusTitle(id: string) {
  document
    .getElementById(id)
    ?.querySelector<HTMLElement>('[data-slot="settings-section-title"]')
    ?.focus({ preventScroll: true })
}

function goTo(id: string, smooth: boolean, focus: boolean) {
  const section = document.getElementById(id)
  if (!section) return false
  section.scrollIntoView({ block: "start", behavior: smooth && !reducedMotion() ? "smooth" : "auto" })
  if (focus) focusTitle(id)
  return true
}

const hashOf = (id: string) => `#${id}`

const navEntryClassName =
  "rounded-control px-inset-item py-inline text-body-sm text-muted-foreground transition-colors duration-micro ease-standard outline-none hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[current]:bg-accent aria-[current]:font-medium aria-[current]:text-accent-foreground"

/**
 * A settings page: a section navigation that sticks beside the sections on wide containers and becomes a picker on
 * narrow ones, with the section being read marked as you scroll. Going to a section scrolls by id and moves focus to
 * its heading, so it works under any router.
 */
function SettingsPage({
  sections: sectionsProp,
  currentSection,
  onSectionChange,
  url,
  getHref,
  navigation = "links",
  labels: overrides,
  className,
  style,
  children,
  ...props
}: SettingsPageProps) {
  const labels = { ...settingsPageLabels, ...overrides }
  const hrefOf = getHref ?? (url?.href ? (id: string) => url.href?.(id) ?? hashOf(id) : hashOf)
  const sections = sectionsProp ?? sectionsOf(children)
  const ids = sections.map((section) => section.id).join("\n")
  const [chosen, setChosen] = useState<string>()
  // The picker's list returns focus to its trigger once it has closed, so the heading takes focus after that.
  const focusOnClose = useRef<string | null>(null)
  const { observed, pin } = useObservedSection(ids, (id) => {
    if (currentSection === undefined) onSectionChange?.(id, { reason: "scroll" })
  })
  const current = currentSection ?? observed ?? chosen ?? sections[0]?.id

  const pending = usePendingSection()

  const jump = (id: string, reason: SettingsSectionChangeReason, focus = true) => {
    pending.cancel()
    pin(id)
    setChosen(id)
    if (!goTo(id, reason !== "url", focus) && reason === "url") {
      pending.wait(id, (arrived) => {
        pin(arrived)
        goTo(arrived, false, focus)
      })
    }
    onSectionChange?.(id, { reason })
  }
  const write = useUrlSection(url, (id) => jump(id, "url"))
  const choose = (id: string, focus = true) => {
    jump(id, "nav", focus)
    write(id)
  }

  return (
    <div
      data-slot="settings-page"
      className={cn("@container/settings w-full min-w-0", className)}
      style={
        {
          "--settings-top": "0px",
          "--settings-height": "100dvh",
          ...style,
          "--settings-scroll-margin": "calc(var(--settings-top) + var(--gap-group))",
          "--settings-nav-height": "calc(var(--settings-height) - var(--settings-scroll-margin) - var(--gap-group))",
        } as CSSProperties
      }
      {...props}
    >
      <div className="flex flex-col gap-section @3xl/settings:flex-row @3xl/settings:items-start">
        <nav
          aria-label={labels.nav}
          data-slot="settings-nav"
          className="sticky top-(--settings-scroll-margin) hidden max-h-(--settings-nav-height) w-52 shrink-0 flex-col gap-px overflow-y-auto @3xl/settings:flex"
        >
          {sections.map((section) =>
            navigation === "buttons" ? (
              <ButtonPrimitive
                key={section.id}
                aria-current={section.id === current ? "location" : undefined}
                onClick={() => choose(section.id)}
                className={cn(navEntryClassName, "cursor-pointer text-start")}
              >
                {section.label}
              </ButtonPrimitive>
            ) : (
              <Link
                key={section.id}
                variant="plain"
                href={hrefOf(section.id)}
                current={section.id === current ? "location" : undefined}
                onFollow={() => choose(section.id)}
                // A hash route follows on pointerdown and focuses the heading; the same press would then focus the
                // link. A plain press keeps focus where it is, and the click puts it back if a browser moved it anyway.
                onMouseDown={(event) => {
                  if (isPlainClick(event.nativeEvent)) event.preventDefault()
                }}
                onClick={(event) => {
                  if (isPlainClick(event.nativeEvent) && document.activeElement === event.currentTarget)
                    focusTitle(section.id)
                }}
                className={navEntryClassName}
              >
                {section.label}
              </Link>
            ),
          )}
        </nav>
        <div
          data-slot="settings-picker"
          className="sticky top-(--settings-top) z-sticky -my-inline bg-background py-inline @3xl/settings:hidden"
        >
          <Select
            aria-label={labels.jump}
            options={sections.map((section) => ({ value: section.id, label: section.label }))}
            value={current ?? null}
            onValueChange={(id, details) => {
              if (typeof id !== "string") return
              const fromList = details.reason === "item-press" || details.reason === "list-navigation"
              choose(id, !fromList)
              if (fromList) focusOnClose.current = id
            }}
            onOpenChangeComplete={(open) => {
              const id = focusOnClose.current
              if (open || id === null) return
              focusOnClose.current = null
              focusTitle(id)
            }}
            triggerProps={{ className: "w-full" }}
          />
        </div>
        <div data-slot="settings-sections" className="flex min-w-0 flex-1 flex-col gap-section">
          <PendingSectionContext value={pending}>{children}</PendingSectionContext>
        </div>
      </div>
    </div>
  )
}

type SettingsSectionProps = Omit<ComponentProps<"section">, "title"> & {
  /** The anchor the navigation scrolls to. */
  id: string
  title: ReactNode
  /** The navigation's text for it, when `title` isn't plain text. */
  navLabel?: string
  description?: ReactNode
  /** Buttons beside the title, like Save. */
  actions?: ReactNode
  /** `destructive` edges the box in the destructive tone, for a danger zone. */
  tone?: "default" | "destructive"
  /** `card` (default) puts the content in a box whose rows are divided; `none` leaves it bare. */
  surface?: "card" | "none"
  headingLevel?: 2 | 3
}

function SettingsSection({
  id,
  title,
  navLabel: _navLabel,
  description,
  actions,
  tone = "default",
  surface = "card",
  headingLevel = 2,
  className,
  children,
  ...props
}: SettingsSectionProps) {
  const titleId = useId()
  const descriptionId = useId()
  useSectionMounted(id)
  const Heading = `h${String(headingLevel)}` as "h2"
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      aria-describedby={description === undefined ? undefined : descriptionId}
      data-slot="settings-section"
      data-tone={tone}
      className={cn("flex min-w-0 scroll-mt-(--settings-scroll-margin) flex-col gap-group", className)}
      {...props}
    >
      <div className="flex flex-wrap items-start gap-x-group gap-y-items">
        <div className="flex min-w-0 grow basis-60 flex-col gap-inline">
          <Heading
            id={titleId}
            tabIndex={-1}
            data-slot="settings-section-title"
            className="text-title-sm tracking-tight focus:outline-none"
          >
            {title}
          </Heading>
          {description !== undefined && (
            <p id={descriptionId} className="text-body-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions !== undefined && <div className="flex shrink-0 flex-wrap items-center gap-items">{actions}</div>}
      </div>
      {surface === "card" ? (
        <div
          data-slot="settings-section-body"
          className="flex flex-col divide-y rounded-surface border bg-card/(--glass-opacity) px-inset-surface text-card-foreground shadow-surface backdrop-surface in-data-[tone=destructive]:border-destructive-border"
        >
          {children}
        </div>
      ) : (
        children
      )}
    </section>
  )
}

type SettingsRowProps = Omit<ComponentProps<"div">, "children"> & {
  label: ReactNode
  description?: ReactNode
  /** The control on the right; it moves under the label when the row gets narrow. */
  children?: ReactNode
  /**
   * `true` (default) wraps the row in a `Field`, so the label and description name and describe a UI SDK control in
   * it (Switch, Select, Input). `false` for a row whose control names itself, like a Button or a ConfirmDialog.
   */
  field?: boolean
}

const rowClassName = "flex flex-row flex-wrap items-center justify-between gap-x-group gap-y-items py-group"
const rowTextClassName = "flex min-w-0 grow basis-60 flex-col gap-inline"

function SettingsRow({ label, description, field = true, className, children, ...props }: SettingsRowProps) {
  const control = <div className="flex max-w-full shrink-0 flex-wrap items-center gap-items">{children}</div>
  if (!field) {
    return (
      <div data-slot="settings-row" data-settings-row="" className={cn(rowClassName, className)} {...props}>
        <div className={rowTextClassName}>
          <div className="text-body font-medium">{label}</div>
          {description !== undefined && <p className="text-body-sm text-muted-foreground">{description}</p>}
        </div>
        {control}
      </div>
    )
  }
  return (
    <Field data-slot="settings-row" data-settings-row="" className={cn(rowClassName, className)} {...props}>
      <div className={rowTextClassName}>
        <FieldLabel>{label}</FieldLabel>
        {description !== undefined && <FieldDescription>{description}</FieldDescription>}
      </div>
      {control}
    </Field>
  )
}

type SettingsDangerActionProps = Omit<SettingsRowProps, "label" | "description" | "children" | "field"> & {
  label: ReactNode
  description?: ReactNode
  /** The button that opens the confirmation. */
  trigger: ReactNode
  /** The confirmation's title, like "Delete this device?". */
  title: ReactNode
  /** What confirming does, said to the person in the dialog. */
  consequence?: ReactNode
  /** The confirm button: words that aren't the trigger's, like "Delete forever". */
  confirmLabel: ReactNode
  /** The sentence an agent must show a person before confirming; becomes `data-agent-confirm`. */
  agentConfirm: string
  onConfirm: () => unknown
  /** The cancel button, in the page's language. */
  cancelLabel?: ReactNode
  /** The trigger can't be pressed, like while the action isn't allowed. */
  disabled?: boolean
  /** The action is running elsewhere: the trigger shows a spinner, is `aria-busy` and ignores presses. */
  pending?: boolean
}

/** A row of a danger zone: a destructive button that asks first, and that agents need a person's approval for. */
function SettingsDangerAction({
  label,
  description,
  trigger,
  title,
  consequence,
  confirmLabel,
  agentConfirm,
  onConfirm,
  cancelLabel,
  disabled,
  pending,
  ...props
}: SettingsDangerActionProps) {
  return (
    <SettingsRow field={false} label={label} description={description} {...props}>
      <ConfirmDialog
        trigger={trigger}
        triggerVariant="destructive"
        triggerDisabled={disabled}
        triggerPending={pending}
        tone="destructive"
        title={title}
        description={consequence}
        confirmLabel={confirmLabel}
        agentConfirm={agentConfirm}
        onConfirm={onConfirm}
        labels={cancelLabel === undefined ? undefined : { cancel: cancelLabel }}
      />
    </SettingsRow>
  )
}

/**
 * Read-only facts in a section, like a device's name and address: a `DescriptionList` with the term beside the
 * details (`inline` by default), stacked when the section is narrow. Fill it with `DescriptionItem`s.
 */
function SettingsFacts({ layout = "inline", className, ...props }: DescriptionListProps) {
  return <DescriptionList data-slot="settings-facts" layout={layout} className={cn("py-items", className)} {...props} />
}

/** A section in the destructive tone, for actions that can't be undone; fill it with `SettingsDangerAction` rows. */
function SettingsDangerZone(props: Omit<SettingsSectionProps, "tone">) {
  return <SettingsSection tone="destructive" {...props} />
}

export {
  SettingsDangerAction,
  SettingsDangerZone,
  SettingsFacts,
  SettingsPage,
  settingsPageLabels,
  SettingsRow,
  SettingsSection,
}
export type {
  SettingsDangerActionProps,
  SettingsPageLabels,
  SettingsPageProps,
  SettingsRowProps,
  SettingsSectionChangeReason,
  SettingsSectionLink,
  SettingsSectionProps,
}
