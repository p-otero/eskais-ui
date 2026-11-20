/** How an action was asked for: a press passes its event or reason, an agent's step and app code pass neither. */
type ActionCall = { reason?: string; event?: Event | undefined } | undefined

/** Why an action didn't run: the app's callback refused it, or the component's state doesn't offer it now. */
type ActionRefusalKind = "refused" | "unavailable"

/**
 * Thrown by a component's action that was called with no press behind it (an agent's step, a controller, app code)
 * and didn't run. UI SDK's bridge reports `ok: true` for any action that returns, so a throw is what fails the
 * agent's step with `message`.
 */
class ActionRefusedError extends Error {
  override name = "ActionRefusedError"
  readonly action: string
  readonly kind: ActionRefusalKind

  constructor(action: string, kind: ActionRefusalKind, message: string) {
    super(message)
    this.action = action
    this.kind = kind
  }
}

const isImperative = (call: ActionCall) => !call?.event && (call?.reason ?? "imperative") === "imperative"

/**
 * An action that can't run: returns `false` for a person's press, which the interface didn't offer anyway, and throws
 * for any other call. `why` finishes the sentence after the action's name: `isn't available while listening`.
 */
function unavailable(action: string, why: string): never
function unavailable(action: string, why: string, call: ActionCall): false
function unavailable(action: string, why: string, call?: ActionCall): false {
  if (isImperative(call)) throw new ActionRefusedError(action, "unavailable", `${action} ${why}.`)
  return false
}

/**
 * Settles what `createChange` or `!dispatch(...)` returned: `true` stays, and a change the app cancelled through
 * `details.cancel()` returns `false` for a person's press and throws for any other call.
 */
function settled<Result>(result: Result | false, action: string): Result
function settled<Result>(result: Result | false, action: string, call: ActionCall): Result | false
function settled<Result>(result: Result | false, action: string, call?: ActionCall): Result | false {
  if (result !== false) return result
  if (isImperative(call)) throw new ActionRefusedError(action, "refused", `${action} was refused by the app.`)
  return false
}

export { ActionRefusedError, settled, unavailable }
export type { ActionCall, ActionRefusalKind }
