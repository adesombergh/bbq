/**
 * Open a URL in the user's default browser without touching our stdout/stdin.
 * (stdout is the MCP JSON-RPC channel.)
 */
function openCommand(url: string): string[] {
  if (process.platform === "darwin") {
    return ["open", url]
  }
  if (process.platform === "win32") {
    return ["cmd", "/c", "start", "", url]
  }
  return ["xdg-open", url]
}

export function openBrowser(url: string): boolean {
  if (process.env.BBQ_NO_OPEN !== undefined) {
    return false
  }
  try {
    Bun.spawn(openCommand(url), {
      stderr: "ignore",
      stdin: "ignore",
      stdout: "ignore",
    }).unref()
    return true
  } catch (error) {
    console.error("[bbq] could not open browser:", error)
    return false
  }
}
