/**
 * Open a URL in the user's default browser without touching our stdout/stdin.
 * (stdout is the MCP JSON-RPC channel.)
 */
export function openBrowser(url: string): boolean {
  if (process.env.GRILL_UI_NO_OPEN) return false;
  const cmd =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];
  try {
    Bun.spawn(cmd, { stdin: "ignore", stdout: "ignore", stderr: "ignore" }).unref();
    return true;
  } catch (err) {
    console.error("[grill-ui] could not open browser:", err);
    return false;
  }
}
