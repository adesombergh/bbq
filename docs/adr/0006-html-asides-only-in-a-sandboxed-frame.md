---
status: accepted
---

# Claude-produced HTML renders only inside a script-less sandboxed frame; markdown never carries raw HTML

Show me and ELI5 asides are HTML fragments written by Claude. The browser renders them in an `<iframe sandbox="allow-same-origin">` with its own stylesheet and no scripts, and the markdown renderer used for everything else keeps raw HTML escaped. This is a boundary decision, not a rendering detail: the aside `format` is part of the tool protocol, and any future richer aside (interactive, scripted) must stay inside the frame or get a new format rather than loosening either rule.
