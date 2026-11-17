import { useEffect, type RefObject } from "react"

/** After a restart (`run` above 0), focus the first step's heading inside `content` once the form has remounted. */
function useFocusFirstStepOnRestart(content: RefObject<HTMLElement | null>, run: number) {
  useEffect(() => {
    if (run > 0) content.current?.querySelector<HTMLElement>('[data-slot="step-form-title"]')?.focus()
  }, [content, run])
}

export { useFocusFirstStepOnRestart }
