import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, AccordionTrigger } from "@/components/ui/accordion"

const faq = [
  { value: "limits", title: "What are the rate limits?", body: "Each agent gets 60 requests a minute; bursts queue." },
  { value: "retries", title: "When does a task retry?", body: "After a failure, up to three attempts, then it waits." },
  { value: "cost", title: "Who pays for tokens?", body: "The workspace that owns the task, from its monthly quota." },
]

export default function AccordionDemo() {
  return (
    <Accordion aria-label="Task questions" defaultValue={["limits"]} className="w-full max-w-lg">
      {faq.map((item) => (
        <AccordionItem key={item.value} value={item.value}>
          <AccordionHeader>
            <AccordionTrigger>{item.title}</AccordionTrigger>
          </AccordionHeader>
          <AccordionPanel>{item.body}</AccordionPanel>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
