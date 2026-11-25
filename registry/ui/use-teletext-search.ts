import { useEffect, useEffectEvent, useState } from "react"

import { firstPage, lastPage } from "@/components/ui/teletext-page"

const tickMs = 45

/**
 * The page counter while a set searches the broadcast: it runs through the pages going past for `searchMs`, then
 * lands on `to` and calls `onArrive`. Returns the number to show, `from` while nothing is searched.
 */
function useTeletextSearch({
  from,
  to,
  searchMs,
  onArrive,
}: {
  from: number
  to: number
  searchMs: number
  onArrive: (page: number) => void
}) {
  const [passing, setPassing] = useState<number | null>(null)
  const arrive = useEffectEvent((page: number) => {
    setPassing(null)
    onArrive(page)
  })

  useEffect(() => {
    if (from === to || searchMs <= 0) return
    let shown = from
    const ticker = setInterval(() => {
      shown = shown >= lastPage ? firstPage : shown + 1 + Math.floor(Math.random() * 3)
      setPassing(Math.min(shown, lastPage))
    }, tickMs)
    const landing = setTimeout(() => {
      clearInterval(ticker)
      arrive(to)
    }, searchMs)
    return () => {
      clearInterval(ticker)
      clearTimeout(landing)
    }
  }, [from, to, searchMs])

  return { searching: from !== to, shown: passing ?? from }
}

export { useTeletextSearch }
