import { useEffect, type RefObject } from "react"

const quietestMs = 3500
const loudestMs = 9000

const prefersReducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches

/**
 * Now and then dims one lit letter for a few frames, as a tired transformer does: a timer picks the letter and CSS
 * plays the flicker, so nothing runs between buzzes, off screen, in a hidden tab or under reduced motion.
 */
function useNeonBuzz(sign: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    const root = sign.current
    if (!root || !active || prefersReducedMotion()) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let onScreen = true
    const letters = () => root.querySelectorAll<HTMLElement>('[data-letter="lit"]')

    const buzz = () => {
      const lit = [...letters()].filter((letter) => letter.textContent?.trim())
      const letter = lit[Math.floor(Math.random() * lit.length)]
      if (letter) {
        letter.dataset.buzz = ""
        letter.addEventListener("animationend", () => delete letter.dataset.buzz, { once: true })
      }
      schedule()
    }
    const schedule = () => {
      clearTimeout(timer)
      if (!onScreen || document.visibilityState === "hidden") return
      timer = setTimeout(buzz, quietestMs + Math.random() * (loudestMs - quietestMs))
    }

    const visibility =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver(([entry]) => {
            onScreen = entry?.isIntersecting ?? true
            schedule()
          })
        : undefined
    visibility?.observe(root)
    // oxlint-disable-next-line p-otero/prefer-sync-external-store -- the listener reschedules a timer; no value is copied into state
    document.addEventListener("visibilitychange", schedule)
    schedule()
    return () => {
      clearTimeout(timer)
      visibility?.disconnect()
      document.removeEventListener("visibilitychange", schedule)
    }
  }, [sign, active])
}

export { useNeonBuzz }
