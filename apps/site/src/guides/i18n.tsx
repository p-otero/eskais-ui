import { A, Article, Code, DocTitle, H2, P, Pre, Ul } from "../docs/prose"

const formMessages = `import { createFormMessages, formMessagesEs } from "@/components/ui/form"

<Form messages={formMessagesEs} />

// Or any i18n library: keys are form.<code>
<Form messages={createFormMessages(t)} />
<Form messages={(issue) => t(\`form.\${issue.code}\`, { ...issue.params, field: issue.label })} />`

const labels = `<MarkdownEditor labels={markdownEditorLabelsEs} />
<AgentTaskBoard labels={agentTaskBoardLabelsEs} locale="es-ES" timeZone="Europe/Madrid" />
<Sidebar label="Navegación" labels={{ open: "Abrir navegación", close: "Cerrar navegación" }} />`

export default function I18n() {
  return (
    <Article>
      <DocTitle
        eyebrow="Getting started"
        title="Internationalization"
        description="Components ship no visible copy in a specific language. Accessible labels default to English and every one is overridable."
      />

      <H2 id="copy">Visible copy is yours</H2>
      <P>
        Titles, button text and empty states are props: <Code>DataState</Code> requires <Code>errorTitle</Code> and{" "}
        <Code>emptyTitle</Code>, <Code>SkipLink</Code> requires its text. Write them in the page's language and set{" "}
        <Code>lang</Code> on the element that holds them.
      </P>

      <H2 id="labels">Accessible labels</H2>
      <P>
        Screen-reader labels (close buttons, spinners, toolbars) default to English. Override one string or pass a whole
        dictionary; Spanish dictionaries ship for the larger components.
      </P>
      <Pre code={labels} />

      <H2 id="forms">Form messages</H2>
      <P>
        Validation messages come from the issue code (<Code>required</Code>, <Code>minLength</Code>, <Code>email</Code>
        …) with params. <Code>FormField messages</Code> wins over the form's; returning <Code>undefined</Code> falls
        back to the defaults, then the schema's own message.
      </P>
      <Pre code={formMessages} />

      <H2 id="formatting">Dates, numbers and time zones</H2>
      <Ul>
        <li>
          Everything formats with <Code>Intl</Code>: pass <Code>locale</Code> and <Code>timeZone</Code> to{" "}
          <A to="/docs/components/relative-time">RelativeTime</A>, <A to="/docs/components/usage">Usage</A>,{" "}
          <A to="/docs/components/date-time-picker">DateTimePicker</A> and the agent task components.
        </li>
        <li>Calendars and date pickers read the week start and date format from the locale.</li>
        <li>Right to left needs no provider: components read the direction from the page.</li>
      </Ul>
    </Article>
  )
}
