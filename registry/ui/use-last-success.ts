"use client"

import { useEffect, useRef } from "react"

import type { DataStatus } from "@/components/ui/data-state"

// A ref written after commit, not state set during render: that rendered twice for every new `data` array,
// and a render that never commits must not change what counts as the last result.
function useLastSuccess<T>(status: DataStatus, data: T | undefined) {
  const last = useRef<{ data: T }>(undefined)
  useEffect(() => {
    if (status === "success" && data !== undefined) last.current = { data }
  }, [status, data])
  // oxlint-disable-next-line react/refs -- read only on renders the props cause; a change to it needs no render of its own
  return last.current?.data
}

export { useLastSuccess }
