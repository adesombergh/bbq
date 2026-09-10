/** Raised for every invalid state transition; MCP tools turn it into isError. */
export class StateError extends Error {
  override name = "StateError"
}
