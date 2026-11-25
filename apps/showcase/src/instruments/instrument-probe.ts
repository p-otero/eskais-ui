import { agent } from "../agent"

declare global {
  interface Window {
    /** Read by tooling/instruments-check.mjs: each instrument's paints in ms, and the agent bridge. */
    instrumentProbe?: { paints: number[]; agent: typeof agent }
  }
}

const probe = { paints: [] as number[], agent }

/** Puts the paint log and the agent bridge on `window` for the browser checks. */
function exposeInstrumentProbe() {
  window.instrumentProbe = probe
}

const recordPaint = (milliseconds: number) => {
  probe.paints.push(milliseconds)
}

export { exposeInstrumentProbe, recordPaint }
